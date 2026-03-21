// Fetches HTML and extracts full article URLs into an array based on strategy rules.

const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');

/**
 * Generic list scraper
 * @param {string} listUrl - URL of the listing page
 * @param {Object} config - Selectors defined in strategy (container, linkSelector, baseUrl)
 * @param {string} userAgent
 */
async function getList(listUrl, limit, config, userAgent) {
    try {
        const { data } = await axios.get(listUrl, {
            headers: { 'User-Agent': userAgent }
        });
        const $ = cheerio.load(data);
        const urlList = [];

        // Find elements using the strategy's selectors
        $(config.container).each((i, el) => {
            // Apply limit to prevent excessive scraping during testing/MVP
            if (limit && i >= limit) return false;

            const href = $(el).find(config.linkSelector).attr('href');
            if (href) {
                // Auto-complete absolute paths if the link is relative
                const fullUrl = href.startsWith('http')
                    ? href
                    : `${config.baseUrl}${href}`;
                urlList.push(fullUrl);
            }
        });

        return urlList;
    } catch (error) {
        console.error(chalk.red(`❌ Failed to fetch list [${listUrl}]: ${error.message}`));
        return [];
    }
}

module.exports = { getList };