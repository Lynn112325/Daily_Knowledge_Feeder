// src/lib/sourceManager.js
const Source = require('../models/Source');

/**
 * Synchronizes website categories from a strategy into the MongoDB database.
 * @param {Object} strategy - The site-specific strategy (e.g., scienceDaily).
 * @param {String} userAgent - Browser identifier for the HTTP request.
 */
async function syncCategories(strategy, userAgent) {
    console.log(`🔍 Discovering latest categories for: ${strategy.name}...`);

    try {
        // 1. Execute the discovery logic defined in the strategy file
        const discoveredSources = await strategy.discover(userAgent);

        let newCount = 0;
        let updateCount = 0;

        // 2. Iterate through each discovered category path
        for (const data of discoveredSources) {

            // Double-check: ensure baseUrl is present to avoid 'null' in DB
            if (!data.baseUrl) data.baseUrl = strategy.baseUrl;

            // 3. Perform an "Upsert" (Update if exists, Insert if new)
            // We identify uniqueness by combining baseUrl and the specific path
            const result = await Source.updateOne(
                { baseUrl: data.baseUrl, path: data.path }, // Search criteria
                { $set: data },                             // Data to write
                { upsert: true }                            // Create if not found
            );

            // 4. Track statistics for the console output
            if (result.upsertedCount > 0) {
                newCount++;
            } else if (result.modifiedCount > 0) {
                updateCount++;
            }
        }

        console.log(`✅ ${strategy.name} sync complete!`);
        console.log(`   - New categories added: ${newCount}`);
        console.log(`   - Existing categories updated: ${updateCount}`);

    } catch (error) {
        console.error(`❌ Error syncing categories for ${strategy.name}:`, error.message);
    }
}

module.exports = { syncCategories };