const chalk = require('chalk');
const Article = require('../models/Article');
const { annotateMarkdown } = require('./dictionaryService');
const { logToUI } = require('./emitLog');

/**
 * Processes and saves article data to MongoDB.
 * Handles dictionary annotation and URL slug generation.
 */
async function saveToDatabase(articleData) {
    try {
        // 1. Add dictionary annotations to the content
        const annotatedContent = await annotateMarkdown(articleData.content);

        const annotatedSummary = await annotateMarkdown(articleData.summary);

        let slug = articleData.title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 80);

        if (!slug || slug === '-') slug = `article-${Date.now()}`;

        // 2. Prepare the database payload
        const articlePayload = {
            title: articleData.title,
            author: articleData.author || "Unknown",
            originalDate: articleData.date,
            originalUrl: articleData.originalUrl,
            siteName: articleData.siteName,
            // Format category path (e.g., /Health/Allergy)
            category: articleData.category,
            tags: articleData.keywords || [],
            content: annotatedContent,
            summary: annotatedSummary,
            // Generate a URL-friendly slug from the title
            slug: articleData.title
                .toLowerCase()
                .replace(/[^\w\s-]/g, '') // Remove special characters
                .replace(/\s+/g, '-')     // Replace spaces with hyphens
                .substring(0, 80)
        };

        // 3. Perform Upsert: Update if URL exists, otherwise insert new
        const result = await Article.findOneAndUpdate(
            { originalUrl: articlePayload.originalUrl },
            articlePayload,
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        if (result) {
            await logToUI(chalk.bold.green(`✅ Article Saved to DB: ${articlePayload.title}`));
            return result._id;
        }

    } catch (error) {
        // Handle MongoDB duplicate key error (code 11000)
        if (error.code === 11000) {
            await logToUI(chalk.yellow(`⚠️ Duplicate article skipped: ${articleData.title}`));
        } else {
            await logToUI(chalk.red(`❌ DB Save Error: ${error.message}`));
        }
        throw error;
    }
}

module.exports = { saveToDatabase };