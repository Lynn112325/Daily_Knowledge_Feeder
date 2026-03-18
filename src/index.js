const chalk = require('chalk');
const { scrapeArticle } = require('./lib/scraperEngine');
const { saveToMarkdown } = require('./lib/exportService');
const { isAllowed } = require('./lib/robotsGuard');
const { getList } = require('./lib/listFetcher');
const { SOURCES } = require('./config/index');
const globalConfig = require('./config/global');
// const { discoverScienceDailySources } = require('./config/discoverSources');
// const { saveSourcesToStaticFile } = require('./config/saveSourcesToStaticFile');

// Helper to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTasks() {
    // let allSources = await discoverScienceDailySources(scienceDailyStrategy);
    // console.log(allSources);
    // if (allSources.length > 0) {
    //     saveSourcesToStaticFile(allSources, 'scienceDaily');
    // } else {
    //     console.log("Discovery failed or returned empty results.");
    // }
    // 1. Filter only enabled sources from the config
    const activeSources = SOURCES.filter(s => s.enabled);

    for (const task of activeSources) {
        console.log(chalk.bold.cyan(`\n🚀 Task: ${task.name}`));

        try {
            // 2. Fetch the list of article URLs using the site-specific strategy
            const urlList = await getList(task.listUrl, task.strategy.listConfig, globalConfig.USER_AGENT);

            for (const url of urlList) {
                // A. Compliance: Check robots.txt permissions
                const { allowed, crawlDelay } = await isAllowed(url, globalConfig.USER_AGENT);
                if (!allowed) {
                    console.log(chalk.yellow(`⏩ Skipping blocked URL: ${url}`));
                    continue;
                }

                // B. Politeness: Wait based on robots.txt delay or a default 2s
                const waitTime = crawlDelay ? crawlDelay * 1000 : 2000;
                await sleep(waitTime);

                // C. Crawl: Extract full article details
                const detail = await scrapeArticle(url, task.strategy, globalConfig.USER_AGENT);

                if (detail) {
                    // D. Metadata Injection: Add category info from task for folder organization
                    detail.mainCategory = task.mainCategory;
                    detail.category = task.category;

                    // E. Export: Save the result as a Markdown file
                    saveToMarkdown(detail);
                    console.log(chalk.green(`✨ Saved: ${detail.title.substring(0, 40)}...`));
                }
            }
        } catch (error) {
            console.error(chalk.red(`❌ Failed: ${task.name} -> ${error.message}`));
        }
    }
}

runTasks();