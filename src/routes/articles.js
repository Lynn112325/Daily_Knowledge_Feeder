const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const MarkdownService = require('../services/markdownService');

/**
 * Route: GET /articles
 * Desc: Fetch paginated articles and dashboard statistics
 */
router.get('/', async (req, res) => {
    try {
        // Pagination logic: current page and records per page
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Parallel execution: fetch list and aggregate counts for efficiency
        const [articles, totalArticles, readArticlesCount, todayArticlesCount, categories] = await Promise.all([
            Article.find().sort({ originalDate: -1 }).skip(skip).limit(limit),
            Article.countDocuments(),
            Article.countDocuments({ isRead: true }),
            Article.countDocuments({
                createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
            }),
            Article.distinct('category')
        ]);

        const totalPages = Math.ceil(totalArticles / limit);

        res.render('articleList', {
            articles,
            totalArticles,
            readCount: readArticlesCount,
            todayCount: todayArticlesCount,
            categoryCount: categories.length,
            currentPage: page,
            totalPages,
            limit,
            title: 'All Articles',
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