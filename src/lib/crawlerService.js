const chalk = require('chalk');
const { scrapeArticle } = require('./scraperEngine');
const { isAllowed } = require('./robotsGuard');
const { getList } = require('./listFetcher');
const globalConfig = require('../config/global');
const STRATEGIES = require('../config/strategies');
const { saveToDatabase } = require('./articleService');

// Models
const Source = require('../models/Source');
const Task = require('../models/Task');
const Article = require('../models/Article');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const BATCH_SIZE = 10;

const robotsCache = new Map();

async function checkRobotsWithCache(url, userAgent) {
    const domain = new URL(url).origin;
    if (robotsCache.has(domain)) {
        return robotsCache.get(domain);
    }
    const result = await isAllowed(url, userAgent);
    robotsCache.set(domain, result);
    return result;
}


async function isTaskStopped(taskId) {
    const task = await Task.findById(taskId).select('status');
    if (!task || task.status === 'stopped') {
        console.log(chalk.bgRed.white(` 🛑 STOP SIGNAL: Task #${taskId} terminated by user. `));
        return true;
    }
    return false;
}

async function scrapeWithRetry(url, strategy, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await scrapeArticle(url, strategy, globalConfig.USER_AGENT);
        } catch (err) {
            const isNetworkError = [
                'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT',
                'ECONNREFUSED', 'EAI_AGAIN', 'ERR_BAD_RESPONSE'
            ].some(code => err.message.includes(code) || (err.code && err.code.includes(code)));

            if (isNetworkError && i < maxRetries - 1) {
                const delay = (i + 1) * 5000;
                console.log(chalk.yellow(`      ⚠️  Network Issue. Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${maxRetries})`));
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }
}

async function processUrlList(urls, source, strategy, taskId, stats) {
    const existing = await Article.find({ originalUrl: { $in: urls } }).select('originalUrl');
    const existingSet = new Set(existing.map(a => a.originalUrl));
    const newUrls = urls.filter(u => !existingSet.has(u));

    console.log(chalk.gray(`      📊 Page analysis: ${urls.length} total, ${newUrls.length} new to scrape.`));
    if (newUrls.length === 0) {
        console.log(chalk.green(`   ✨ No new historical articles. Category Backfilled!`));
        await source.save();
    }
    for (const url of newUrls) {
        if (await isTaskStopped(taskId)) return 'STOPPED';

        try {
            const { allowed, crawlDelay } = await checkRobotsWithCache(url, globalConfig.USER_AGENT);
            if (!allowed) {
                console.log(chalk.yellow(`      🚫 Skipped (Robots.txt): ${url.substring(0, 50)}...`));
                continue;
            }

            await sleep((crawlDelay || 2) * 1000);

            const detail = await scrapeWithRetry(url, strategy);

            if (detail) {
                await saveToDatabase({
                    ...detail,
                    originalUrl: url,
                    siteName: source.siteName,
                    category: source.category,
                    sourceId: source._id
                });
                stats.successCount++;
                console.log(chalk.green(`      ✅ Saved: ${detail.title.substring(0, 40)}...`));
            }
        } catch (err) {
            stats.failCount++;
            console.error(chalk.red(`      ❌ Article Permanent Failure [${url}]: ${err.message}`));
        } finally {
            stats.totalProcessed++;
            await Task.findByIdAndUpdate(taskId, {
                processedCount: stats.totalProcessed,
                successCount: stats.successCount,
                failCount: stats.failCount
            });
        }
    }
    return 'CONTINUE';
}

async function handleIncremental(sourceIds, limitPerCategory, taskId) {
    const stats = { totalProcessed: 0, successCount: 0, failCount: 0 };
    console.log(chalk.bold.yellow(`\n🚀 [ENGINE: INCREMENTAL] Task #${taskId} started.`));

    robotsCache.clear();

    try {
        await Task.findByIdAndUpdate(taskId, { status: 'running', startedAt: new Date() });

        for (const sourceId of sourceIds) {
            if (await isTaskStopped(taskId)) break;

            const source = await Source.findById(sourceId);
            const strategy = STRATEGIES[source.strategyKey];
            const fullListUrl = new URL(source.path, source.baseUrl).href;

            console.log(chalk.blue(`\n📂 Category: ${source.category}`));
            const allUrls = await getList(fullListUrl, strategy.listConfig, globalConfig.USER_AGENT);

            if (!allUrls?.length) continue;

            const targetUrls = allUrls.slice(0, limitPerCategory);
            const result = await processUrlList(targetUrls, source, strategy, taskId, stats);

            if (result === 'STOPPED') break;
            await Source.findByIdAndUpdate(sourceId, { lastCrawledAt: new Date() });
        }

        const finalStatus = (await isTaskStopped(taskId)) ? 'stopped' : 'completed';
        await Task.findByIdAndUpdate(taskId, { status: finalStatus, completedAt: new Date() });
        console.log(chalk.bold.green(`\n🏁 Incremental Task Finished.`));

    } catch (err) {
        console.error(chalk.bgRed(" ENGINE CRASH "), err);
        await Task.findByIdAndUpdate(taskId, { status: 'failed', errorLog: err.message });
    }
}

async function handleBackfill(sourceIds, pagesToScroll, taskId) {
    const stats = { totalProcessed: 0, successCount: 0, failCount: 0 };

    robotsCache.clear();

    console.log(chalk.bold.yellow(`\n⛏️ [ENGINE: BACKFILL] Task #${taskId} started.`));

    try {
        await Task.findByIdAndUpdate(taskId, { status: 'running', startedAt: new Date() });

        for (const sourceId of sourceIds) {
            if (await isTaskStopped(taskId)) break;

            const source = await Source.findById(sourceId);
            const strategy = STRATEGIES[source.strategyKey];
            const backfillType = strategy.listConfig.backfillType || 'PAGINATION';
            const base = source.baseUrl.replace(/\/$/, "");

            console.log(chalk.yellow(`\n📂 Category: ${source.category} [Mode: ${backfillType}]`));

            if (backfillType === 'SINGLE_PAGE_API') {
                const apiUrl = strategy.listConfig.buildApiUrl(base, source.path);
                console.log(chalk.magenta(`   📡 Fetching full historical API: ${apiUrl}`));

                const allUrls = await getList(apiUrl, strategy.listConfig, globalConfig.USER_AGENT);

                if (!allUrls || allUrls.length === 0) {
                    source.isBackfillCompleted = true;
                    await source.save();
                    continue;
                }

                const startIndex = (source.lastProcessedUnit - 1) * BATCH_SIZE;
                const totalUrls = allUrls.length;
                const endIndex = Math.min(startIndex + BATCH_SIZE, totalUrls);
                const currentBatchUrls = allUrls.slice(startIndex, endIndex);

                await Task.findByIdAndUpdate(taskId, { totalTarget: currentBatchUrls.length });

                await processUrlList(currentBatchUrls, source, strategy, taskId, stats);

                source.lastProcessedUnit += 1;
                const progress = ((endIndex / totalUrls) * 100).toFixed(1);

                console.log(chalk.magenta(
                    `📍 Depth: [Batch ${source.lastProcessedUnit}] | ` +
                    `Range: ${startIndex + 1}-${endIndex} of ${totalUrls} | ` +
                    `Coverage: ${progress}%`
                ));

                if (endIndex >= totalUrls) {
                    console.log(chalk.bgMagenta.white(' 🏁 REACHED THE END OF HISTORICAL DATA '));
                    source.isBackfillCompleted = true;
                }

                await source.save();
            }
            // TODO: Unimplemented
            else if (backfillType === 'PAGINATION') {
                let currentPage = source.lastProcessedUnit || 1;

                await Task.findByIdAndUpdate(taskId, { totalTarget: pagesToScroll * 20 });

                for (let p = 0; p < pagesToScroll; p++) {
                    if (await isTaskStopped(taskId)) break;

                    const pageUrl = strategy.listConfig.buildPageUrl
                        ? strategy.listConfig.buildPageUrl(base, source.path, currentPage)
                        : `${base}${source.path}?page=${currentPage}`;

                    console.log(chalk.gray(`   📑 Fetching Page ${currentPage}: ${pageUrl}`));
                    const urls = await getList(pageUrl, strategy.listConfig, globalConfig.USER_AGENT);

                    if (!urls || urls.length === 0) {
                        console.log(chalk.yellow(`   ⏹️ No content found at Page ${currentPage}. Marking category as Backfilled.`));
                        source.isBackfillCompleted = true;
                        await source.save();
                        break;
                    }

                    const result = await processUrlList(urls, source, strategy, taskId, stats);
                    if (result === 'STOPPED') break;

                    currentPage++;
                    source.lastProcessedUnit = currentPage;
                    await source.save();

                    await sleep(3000);
                }
            }
        }
        const finalStatus = (await isTaskStopped(taskId)) ? 'stopped' : 'completed';
        await Task.findByIdAndUpdate(taskId, { status: finalStatus, completedAt: new Date() });
        console.log(chalk.bold.green(`\n🏁 Backfill Task Ended as [${finalStatus}].`));

    } catch (err) {
        console.error(chalk.bgRed(" BACKFILL CRASH "), err);
        await Task.findByIdAndUpdate(taskId, { status: 'failed', errorLog: err.message });
    }
}

function getTaskProgressInfo(strategyKey, currentCount) {
    const strategy = STRATEGIES[strategyKey];
    const type = strategy?.listConfig?.backfillType || 'PAGINATION';

    const config = {
        'SINGLE_PAGE_API': { label: 'Batches', unit: 'batch' },
        'INFINITE_SCROLL': { label: 'Scrolls', unit: 'scroll' },
        'PAGINATION': { label: 'Pages', unit: 'page' }
    };

    const info = config[type] || config['PAGINATION'];

    return {
        label: info.label,
        display: `${info.label} Scraped: ${currentCount}`
    };
}


module.exports = { handleIncremental, handleBackfill, getTaskProgressInfo };