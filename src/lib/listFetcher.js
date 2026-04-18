const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');
const { logToUI } = require('./emitLog');

/**
 * Generic list scraper
 * @param {string} listUrl - URL of the listing page
 * @param {Object} config - Selectors defined in strategy (container, linkSelector, baseUrl)
 * @param {string} userAgent
 */
async function getList(listUrl, config, userAgent) {
    try {
        // 1. Execute the HTTP GET request
        const { data } = await axios.get(listUrl, {
            headers: {
                'User-Agent': userAgent,
                // Add Referer to bypass basic anti-scraping checks
                'Referer': config.baseUrl
            },
            // Set a 10-second limit before timing out
            timeout: 10000
        });

        // 2. Load the response into Cheerio (handles HTML and XML fragments)
        const $ = cheerio.load(data, {
            xml: {
                decodeEntities: true,
            }
        }, false);

        // 3. Use a Set to store unique URLs found on the page
        const urlSet = new Set();

        let elements;

        // Check if a specific container exists; if not, search the whole document
        if (config.container && $(config.container).length > 0) {
            elements = $(config.container).find(config.linkSelector);
        } else {
            // Default to using the link selector directly (usually 'a' tags)
            elements = $(config.linkSelector);
        }

        // Iterate through found elements to extract links
        elements.each((i, el) => {
            let href = $(el).attr('href');
            if (!href) return;

            // 4. Keyword Filtering (Inclusion)
            // If keywords are defined (e.g., ['/releases/']), the link must contain one
            if (config.includeKeywords && config.includeKeywords.length > 0) {
                const isMatch = config.includeKeywords.some(key => href.includes(key));
                if (!isMatch) return;
            }

            // 5. Keyword Filtering (Exclusion)
            // Skip links containing unwanted patterns (e.g., ['/news/'])
            if (config.excludeKeywords && config.excludeKeywords.length > 0) {
                const isExcluded = config.excludeKeywords.some(key => href.includes(key));
                if (isExcluded) return;
            }

            // 6. URL Completion
            // If the link is relative, convert it to an absolute URL
            let fullUrl = href;
            if (!href.startsWith('http')) {
                // Ensure no double slashes are created during concatenation
                const base = config.baseUrl.replace(/\/$/, "");
                const path = href.startsWith('/') ? href : `/${href}`;
                fullUrl = `${base}${path}`;
            }

            // Add the finalized URL to our set
            urlSet.add(fullUrl);
        });

        const result = Array.from(urlSet);

        // Log the outcome of the search
        if (result.length > 0) {
            await logToUI(chalk.gray(`      🔎 ListFetcher found ${result.length} valid links.`));
        } else {
            await logToUI(chalk.yellow(`      ⚠️ ListFetcher: No valid links found at ${listUrl}`));
        }

        return result;

    } catch (error) {
        // Handle server-side (4xx/5xx) or general network errors
        let errorMsg = error.message;
        if (error.response) {
            errorMsg = `Server Error [${error.response.status}]`;
        }

        await logToUI(chalk.red(`❌ getList Error: ${errorMsg} at ${listUrl}`));

        throw new Error(`Failed to fetch list: ${errorMsg}`);
    }
}

module.exports = { getList };