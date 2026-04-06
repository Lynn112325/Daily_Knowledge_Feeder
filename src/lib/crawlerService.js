// --- LIBRARIES & HELPERS ---
const chalk = require('chalk'); // For colored console logs
const { scrapeArticle } = require('./scraperEngine'); // Engine to pull content from a single page
const { isAllowed } = require('./robotsGuard'); // Checker for robots.txt rules
const { getList } = require('./listFetcher'); // Engine to get a list of URLs from a main page
const globalConfig = require('../config/global'); // Global settings like User-Agent
const STRATEGIES = require('../config/strategies'); // Site-specific selectors and rules
const { saveToDatabase } = require('./articleService'); // Function to save data to MongoDB
const { logToUI } = require('./emitLog');
const { taskContext } = require('./context');

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
        await logToUI(chalk.bgRed.white(` 🛑 STOP SIGNAL: Task #${taskId} terminated by user. `));
        return true;
    }
    return false;
}

/**
 * Check if existing articles overlap with the current category.
 * If found, add the current category to their tags without re-scraping.
 */
async function handleCategoryOverlap(urls, currentCategory) {
    const result = await Article.updateMany(
        { originalUrl: { $in: urls } },
        { $addToSet: { category: currentCategory } } // Adds to array only if not already present
    );
    if (result.modifiedCount > 0) {
        await logToUI(chalk.blueBright(`      🏷️  Overlap: Updated ${result.modifiedCount} articles with new category [${currentCategory}]`));
    }
    return result.modifiedCount;
}

/**
 * Strategies for different backfill mechanisms (Strategy Pattern)
 */
const BACKFILL_HANDLERS = {
    /**
     * SINGLE_PAGE_API: Processes a large flat list using a sliding window.
     * Logic: Continues slicing batches until the desiredNewCount is met or URLs are exhausted.
     * This ensures the task doesn't stop early just because the first batches contained duplicates.
     */
    'SINGLE_PAGE_API': async (source, strategy, depthLimit, taskId, stats) => {
        const base = source.baseUrl.replace(/\/$/, "");
        const apiUrl = strategy.listConfig.buildApiUrl(base, source.path);

        const allUrls = await getList(apiUrl, strategy.listConfig, globalConfig.USER_AGENT);
        if (!allUrls?.length) {
            source.isBackfillCompleted = true;
            return;
        }

        const desiredNewCount = depthLimit * globalConfig.BATCH_SIZE;
        let totalSavedForThisSource = 0;

        // Keep sliding the window deeper into the array until quota is reached
        while (totalSavedForThisSource < desiredNewCount) {
            if (await isTaskStopped(taskId)) break;

            const startIndex = (source.lastProcessedUnit - 1) * globalConfig.BATCH_SIZE;
            if (startIndex >= allUrls.length) {
                await logToUI(chalk.bgCyan.black(' 🏁 REACHED THE END OF URL ARRAY '));
                source.isBackfillCompleted = true;
                break;
            }

            const endIndex = Math.min(startIndex + globalConfig.BATCH_SIZE, allUrls.length);
            const targetUrls = allUrls.slice(startIndex, endIndex);

            // Process and get the count of actually newly saved articles
            const { status, savedCount } = await processUrlList(targetUrls, source, strategy, taskId, stats);

            totalSavedForThisSource += savedCount;
            source.lastProcessedUnit += 1; // Increment unit regardless of content to move cursor forward

            await logToUI(chalk.magenta(
                `📍 Progress: ${totalSavedForThisSource}/${desiredNewCount} | ` +
                `Batch ${source.lastProcessedUnit} | Range: ${startIndex + 1}-${endIndex}`
            ));

            if (status === 'STOPPED') break;
            if (savedCount === 0) {
                await logToUI(chalk.gray(`      ⏭️  Batch ${source.lastProcessedUnit} all duplicates, searching deeper...`));
            }

        }
    },

    /**
     * PAGINATION: Traditional page-by-page scraping.
     * Logic: Skips "empty" pages (all duplicates) without consuming the depthLimit quota.
     * Guaranteed to attempt finding 'depthLimit' worth of pages with new content.
     */
    'PAGINATION': async (source, strategy, depthLimit, taskId, stats) => {
        let currentPage = source.lastProcessedUnit || 1;
        let pagesWithNewContent = 0;

        while (pagesWithNewContent < depthLimit) {
            if (await isTaskStopped(taskId)) break;

            const pageUrl = strategy.listConfig.buildPageUrl
                ? strategy.listConfig.buildPageUrl(base, source.path, currentPage)
                : `${base}${source.path}?page=${currentPage}`;

            const urls = await getList(pageUrl, strategy.listConfig, globalConfig.USER_AGENT);

            if (!urls?.length) {
                source.isBackfillCompleted = true;
                break;
            }

            const { status, savedCount } = await processUrlList(urls, source, strategy, taskId, stats);

            // Only count towards depthLimit if the page actually contributed new data
            if (savedCount > 0) {
                pagesWithNewContent++;
            } else {
                await logToUI(chalk.gray(`      ⏭️  Page ${currentPage} has no new content, skipping...`));
            }

            currentPage++;
            source.lastProcessedUnit = currentPage;
            await source.save();

            if (status === 'STOPPED') break;
            await sleep(3000);
        }
    }
};

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
                await logToUI(chalk.yellow(`      ⚠️  Network Issue. Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${maxRetries})`));
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
    // 1. Handle Overlaps: Update categories for articles already in the DB
    await handleCategoryOverlap(urls, source.category);

    // 2. Filter: Only scrape URLs that do not exist at all in our database
    const existing = await Article.find({ originalUrl: { $in: urls } }).select('originalUrl');
    const existingSet = new Set(existing.map(a => a.originalUrl));
    const newUrls = urls.filter(u => !existingSet.has(u));
    let savedInThisBatch = 0;

    const internalWall = await Article.find({
        originalUrl: { $in: urls },
        category: source.category
    }).select('originalUrl');

    const internalWallSet = new Set(internalWall.map(a => a.originalUrl));
    const hitWall = internalWallSet.size > 0;
    const overlapCount = urls.length - newUrls.length;
    const overlapMsg = overlapCount > 0 ? ` (Filtered ${overlapCount} duplicates from history/other categories)` : '';

    await logToUI(chalk.gray(`      ✨ Scanned ${urls.length} items. Found ${chalk.bold.green(newUrls.length)} fresh articles to sync${chalk.italic(overlapMsg)}.`));

    // If no new articles found, mark this category as finished
    if (newUrls.length === 0) {
        await logToUI(chalk.green(`   ✨ No new articles. Category Cleared!`));
        await source.save();
    }

    for (const url of newUrls) {
        // Stop immediately if the stop signal is received
        if (await isTaskStopped(taskId)) return 'STOPPED';

        try {
            // 2. Respect Robots.txt rules
            const { allowed, crawlDelay } = await checkRobotsWithCache(url, globalConfig.USER_AGENT);
            if (!allowed) {
                await logToUI(chalk.yellow(`      🚫 Skipped (Robots.txt): ${url.substring(0, 50)}...`));
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
                savedInThisBatch++;
                stats.successCount++;
                await logToUI(chalk.green(`      ✅ Saved: ${detail.title.substring(0, 40)}...`));
            }
        } catch (err) {
            stats.failCount++;
            await logToUI(chalk.red(`      ❌ Article Permanent Failure [${url}]: ${err.message}`));
        }
    } return {
        status: 'CONTINUE', savedCount: savedInThisBatch, hitWall: hitWall
    };
}

/**
 * Mode 1: Daily Updates
 * Check the first page of a category and grab the latest articles.
 */
async function handleIncremental(sourceIds, taskId) {
    const stats = { totalProcessed: 0, successCount: 0, failCount: 0 };
    await logToUI(chalk.bold.yellow(`\n🚀 [ENGINE: INCREMENTAL] Task #${taskId} started.`));

    robotsCache.clear();

    return taskContext.run({ taskId }, async () => {
        try {
            await Task.findByIdAndUpdate(taskId, {
                status: 'running',
                startedAt: new Date(),
                totalItems: sourceIds.length
            });

            for (const [i, sourceId] of sourceIds.entries()) {
                if (await isTaskStopped(taskId)) break;

                const source = await Source.findById(sourceId);
                const strategy = STRATEGIES[source.strategyKey];

                const baseUrlClean = source.baseUrl.replace(/\/$/, "");
                const pathClean = source.path.startsWith("/") ? source.path : `/${source.path}`;
                const fullListUrl = `${baseUrlClean}${pathClean}`;

                if (!source.isActive) {
                    await logToUI(chalk.gray(`[Skip] ${source.category} is inactive.`));
                    continue;
                }

                await logToUI(chalk.blueBright(`\n📂 [${i + 1}/${sourceIds.length}] Category: ${source.category}`));

                // Fetch list of URLs from the first page
                const targetUrls = await getList(fullListUrl, strategy.listConfig, globalConfig.USER_AGENT);

                if (!targetUrls?.length) continue;

                const result = await processUrlList(targetUrls, source, strategy, taskId, stats);
                if (result && result.status === 'STOPPED') break;

                // Record that this source was checked today
                await Source.findByIdAndUpdate(sourceId, { isInitialized: true, lastCrawledAt: new Date() });
                await Task.findByIdAndUpdate(taskId, {
                    processedSources: i + 1,
                });
            }

            const finalStatus = (await isTaskStopped(taskId)) ? 'stopped' : 'completed';
            await Task.findByIdAndUpdate(taskId, { status: finalStatus, completedAt: new Date() });
            await logToUI(chalk.bold.green(`\n🏁 Incremental Task Finished.`));

        } catch (err) {
            console.error(err);
            await logToUI(chalk.bgRed(" ENGINE CRASH "), err);
            await Task.findByIdAndUpdate(taskId, { status: 'failed', errorLog: err.message });
        }
    });
}

/**
 * Mode 2: Deep History Scrape
 * Go back in time through pages or large API results.
 */
async function handleBackfill(sourceIds, depthLimit, taskId) {
    const stats = { totalProcessed: 0, successCount: 0, failCount: 0 };
    robotsCache.clear();

    return taskContext.run({ taskId }, async () => {

        try {
            await Task.findByIdAndUpdate(taskId, { status: 'running', startedAt: new Date() });
            for (const [i, sourceId] of sourceIds.entries()) {
                if (await isTaskStopped(taskId)) break;

                const source = await Source.findById(sourceId);
                const strategy = STRATEGIES[source.strategyKey];
                const type = strategy.listConfig.backfillType || 'PAGINATION';

                if (!source.isActive) {
                    await logToUI(chalk.gray(`[Skip] ${source.category} is inactive.`));
                    continue;
                }

                const handler = BACKFILL_HANDLERS[type];
                if (handler) {
                    await logToUI(chalk.blueBright(`\n📂 [${i + 1}/${sourceIds.length}] Category: ${source.category}`));
                    await handler(source, strategy, depthLimit, taskId, stats);
                    await Source.findByIdAndUpdate(sourceId, {
                        lastCrawledAt: new Date()
                    });

                    await Task.findByIdAndUpdate(taskId, {
                        processedSources: i + 1,
                    });
                    await source.save();
                } else {
                    await logToUI(chalk.red(`No handler for backfill type: ${type}`));
                }
            }

            const finalStatus = (await isTaskStopped(taskId)) ? 'stopped' : 'completed';
            await Task.findByIdAndUpdate(taskId, { status: finalStatus, completedAt: new Date() });
            await logToUI(chalk.bold.green(`\n🏁 Backfill Task Ended as [${finalStatus}].`));


        } catch (err) {
            await logToUI(chalk.bgRed(" BACKFILL CRASH "), err);
            await Task.findByIdAndUpdate(taskId, { status: 'failed', errorLog: err.message });
        }
    });
}

/**
 * Batch initialize all unanchored (new) sources
 */
async function runQuickInitTask(sourcesToInit, taskId) {
    // 1. Convert Mongoose objects into a clean array of ID strings
    const sourceIds = sourcesToInit.map(s => s._id.toString());

    await logToUI(chalk.bold.cyan(`\n⚡ [QUICK INIT] Starting anchor task for ${sourceIds.length} sources...`));

    try {
        // 2. Reuse the Incremental handler to fetch only the first page (baseline)
        await handleIncremental(sourceIds, taskId);

        await logToUI(chalk.bold.green(`\n✅ [QUICK INIT] All sources anchored successfully.`));
    } catch (err) {
        // 3. Log critical failures to the console/UI for debugging
        await logToUI(chalk.bgRed(" QUICK INIT ERROR "), err);
        throw err;
    }
}

module.exports = { handleIncremental, handleBackfill, runQuickInitTask };