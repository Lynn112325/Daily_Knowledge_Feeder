const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');
const { fetchArticleDetail } = require('./detailScraper'); // Get content from a single page
const { saveToMarkdown } = require('./exportService');    // Save data to .md file
const { isAllowed } = require('./robotsGuard');            // Check if scraping is allowed

// Target website configuration
const SOURCE = {
    name: 'ScienceDaily',
    url: 'https://www.sciencedaily.com/news/top/science/',
    baseUrl: 'https://www.sciencedaily.com'
};

// Tool: Wait for some time to avoid being blocked by the server
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchDailyKnowledge() {
    console.log(chalk.bold.cyan(`\n🚀 Task Started: ${SOURCE.name}`));
    const userAgent = 'KnowledgeFeederBot/1.0'; // Identity of our crawler

    try {
        // --- 1. Fetch the List Page ---
        console.log(chalk.blue(`📡 Getting the latest article list...`));
        const { data } = await axios.get(SOURCE.url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const $ = cheerio.load(data);
        const urlList = [];

        // Find all article links on the main list
        $('.latest-head').each((i, el) => {
            if (i >= 3) return false; // Only take 3 articles for testing (MVP)
            const href = $(el).find('a').attr('href');
            if (href) {
                // Fix relative URL to full URL
                const fullUrl = href.startsWith('http') ? href : `${SOURCE.baseUrl}${href}`;
                urlList.push(fullUrl);
            }
        });

        console.log(chalk.yellow(`✅ Found ${urlList.length} links.`));

        // --- 2. Loop through each link to get details ---
        for (const url of urlList) {
            console.log(chalk.gray(`\n------------------------------------------`));

            // A. Compliance Check: Is it okay to scrape this URL?
            const { allowed, crawlDelay } = await isAllowed(url, userAgent);
            if (!allowed) {
                console.log(chalk.bgRed.white(` 🚫 Blocked: Robots.txt forbids this URL: ${url} `));
                continue; // Skip to next article
            }

            // B. Politeness: Wait if the website requested a delay
            if (crawlDelay) {
                console.log(chalk.dim(`⏳ Waiting ${crawlDelay}s as requested by robots.txt...`));
                await sleep(crawlDelay * 1000);
            }

            // C. Scraping: Get full details (Title, Content, Images, Tags)
            console.log(chalk.blue(`🔎 Parsing content: ${url}`));
            const detail = await fetchArticleDetail(url);

            if (detail) {
                // D. Export: Convert data into a formatted Markdown file
                saveToMarkdown(detail);
                console.log(chalk.green(`✨ Success: [${detail.title.substring(0, 20)}...] exported!`));
            }

            // E. Anti-Bot: Rest for 2 seconds to avoid stressing the server
            console.log(chalk.dim(`💤 Cooling down for 2s...`));
            await sleep(2000);
        }

        console.log(chalk.bold.bgMagenta.white('\n 🎉 All tasks completed! Check your /output folder. '));

    } catch (error) {
        // Log any critical errors during the process
        console.error(chalk.red(`❌ Process failed: ${error.message}`));
    }
}

// Start the engine
fetchDailyKnowledge();