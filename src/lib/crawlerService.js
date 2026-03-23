// --- LIBRARIES & HELPERS ---
const chalk = require('chalk'); // For colored console logs
const { scrapeArticle } = require('./scraperEngine'); // Engine to pull content from a single page
const { isAllowed } = require('./robotsGuard'); // Checker for robots.txt rules
const { getList } = require('./listFetcher'); // Engine to get a list of URLs from a main page
const globalConfig = require('../config/global'); // Global settings like User-Agent
const STRATEGIES = require('../config/strategies'); // Site-specific selectors and rules
const { saveToDatabase } = require('./articleService'); // Function to save data to MongoDB

// --- DATABASE MODELS ---
const Source = require('../models/Source');
const Task = require('../models/Task');
const Article = require('../models/Article');

// Utility to pause execution for a set time
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- ROBOTS.TXT CACHE ---
// Store robots.txt results here so we don't ask the server every single time
const robotsCache = new Map();

/**
 * Check if we are allowed to scrape a domain, using the cache first
 */
async function checkRobotsWithCache(url, userAgent) {
    const domain = new URL(url).origin;
    if (robotsCache.has(domain)) {
        return robotsCache.get(domain);
    }
    // If not in cache, fetch it from the web
    const result = await isAllowed(url, userAgent);
    robotsCache.set(domain, result);
    return result;
}

/**
 * Check the database to see if the user clicked "Stop" for this task
 */
async function isTaskStopped(taskId) {
    const task = await Task.findById(taskId).select('status');
    if (!task || task.status === 'stopped') {
        console.log(chalk.bgRed.white(` 🛑 STOP SIGNAL: Task #${taskId} terminated by user. `));
        return true;
    }
    return false;
}

/**
 * Try to scrape a URL. If the network fails, wait and try again up to 3 times.
 */
async function scrapeWithRetry(url, strategy, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await scrapeArticle(url, strategy, globalConfig.USER_AGENT);
        } catch (err) {
            // Only retry if it's a connection error (like DNS or timeout)
            const isNetworkError = [
                'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT',
                'ECONNREFUSED', 'EAI_AGAIN', 'ERR_BAD_RESPONSE'
            ].some(code => err.message.includes(code) || (err.code && err.code.includes(code)));

            if (isNetworkError && i < maxRetries - 1) {
                const delay = (i + 1) * 5000; // Increase wait time: 5s, then 10s
                console.log(chalk.yellow(`      ⚠️  Network Issue. Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${maxRetries})`));
                await sleep(delay);
                continue;
            }
            // If it's a 404 or we ran out of retries, give up
            throw err;
        }
    }
}

/**
 * The core logic: Filter new URLs, check permissions, scrape, and save
 */
async function processUrlList(urls, source, strategy, taskId, stats) {
    // 1. Remove URLs that are already in our database
    const existing = await Article.find({ originalUrl: { $in: urls } }).select('originalUrl');
    const existingSet = new Set(existing.map(a => a.originalUrl));
    const newUrls = urls.filter(u => !existingSet.has(u));

    console.log(chalk.gray(`      📊 Page analysis: ${urls.length} total, ${newUrls.length} new to scrape.`));

    // If no new articles found, mark this category as finished
    if (newUrls.length === 0) {
        console.log(chalk.green(`   ✨ No new historical articles. Category Backfilled!`));
        await source.save();
    }

    for (const url of newUrls) {
        // Stop immediately if the stop signal is received
        if (await isTaskStopped(taskId)) return 'STOPPED';

        try {
            // 2. Respect Robots.txt rules
            const { allowed, crawlDelay } = await checkRobotsWithCache(url, globalConfig.USER_AGENT);
            if (!allowed) {
                console.log(chalk.yellow(`      🚫 Skipped (Robots.txt): ${url.substring(0, 50)}...`));
                continue;
            }

            // 3. Wait to avoid spamming the server
            await sleep((crawlDelay || 2) * 1000);

            // 4. Scrape the content with retry logic
            const detail = await scrapeWithRetry(url, strategy);

            if (detail) {
                // Save the successful scrape to DB
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
            // Always update progress in the Task DB for the UI to see
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

/**
 * Mode 1: Daily Updates
 * Check the first page of a category and grab the latest articles.
 */
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
            // Fetch list of URLs from the first page
            const allUrls = await getList(fullListUrl, strategy.listConfig, globalConfig.USER_AGENT);

            if (!allUrls?.length) continue;

            // Only process up to the limit set by the user
            const targetUrls = allUrls.slice(0, limitPerCategory);
            const result = await processUrlList(targetUrls, source, strategy, taskId, stats);

            if (result === 'STOPPED') break;
            // Record that this source was checked today
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

/**
 * Mode 2: Deep History Scrape
 * Go back in time through pages or large API results.
 */
async function handleBackfill(sourceIds, depthLimit, taskId) {
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

            // SCENARIO A: The site provides one giant XML/JSON list of all history
            if (backfillType === 'SINGLE_PAGE_API') {
                const apiUrl = strategy.listConfig.buildApiUrl(base, source.path);
                console.log(chalk.magenta(`   📡 Fetching full historical API: ${apiUrl}`));

                // Get every single URL at once
                const allUrls = await getList(apiUrl, strategy.listConfig, globalConfig.USER_AGENT);

                if (!allUrls || allUrls.length === 0) {
                    source.isBackfillCompleted = true;
                    await source.save();
                    continue;
                }

                // Instead of processing all at once, process a small "Batch"
                const startIndex = (source.lastProcessedUnit - 1) * depthLimit;
                const totalUrls = allUrls.length;
                const endIndex = Math.min(startIndex + depthLimit, totalUrls);
                const currentBatchUrls = allUrls.slice(startIndex, endIndex);

                await Task.findByIdAndUpdate(taskId, { totalTarget: currentBatchUrls.length });

                await processUrlList(currentBatchUrls, source, strategy, taskId, stats);

                // Bookmark where we are so we can resume next time
                source.lastProcessedUnit += 1;
                const progress = ((endIndex / totalUrls) * 100).toFixed(1);

                console.log(chalk.magenta(
                    `📍 Depth: [Batch ${source.lastProcessedUnit}] | ` +
                    `Range: ${startIndex + 1}-${endIndex} of ${totalUrls} | ` +
                    `Coverage: ${progress}%`
                ));

                // If we reached the end of the giant list, mark as finished
                if (endIndex >= totalUrls) {
                    console.log(chalk.bgMagenta.white(' 🏁 REACHED THE END OF HISTORICAL DATA '));
                    source.isBackfillCompleted = true;
                }

                await source.save();
            }

            // TODO: Unimplemented
            // SCENARIO B: The site uses traditional Page 1, Page 2...
            else if (backfillType === 'PAGINATION') {
                let currentPage = source.lastProcessedUnit || 1;

                await Task.findByIdAndUpdate(taskId, { totalTarget: depthLimit * 20 });

                for (let p = 0; p < depthLimit; p++) {
                    if (await isTaskStopped(taskId)) break;

                    // Build the URL for the specific page number
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

                    // Save the page number as a checkpoint
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

/**
 * Helper to determine UI labels based on the site's crawling method
 */
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