const chalk = require('chalk');
const { scrapeArticle } = require('./lib/scraperEngine');
const { saveToMarkdown } = require('./lib/exportService');
const { isAllowed } = require('./lib/robotsGuard');
const { getList } = require('./lib/listFetcher');
const { SOURCES, USER_AGENT } = require('./config/sources');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTasks() {
    const activeSources = SOURCES.filter(s => s.enabled);

    for (const task of activeSources) {
        // Use task-specific UA if it exists, otherwise use global default
        const currentUA = task.userAgent || USER_AGENT;

        console.log(chalk.bold.cyan(`\n🚀 Starting Task: ${task.name}`));

        try {
            const urlList = await getList(task.listUrl, task.source.listConfig);
            console.log(chalk.yellow(`✅ Found ${urlList.length} links.`));

            for (const url of urlList) {
                console.log(chalk.gray(`\n------------------------------------------`));

                // A. Compliance Check
                const { allowed, crawlDelay } = await isAllowed(url, currentUA);
                if (!allowed) {
                    console.log(chalk.red(`🚫 Skipping (Disallowed by robots.txt): ${url}`));
                    continue;
                }

                // B. Politeness Delay
                const waitTime = crawlDelay ? crawlDelay * 1000 : 2000;
                console.log(chalk.dim(`⏳ Waiting ${waitTime / 1000}s...`));
                await sleep(waitTime);

                // C. Scraping
                console.log(chalk.blue(`🔎 Scraping: ${url}`));
                const detail = await scrapeArticle(url, task.source);

                if (detail) {
                    // D. Export
                    saveToMarkdown(detail);
                    console.log(chalk.green(`✨ Success: [${detail.title.substring(0, 30)}...]`));
                }
            }
            console.log(chalk.bold.green(`\n✅ Task [${task.name}] Finished!`));
        } catch (error) {
            console.error(chalk.red(`❌ Task [${task.name}] Failed: ${error.message}`));
        }
    }
    console.log(chalk.bold.bgMagenta.white('\n 🎉 ALL MISSIONS ACCOMPLISHED '));
}

runTasks();