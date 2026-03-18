const he = require('he');
const axios = require('axios');
const cheerio = require('cheerio');

// Strategy for ScienceDaily - Defines how to find and extract data
const EXCLUDED_LABELS = new Set(['Home Page', 'Top Science News', 'Latest News', 'more topics', 'Top News']);
const scienceDailyStrategy = {
    name: 'ScienceDaily',
    domain: 'sciencedaily.com',

    // Rules for the LIST page (Where the links are)
    listConfig: {
        container: '.latest-head',   // Each article entry block
        linkSelector: 'a',          // The link inside the block
        baseUrl: 'https://www.sciencedaily.com',
        limit: 3                    // Only process 3 articles for testing
    },

    /**
         * Discover all news categories from the website navigation menu.
         */
    async discover(userAgent) {
        // Map to store unique sources and prevent duplicates
        const uniqueSourcesMap = new Map();

        // List of menu labels we want to ignore
        const EXCLUDED_LABELS = new Set(['Home Page', 'Top Science News', 'Latest News', 'more topics', 'Top News']);

        // Fetch the HTML from the website's base URL
        const { data } = await axios.get(this.listConfig.baseUrl, {
            headers: { 'User-Agent': userAgent }
        });

        // Load the HTML into Cheerio for easy selection
        const $ = cheerio.load(data);

        // Loop through each dropdown menu in the navigation bar
        $('.nav.navbar-nav > li.dropdown').each((_, dropdown) => {
            // Get the text of the main menu item (e.g., 'Health', 'Tech')
            const mainCategory = $(dropdown).find('> a.dropdown-toggle').text().trim();

            // Skip the menu if it's empty or the 'Home' section
            if (!mainCategory || mainCategory === 'Home') return;

            // Loop through each sub-category link inside the dropdown
            $(dropdown).find('a[role="menuitem"]').each((_, item) => {
                // Get the sub-category name and its URL path
                const name = $(item).text().trim() || '';
                const relativeUrl = $(item).attr('href');

                // Filter: Only keep valid news paths and skip excluded labels
                if (!relativeUrl || !relativeUrl.startsWith('/news/') || EXCLUDED_LABELS.has(name) || name === '') return;

                const fullPath = relativeUrl;

                // If this path is new, add it to our map
                if (!uniqueSourcesMap.has(fullPath)) {
                    uniqueSourcesMap.set(fullPath, {
                        siteName: this.name,
                        baseUrl: this.listConfig.baseUrl,
                        strategyKey: this.strategyKey,
                        path: fullPath,
                        // Construct the display category (e.g., "/Health/Allergy")
                        categoryPath: `/${mainCategory}/${name}`.replace(/\s+/g, ' ').trim(),
                        isActive: true
                    });
                }
            });
        });

        // Convert the Map into an Array to return the results
        return Array.from(uniqueSourcesMap.values());
    },

    // Rules for the ARTICLE page (Where the content is)
    extract: function ($) {
        // 1. Basic Metadata
        const title = $('#headline').text().trim();
        const date = $('#date_posted').text().trim();
        // Remove "Source:" or "By" from author name
        const author = $('#source').text().trim().replace(/Source:|By /gi, '').trim();

        // 2. Tag Extraction (Meta tags)
        const rawKeywords = $('meta[name="keywords"]').attr('content') || "";
        const keywords = rawKeywords
            ? he.decode(he.decode(rawKeywords)) // Fix double HTML encoding (e.g., &amp;)
                .split(';')                     // Split string by semicolon
                .map(k => k.trim())             // Remove spaces
                .filter(k => k !== "")          // Remove empty items
            : [];

        // 3. Image Handling (Supports Responsive Images)
        const imgElement = $('figure.mainimg img');
        const srcset = imgElement.attr('srcset');

        // Get the best quality image from srcset, otherwise use src
        let imagePath = srcset
            ? srcset.split(',').pop().trim().split(' ')[0]
            : imgElement.attr('src');

        // Ensure URL starts with https://
        const image = imagePath ? (imagePath.startsWith('http') ? imagePath : `https://www.sciencedaily.com${imagePath}`) : '';

        // 4. Return Clean Data
        // rawHtmlContent is passed to the engine to be converted into Markdown later
        return {
            title,
            date,
            author,
            keywords,
            image,
            summary: $('figcaption').text().trim() || $('#abstract').text().trim(),
            rawHtmlContent: $('#text').html()
        };
    }

};

module.exports = scienceDailyStrategy;