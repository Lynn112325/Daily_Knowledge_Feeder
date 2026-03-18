const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');
const Source = require('../models/Source');
const { isAllowed } = require('../lib/robotsGuard');

// Helper to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Synchronizes website categories from a strategy into the MongoDB database.
 */
async function syncCategories(strategy, userAgent) {
    console.log(chalk.blue(`🔍 Initiating discovery for: ${strategy.name}...`));

    try {
        // 1. Compliance: Check robots.txt permissions
        const { allowed, crawlDelay } = await isAllowed(strategy.listConfig.baseUrl, userAgent);

        if (!allowed) {
            console.log(chalk.red(`🚫 Access denied by robots.txt: ${strategy.listConfig.baseUrl}`));
            return;
        }

        // 2. Action: Fetch HTML (The Manager handles networking)
        const { data } = await axios.get(strategy.listConfig.baseUrl, {
            headers: { 'User-Agent': userAgent }
        });
        const $ = cheerio.load(data);

        // 3. Rules: Use the Strategy to parse the HTML (Pure logic)
        const discoveredSources = strategy.discoverRules($);

        let newCount = 0;
        let updateCount = 0;

        // 4. Database Persistence (Upsert)
        for (const sourceData of discoveredSources) {
            // Ensure baseUrl is present (fallback to strategy config)
            if (!sourceData.baseUrl) sourceData.baseUrl = strategy.listConfig.baseUrl;

            const result = await Source.updateOne(
                { baseUrl: sourceData.baseUrl, path: sourceData.path },
                { $set: sourceData },
                { upsert: true }
            );

            if (result.upsertedCount > 0) {
                newCount++;
            } else if (result.modifiedCount > 0) {
                updateCount++;
            }
        }

        console.log(chalk.green(`✅ ${strategy.name} sync complete!`));
        console.log(`   - New categories added: ${newCount}`);
        console.log(`   - Existing categories updated: ${updateCount}`);

    } catch (error) {
        console.error(chalk.red(`❌ Error syncing categories for ${strategy.name}:`), error.message);
    }
}

module.exports = { syncCategories };