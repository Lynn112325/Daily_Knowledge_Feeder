const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const MarkdownService = require('../services/markdownService');
const dateHelper = require('../utils/dateHelper');

/**
 * Route: GET /articles
 * Description: Retrieves a paginated list of articles with dynamic filtering, 
 * sorting, and dashboard statistical counters.
 * Access: Public/Private (depending on middleware)
 */
router.get('/', async (req, res) => {
    try {
        // --- 1. Request Parameter Parsing ---
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // 1. Get search params from URL
        const { q, category } = req.query;
        let queryFilter = {};
        if (searchQuery) {
            // Use regex for case-insensitive title search
            queryFilter.title = { $regex: searchQuery, $options: 'i' };
        }
        if (category && category !== 'All') {
            queryFilter.category = category; // Mongoose matches item in array automatically
        }

        // 3. Parallel execution (Important: countDocuments must use queryFilter)
        const [articles, filteredCount, readArticlesCount, todayArticlesCount, allCategories] = await Promise.all([
            Article.find(queryFilter).sort({ originalDate: -1 }).skip(skip).limit(limit),
            Article.countDocuments(queryFilter), // Current search result count
            Article.countDocuments({ isRead: true }),
            Article.countDocuments({
                createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
            }),
            Article.distinct('category') // Still need this for the dropdown list
        ]);

        // Calculate total pages based on the filtered results
        const totalPages = Math.ceil(filteredCount / limit);

        // --- 5. UI Rendering ---
        res.render('articleList', {
            articles,
            totalArticles: filteredCount, // Return filtered total for pagination
            readCount: readArticlesCount,
            todayCount: todayArticlesCount,
            categoryCount: allCategories.length,
            allCategories,
            currentPage: page,
            totalPages,
            limit,
            searchQuery: q || '', // Send back to keep input state
            selectedCategory: category || 'All',
            title: 'Articles',
            breadcrumbs: [
                { name: 'Articles', url: '/articles' },
                { name: 'List' }
            ]
        });
    } catch (err) {
        // Log error and return generic server error status
        console.error('List error:', err);
        res.status(500).send('Server Error');
    }
});

/**
 * Helper: Build dynamic breadcrumbs based on article category array
 */
function generateBreadcrumbs(article) {
    const categoryParts = Array.isArray(article.category) ? article.category : [];
    return [
        { name: 'Articles', url: '/articles' },
        ...categoryParts.map((cat, idx) => ({
            name: cat,
            url: `/articles?category=${encodeURIComponent(categoryParts.slice(0, idx + 1).join('/'))}`
        })),
        { name: article.title.substring(0, 20) + '...' }
    ];
}

/**
 * Route: GET /articles/:id
 * Desc: Display single article with Markdown formatting and Vditor support
 */
router.get('/:id', async (req, res) => {
    try {
        const article = await Article.findById(req.params.id);
        if (!article) return res.status(404).send("Article Not Found");

        // Combine article meta data and content into formatted Markdown
        const fullMarkdown = MarkdownService.formatFullArticle(article);

        res.render('viewArticle', {
            article,
            initialMarkdown: fullMarkdown,
            articleId: article._id,
            title: article.title,
            breadcrumbs: generateBreadcrumbs(article),
            needEditor: true
        });
    } catch (err) {
        console.error('View error:', err);
        res.status(500).send("Server Error: " + err.message);
    }
});

module.exports = router;