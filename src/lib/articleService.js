const chalk = require('chalk');
const Article = require('../models/Article');
const { annotateMarkdown } = require('./dictionaryService');

/**
 * Processes and saves article data to MongoDB.
 * Handles dictionary annotation and URL slug generation.
 */
async function saveToDatabase(articleData) {
    try {
        // 1. Add dictionary annotations to the content
        const annotatedContent = await annotateMarkdown(articleData.content);

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
            originalUrl: articleData.fullUrl,
            // Format category path (e.g., /Health/Allergy)
            category: `/${articleData.mainCategory}/${articleData.category}`.replace(/\/+/g, '/'),
            tags: articleData.keywords || [],
            content: annotatedContent,
            summary: articleData.summary,
            imageUrl: articleData.image,
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
            console.log(chalk.bold.green(`✅ Article Saved to DB: ${articlePayload.title}`));
            return result._id;
        }

    } catch (error) {
        // Handle MongoDB duplicate key error (code 11000)
        if (error.code === 11000) {
            console.warn(chalk.yellow(`⚠️ Duplicate article skipped: ${articleData.title}`));
        } else {
            console.error(chalk.red(`❌ DB Save Error: ${error.message}`));
        }
        throw error;
    }
}

module.exports = { saveToDatabase };