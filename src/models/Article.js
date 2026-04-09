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
    originalUrl: { type: String, required: true, unique: true },
    siteName: { type: String, required: true },

    // Categorization path inherited from the Source (e.g., "/Health/Allergy")
    category: { type: [String], required: true },
    tags: [String], // Array of keywords for searching and filtering
    content: { type: String, required: true }, // The main body of the article, stored as a Markdown string
    summary: { type: String },
    image: { type: String },

    createdAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['unread', 'reading', 'read', 'archived', 'later'],
        default: 'unread'
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Source' },
}, {
    strict: true
});

articleSchema.index({ category: 1 });

// Export the Model
const Article = mongoose.model('Article', articleSchema);
module.exports = Article;