const he = require('he');
const axios = require('axios');
const cheerio = require('cheerio');

// Strategy for ScienceDaily - Defines how to find and extract data
const scienceDailyStrategy = {
    name: 'ScienceDaily',
    domain: 'sciencedaily.com',
    strategyKey: 'scienceDaily',

    // Rules for the LIST page (Where the links are)
    listConfig: {
        container: '.latest-head',   // Each article entry block
        linkSelector: 'a',          // The link inside the block
        baseUrl: 'https://www.sciencedaily.com',
        limit: null
    },

    // Rules for the source table
    discoverRules($) {
        const uniqueSourcesMap = new Map();
        const EXCLUDED_LABELS = new Set(['Home Page', 'Top Science News', 'Latest News', 'more topics', 'Top News']);

        $('.nav.navbar-nav > li.dropdown').each((_, dropdown) => {
            const mainCategory = $(dropdown).find('> a.dropdown-toggle').text().trim();
            if (!mainCategory || mainCategory === 'Home') return;

            $(dropdown).find('a[role="menuitem"]').each((_, item) => {
                const name = $(item).text().trim() || '';
                const relativeUrl = $(item).attr('href');

                if (!relativeUrl || !relativeUrl.startsWith('/news/') || EXCLUDED_LABELS.has(name) || name === '') return;

                if (!uniqueSourcesMap.has(relativeUrl)) {
                    uniqueSourcesMap.set(relativeUrl, {
                        siteName: this.name,
                        baseUrl: this.listConfig.baseUrl,
                        strategyKey: this.strategyKey,
                        path: relativeUrl,
                        category: `/${mainCategory}/${name}`.replace(/\s+/g, ' ').trim(),
                        isActive: true
                    });
                }
            });
        });
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