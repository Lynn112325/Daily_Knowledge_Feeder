const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');

/**
 * Dynamically discovers news categories from the ScienceDaily homepage navigation menu.
 * @param {Object} strategy - The scraping strategy object to be assigned to each source.
 * @returns {Promise<Array>} - A list of unique source objects.
 */
async function discoverScienceDailySources(strategy) {
    const HOMEPAGE = 'https://www.sciencedaily.com/';
    const USER_AGENT = 'KnowledgeFeederBot/1.0';

    // Using a Map to ensure global uniqueness across different dropdown sections
    const uniqueSourcesMap = new Map();

    // Keywords to exclude from the category list to keep the data clean
    const EXCLUDED_LABELS = new Set([
        'Home Page',
        'Top Science News',
        'Latest News',
        'more topics',
        '... more topics'
    ]);

    try {
        console.log(chalk.blue(`🌐 Initiating discovery at: ${HOMEPAGE}`));

        const { data } = await axios.get(HOMEPAGE, {
            headers: { 'User-Agent': USER_AGENT }
        });
        const $ = cheerio.load(data);

        // Targeted selector for the Yamm Mega-Menu structure
        $('.nav.navbar-nav > li.dropdown').each((_, dropdown) => {
            // Extract the top-level menu label (e.g., Health, Tech, Society)
            const mainCategory = $(dropdown).find('> a.dropdown-toggle').text().trim();

            // Skip the Home dropdown and non-news sections
            if (!mainCategory || mainCategory === 'Home') return;

            // Find all sub-category links within the current dropdown
            $(dropdown).find('a[role="menuitem"]').each((_, item) => {
                const name = $(item).text().trim();
                const relativeUrl = $(item).attr('href');

                // Optimization: Combined filtering logic
                // 1. Must have a valid relative URL starting with /news/
                // 2. Must not be in our exclusion list
                if (
                    !relativeUrl ||
                    !relativeUrl.startsWith('/news/') ||
                    EXCLUDED_LABELS.has(name) ||
                    name === ''
                ) {
                    return;
                }

                // Resolve absolute URL safely
                const fullUrl = new URL(relativeUrl, HOMEPAGE).href;

                // De-duplication check: Only add if the URL hasn't been processed yet
                if (!uniqueSourcesMap.has(fullUrl)) {
                    uniqueSourcesMap.set(fullUrl, {
                        name: `SD: ${mainCategory} > ${name}`,
                        source: strategy,
                        listUrl: fullUrl,
                        mainCategory: mainCategory,
                        category: name,
                        enabled: true // Default to enabled for dynamic discovery
                    });
                }
            });
        });

        const result = Array.from(uniqueSourcesMap.values());
        console.log(chalk.green(`✅ Discovery complete. Found ${result.length} unique sections.`));

        return result;

    } catch (error) {
        console.error(chalk.red(`❌ Discovery failed: ${error.message}`));
        return [];
    }
}

module.exports = { discoverScienceDailySources };