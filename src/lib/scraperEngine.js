const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');
const TurndownService = require('turndown');

const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
});

/**
 * Core scraping engine
 * @param {string} url - Target article URL
 * @param {Object} strategy - Website-specific parsing strategy
 */
async function scrapeArticle(url, strategy) {
    try {
        // Fetch page data with a basic User-Agent
        const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);

        // 1. Execute strategy: Use the strategy module to parse the DOM
        console.log(chalk.blue(`Executing strategy: ${strategy.name}...`));
        const extractedData = strategy.extract($);

        // 2. Conversion: Turn raw HTML content into Markdown
        let markdownContent = 'Content not found.';
        if (extractedData.rawHtmlContent) {
            markdownContent = turndownService.turndown(extractedData.rawHtmlContent);
        }

        // 3. Assemble final object
        return {
            ...extractedData,
            content: markdownContent,
            fullUrl: url,
            rawHtmlContent: undefined // Remove raw HTML to save memory
        };

    } catch (error) {
        console.error(chalk.red(`❌ Scrape failed [${url}]: ${error.message}`));
        return null;
    }
}

module.exports = { scrapeArticle };