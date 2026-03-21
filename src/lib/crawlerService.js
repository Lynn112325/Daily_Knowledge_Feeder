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
            const urlList = await getList(fullListUrl, limitPerCategory, currentStrategy.listConfig, globalConfig.USER_AGENT);

            if (!urlList || urlList.length === 0) {
                console.log(chalk.yellow(`⚠️ No articles found.`));
                continue;
            }

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