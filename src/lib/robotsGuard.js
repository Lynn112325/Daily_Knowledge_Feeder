const axios = require('axios');
const robotsParser = require('robots-parser');
const chalk = require('chalk');
const globalConfig = require('./global');

/**
 * Validates crawling permission for a specific URL based on robots.txt.
 * Handles User-agent, Allow/Disallow, and Crawl-delay rules.
 * * @param {string} targetUrl - The specific page URL to check.
 * @param {string} userAgent - Your bot's name (defaults to '*' for all bots).
 */
async function isAllowed(targetUrl) {
    try {
        const urlObj = new URL(targetUrl);
        // robots.txt must always be located at the root of the domain
        const robotsUrl = `${urlObj.origin}/robots.txt`;

        console.log(chalk.blue.bold(`\n🔍 Checking Robots Compliance: ${robotsUrl}`));

        // 1. Fetch robots.txt with a timeout and a descriptive User-Agent
        const response = await axios.get(robotsUrl, {
            timeout: 5000,
            headers: { 'User-Agent': globalConfig.USER_AGENT }
        }).catch(err => err.response); // Capture error response for status check

        // 2. Handle missing robots.txt (404)
        // Per standard conventions, if robots.txt is missing, the whole site is crawlable.
        if (!response || response.status === 404) {
            console.log(chalk.yellow(`⚠️  robots.txt not found (404). Defaulting to ALLOW ALL.`));
            return { allowed: true, crawlDelay: 0 };
        }

        // 3. Parse the content
        const robotsTxtContent = response.data;
        const robots = robotsParser(robotsUrl, robotsTxtContent);

        // 4. Evaluate Rules (User-agent, Allow, and Disallow)
        // robots-parser automatically handles 'Allow' vs 'Disallow' priority
        const allowed = robots.isAllowed(targetUrl, userAgent);
        const crawlDelay = robots.getCrawlDelay(userAgent) || 0;

        // 5. Visual Feedback for the user
        if (allowed) {
            console.log(chalk.green(`✅ Access Granted for [${userAgent}]`));
            console.log(chalk.gray(`   Target: ${targetUrl}`));

            // Handle Crawl-delay
            if (crawlDelay > 0) {
                console.log(chalk.cyan(`   ⏳ Crawl-delay detected: ${crawlDelay}s. Please respect this interval.`));
            }
        } else {
            console.log(chalk.red(`🚫 Access Denied for [${userAgent}]`));
            console.log(chalk.red(`   Reason: This path is blocked by a Disallow rule in robots.txt.`));
        }

        return {
            allowed,
            crawlDelay,
            sitemaps: robots.getSitemaps() // Bonus: returns sitemaps if listed
        };

    } catch (error) {
        // Handle unexpected errors (e.g., DNS failure, invalid URL)
        console.log(chalk.bgRed(`💥 Error validating robots.txt: ${error.message}`));
        return { allowed: false, crawlDelay: null, error: error.message };
    }
}

module.exports = { isAllowed };