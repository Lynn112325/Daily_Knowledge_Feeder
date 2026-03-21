const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');
const TurndownService = require('turndown');

// --- Turndown Configuration ---
// Converts HTML to clean Markdown
const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
});

/**
 * Rule: compactLinks
 * Collapses <a> tags containing <img> into a single line to prevent 
 * Turndown from inserting unwanted block breaks.
 */
turndownService.addRule('compactLinks', {
    filter: (node) => node.nodeName === 'A' && node.querySelector('img'),
    replacement: function (content, node) {
        const href = node.getAttribute('href');
        const cleanContent = content.replace(/\n/g, '').trim();
        return `[${cleanContent}](${href})`;
    }
});

/**
 * Rule: fixBoldTitles
 * Detects bold text acting as a header (e.g., a single bold line in a <p>)
 * and converts it into a Markdown H3 (###).
 */
turndownService.addRule('fixBoldTitles', {
    filter: (node) => {
        const isBold = node.nodeName === 'STRONG' || node.nodeName === 'B';
        const isShort = node.textContent.length < 100;
        // Check if the bold tag is the only child of a paragraph
        const isBlockLike = node.parentNode.nodeName === 'P' && node.parentNode.childNodes.length === 1;

        return isBold && isShort && isBlockLike;
    },
    replacement: function (content) {
        return `\n\n### ${content.trim()}\n\n`;
    }
});

/**
 * Core Scraper Engine
 * @param {string} url - Target URL to scrape
 * @param {Object} strategy - Website-specific parsing logic
 * @param {string} userAgent - Browser identity string for request
 */
async function scrapeArticle(url, strategy, userAgent) {
    try {
        // 1. Fetch Web Page: Use axios with a custom User-Agent
        const { data } = await axios.get(url, { headers: { 'User-Agent': userAgent } });
        const $ = cheerio.load(data);

        // 2. Extract Data: Run the site-specific strategy
        console.log(chalk.blue(`Executing strategy: ${strategy.name}...`));
        const extractedData = strategy.extract($);

        // 3. HTML to Markdown: Convert the main content body
        let markdownContent = 'Content not found.';
        if (extractedData.rawHtmlContent) {
            markdownContent = turndownService.turndown(extractedData.rawHtmlContent);
        }

        // 4. Clean Up: Assemble final object and release raw HTML memory
        return {
            ...extractedData,
            content: markdownContent,
            originalUrl: url,
        };

    } catch (error) {
        console.error(chalk.red(`❌ Scrape failed [${url}]: ${error.message}`));
        return null;
    }
}

module.exports = { scrapeArticle };