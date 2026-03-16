/**
 * Source Factory: Converts raw data into a standardized list of scraping tasks.
 * @param {Object} strategy - Shared logic for how to crawl the site.
 * @param {Object} categoryMap - Data containing main categories and sub-paths.
 * @param {String} baseUrl - The root URL of the website.
 * @param {String} prefix - Label for the task name (default: 'SD').
 */
function createStandardConfig({ strategy, categoryMap, baseUrl, prefix = 'SD' }) {

    // Loop through the category map to build an array of source objects
    const sources = Object.entries(categoryMap).flatMap(([main, items]) =>
        items.map(item => ({
            // Create a readable name, e.g., "SD: Tech > AI"
            name: `${prefix}: ${main} > ${item.sub}`,

            // Format the URL and ensure it ends with a single slash
            listUrl: `${baseUrl}/${item.path}/`.replace(/\/+$/, '/'),

            mainCategory: main,
            category: item.sub,
            strategy: strategy,
            enabled: true
        }))
    );

    // Return the final configuration object used by the crawler
    return {
        strategy,
        sources,
        userAgent: 'KnowledgeFeederBot/1.0'
    };
}

module.exports = { createStandardConfig };