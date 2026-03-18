const mongoose = require('mongoose');

/**
 * Article Schema
 * Stores the actual news content scraped from various sources.
 */
const articleSchema = new mongoose.Schema({
    // The headline of the news article
    title: { type: String, required: true },
    author: { type: String, default: "Unknown" },
    originalDate: { type: String },

    // Categorization path inherited from the Source (e.g., "/Health/Allergy")
    category: { type: String, required: true },
    tags: [String], // Array of keywords for searching and filtering
    content: { type: String, required: true }, // The main body of the article, stored as a Markdown string

    isRead: { type: Boolean, default: false }, // User status tracking
    // Unique URL to prevent the crawler from saving the same article twice
    sourceUrl: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now }
});

articleSchema.index({ category: 1 });

// Export the Model
const Article = mongoose.model('Article', articleSchema);
module.exports = Article;