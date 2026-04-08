const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const MarkdownService = require('../services/markdownService');
const dateHelper = require('../utils/dateHelper');

/**
 * Route: GET /articles
 * Desc: Fetch paginated articles and dashboard statistics
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // 1. Get search params from URL
        const { q, category } = req.query;
        let queryFilter = {};

        // 2. Build Mongoose query
        if (q) {
            queryFilter.title = { $regex: q, $options: 'i' }; // Case-insensitive search
        }
        if (category && category !== 'All') {
            queryFilter.category = category; // Mongoose matches item in array automatically
        }

        const startOfToday = dateHelper.parse().startOf('day').toDate();

        // 3. Parallel execution (Important: countDocuments must use queryFilter)
        const [articles, filteredCount, readArticlesCount, todayArticlesCount, allCategories] = await Promise.all([
            Article.find(queryFilter).sort({ originalDate: -1 }).skip(skip).limit(limit),
            Article.countDocuments(queryFilter), // Current search result count
            Article.countDocuments({ isRead: true }),
            Article.countDocuments({
                createdAt: { $gte: startOfToday }
            }),
            Article.distinct('category') // Still need this for the dropdown list
        ]);

        const formattedArticles = articles.map(article => {
            const s = article.toObject();
            s.createdAtDisplay = article.createdAt
                ? dateHelper.getDateTime(article.createdAt)
                : 'Null';
            return s;
        });

        const totalPages = Math.ceil(filteredCount / limit);

        res.render('articleList', {
            articles: formattedArticles,
            totalArticles: filteredCount, // Return filtered total for pagination
            readCount: readArticlesCount,
            todayCount: todayArticlesCount,
            categoryCount: allCategories.length,
            allCategories, // Pass categories to populate select dropdown
            currentPage: page,
            totalPages,
            limit,
            searchQuery: q || '', // Send back to keep input state
            selectedCategory: category || 'All',
            title: 'Articles',
            breadcrumbs: [{ name: 'Articles', url: '/articles' }, { name: 'List' }]
        });
    } catch (err) {
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