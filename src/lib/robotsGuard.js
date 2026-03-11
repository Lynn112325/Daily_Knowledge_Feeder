const axios = require('axios');
const robotsParser = require('robots-parser');
const chalk = require('chalk');

/**
 * Validates crawling permission for a specific URL based on robots.txt
 * @param {string} targetUrl - The page URL to scrape
 * @param {string} userAgent - Bot name identifier
 */
async function isAllowed(targetUrl, userAgent = '*') {
    try {
        const urlObj = new URL(targetUrl);
        // Construct the robots.txt location (must be at the root)
        const robotsUrl = `${urlObj.origin}/robots.txt`;

        console.log(chalk.gray(`\n🤖 Checking compliance: ${robotsUrl}`));

        // Fetch robots.txt content with a 5s timeout
        const { data: robotsTxt } = await axios.get(robotsUrl, { timeout: 5000 });

        // Parse the rules
        const robots = robotsParser(robotsUrl, robotsTxt);

        // Check if our Bot is allowed to access this specific path
        const allowed = robots.isAllowed(targetUrl, userAgent);

        // Retrieve optional crawl-delay specified by the server
        const crawlDelay = robots.getCrawlDelay(userAgent);

        if (allowed) {
            console.log(chalk.green(`✅ Access Granted: ${targetUrl}`));
            if (crawlDelay) {
                console.log(chalk.yellow(`⏳ Notice: Site requests a ${crawlDelay}s delay.`));
            }
        } else {
            console.log(chalk.red(`🚫 Access Denied: robots.txt forbids this path!`));
        }

        return { allowed, crawlDelay };
    } catch (error) {
        // Fallback: If robots.txt is missing (404), crawling is usually permitted by default
        console.log(chalk.yellow(`⚠️ robots.txt not found. Proceeding with caution.`));
        return { allowed: true, crawlDelay: null };
    }
}

module.exports = { isAllowed };