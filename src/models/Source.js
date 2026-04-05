const mongoose = require('mongoose');

/**
 * Source Schema
 * Defines where the crawler should go to find new articles.
 */
const sourceSchema = new mongoose.Schema({
    // Display name of the website (e.g., 'ScienceDaily')
    siteName: { type: String, required: true },
    // The root URL of the site (e.g., 'https://www.sciencedaily.com')
    baseUrl: { type: String, required: true },
    // Identifier to link this DB entry to a specific JS scraping file
    strategyKey: { type: String, required: true },

    // Human-readable category path for UI/Filtering (e.g., "/Health/Allergy")
    category: { type: String, required: true },
    // The specific URL path to crawl (e.g., '/news/health/allergy')
    path: { type: String, required: true },

    // Toggle to enable or disable this specific crawling task
    isActive: { type: Boolean, default: true },
    // Timestamp of the last successful crawl to prevent over-crawling
    lastCrawledAt: { type: Date, default: null },

    isInitialized: { type: Boolean, default: false },
    // --- Backfill Progression ---
    lastProcessedUnit: { type: Number, default: 1 }, // Current bookmark for backfill
    isBackfillCompleted: { type: Boolean, default: false }, // Flag for historical data completion

}, {
    // Automatically creates 'createdAt' and 'updatedAt' fields
    timestamps: true
});

sourceSchema.index({ baseUrl: 1, path: 1 }, { unique: true });

// Export the Model
const Source = mongoose.model('Source', sourceSchema);
module.exports = Source;