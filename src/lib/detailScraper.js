const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');
const he = require('he');
const TurndownService = require('turndown'); // 1. Library to convert HTML to Markdown

// 2. Initialize Turndown with custom rules for better formatting
const turndownService = new TurndownService({
    headingStyle: 'atx',       // Use # for headers
    hr: '---',                 // Use --- for horizontal lines
    bulletListMarker: '-',     // Use - for lists
    codeBlockStyle: 'fenced'   // Use ``` for code blocks
});

/**
 * Fetch and parse a single article's detailed content
 */
async function fetchArticleDetail(url) {
    try {
        // GET request to the article URL
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' } // Pretend to be a browser
        });

        const $ = cheerio.load(data); // Load HTML into Cheerio
        const baseUrl = '[https://www.sciencedaily.com](https://www.sciencedaily.com)';

        // --- 1. Image Extraction (Handles responsive <figure> tags) ---
        const imgElement = $('figure.mainimg img');
        const srcset = imgElement.attr('srcset');
        let imagePath = '';

        if (srcset) {
            // Get the high-resolution image from the srcset list
            const sources = srcset.split(',');
            imagePath = sources[sources.length - 1].trim().split(' ')[0];
        } else {
            // Fallback to standard src attribute
            imagePath = imgElement.attr('src');
        }

        // Ensure the image URL is absolute (starts with https://)
        const image = imagePath ? (imagePath.startsWith('http') ? imagePath : baseUrl + imagePath) : 'No Image Found';

        // --- 2. Summary Extraction ---
        // Use caption if available, otherwise use the abstract
        const figCaption = $('figcaption').text().trim();
        const abstract = $('#abstract').text().trim();
        const summary = figCaption || abstract || 'No summary available';

        // --- 3. Tags/Keywords Extraction ---
        const rawKeywords = $('meta[name="keywords"]').attr('content') || "";
        const keywords = rawKeywords
            ? he.decode(he.decode(rawKeywords))
                .split(';')
                .map(k => k.trim())
                .filter(k => k !== "")
            : [];
        // --- 4. Category Extraction (From Breadcrumbs) ---
        let category = $('meta[property="article:section"]').attr('content') ||
            (keywords.length > 0 ? keywords[keywords.length - 1] : "General");


        // --- 5. Main Body Content (HTML to Markdown) ---
        const rawHtmlContent = $('#text').html(); // Get raw HTML of the body
        let markdownContent = '';

        if (rawHtmlContent) {
            // Clean up the HTML: Remove ads or scripts inside the text if any
            // $('#text .ad-box').remove(); 

            // Convert the cleaned HTML to clean Markdown
            markdownContent = turndownService.turndown(rawHtmlContent);
        } else {
            markdownContent = 'Content not found.';
        }

        // Return structured data object
        return {
            title: $('#headline').text().trim(),
            summary: summary,
            date: $('#date_posted').text().trim(),
            author: $('#source').text().trim().replace(/Source:|By /gi, '').trim(),
            image: image,
            keywords: keywords,
            category: category,
            content: markdownContent, // This is now pretty Markdown text
            fullUrl: url
        };

    } catch (error) {
        console.error(chalk.red(`❌ Scraper Error [${url}]: ${error.message}`));
        return null;
    }
}

module.exports = { fetchArticleDetail };