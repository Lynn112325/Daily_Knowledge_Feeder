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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Core Crawler Engine: Manages the background execution of scraping tasks and DB updates.
 * @param {Array} sourceIds - List of database IDs for categories to scrape.
 * @param {Number} limitPerCategory - Max number of articles to fetch per category.
 * @param {String} taskId - The ID of the current task for progress tracking.
 */
async function runCrawlerEngine(sourceIds, limitPerCategory, taskId) {
    let totalProcessed = 0;
    let successCount = 0;
    let failCount = 0;

    console.log(chalk.yellow(`\n--- 🚀 Starting Task #${taskId} ---`));

    try {
        for (const sourceId of sourceIds) {
            // 1. Fetch source configuration from Database
            const source = await Source.findById(sourceId);
            if (!source) {
                console.log(chalk.red(`❌ Source ID not found: ${sourceId}`));
                continue;
            }

            // 2. Map the site to its specific scraping strategy
            const currentStrategy = STRATEGIES[source.strategyKey];
            if (!currentStrategy) {
                console.error(chalk.red(`Strategy "${source.strategyKey}" not found.`));
                continue;
            }

            // 3. Construct the full target URL and fetch the list of article links
            const fullListUrl = new URL(source.path, source.baseUrl).href;

            // 1. 抓取該列表頁【所有的】文章 URL (假設有 50 筆)
            const allPageUrls = await getList(fullListUrl, currentStrategy.listConfig, globalConfig.USER_AGENT);

            if (!allPageUrls || allPageUrls.length === 0) {
                console.log(chalk.yellow(`⚠️ No articles found in this category.`));
                continue; // 跳到下一個 source
            }

            // 2. 🚀 核心過濾邏輯：去資料庫比對這批 URL
            // 找出資料庫中已經包含的 URL (只取 originalUrl 欄位以節省記憶體)
            const existingArticles = await Article.find({
                originalUrl: { $in: allPageUrls }
            }).select('originalUrl');

            // 將已存在的 URL 轉成 Set，查詢速度最快 O(1)
            const existingUrlSet = new Set(existingArticles.map(a => a.originalUrl));

            // 3. 過濾出「真正全新」的 URL
            const newUrls = allPageUrls.filter(url => !existingUrlSet.has(url));

            console.log(chalk.gray(`Page has ${allPageUrls.length} links. Found ${newUrls.length} NEW links.`));

            // 4. 最後才套用使用者的限制數量 (Limit)
            const targetUrls = newUrls.slice(0, limitPerCategory);
            console.log(chalk.cyan(`Will scrape exactly ${targetUrls.length} new articles.`));

            // 4. Iterate through each article link
            for (const url of urlList.slice(0, limitPerCategory)) {
                try {
                    // A. Compliance: Check robots.txt and implement crawl delay
                    const { allowed, crawlDelay } = await isAllowed(url, globalConfig.USER_AGENT);
                    if (!allowed) continue;

                    await sleep(crawlDelay ? crawlDelay * 1000 : 2000);

                    // B. Extraction: Scrape article content using the strategy
                    const detail = await scrapeArticle(url, currentStrategy, globalConfig.USER_AGENT);

                    if (detail) {
                        // C. Persistence: Process and save via unified service (includes dictionary annotation)
                        await saveToDatabase({
                            ...detail,
                            originalUrl: url,
                            siteName: source.siteName,
                            category: source.category,
                            sourceId: source._id,
                            originalDate: detail.originalDate || detail.date
                        });

                        successCount++;
                    }
                } catch (err) {
                    failCount++;
                    console.error(chalk.red(`❌ Error at ${url}: ${err.message}`));
                } finally {
                    totalProcessed++;
                    // D. Progress Tracking: Update Task status in real-time
                    await Task.findByIdAndUpdate(taskId, {
                        processedCount: totalProcessed,
                        successCount,
                        failCount
                    });
                }
            }
            // Update the category's last crawl timestamp
            await Source.findByIdAndUpdate(sourceId, { lastCrawledAt: new Date() });
        }

        // 5. Finalize: Mark task as completed
        await Task.findByIdAndUpdate(taskId, {
            status: 'completed',
            completedAt: new Date()
        });
        console.log(chalk.bold.green(`\n🏁 Task Finished. Success: ${successCount}, Fail: ${failCount}`));

    } catch (criticalError) {
        // Handle unexpected engine crashes
        await Task.findByIdAndUpdate(taskId, {
            status: 'failed',
            errorLog: criticalError.message
        });
        console.error(chalk.bgRed.white(' CRITICAL ERROR '), criticalError.stack);
    }
}
module.exports = { runCrawlerEngine };