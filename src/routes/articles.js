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

        // Parse sorting parameters (default: newest first)
        const sortBy = req.query.sortBy || 'originalDate';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        // Unify search and category filters from query string
        const searchQuery = req.query.q || '';
        const category = req.query.category || 'All';

        // --- 2. Query Configuration ---
        // Construct the sorting object for Mongoose (e.g., { originalDate: -1 })
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder;

        // Build the filter object based on user input
        let queryFilter = {};
        if (searchQuery) {
            // Use regex for case-insensitive title search
            queryFilter.title = { $regex: searchQuery, $options: 'i' };
        }
        if (category && category !== 'All') {
            // Match specific category
            queryFilter.category = category;
        }

        // Get the timestamp for the start of the current day for statistics
        const startOfToday = dateHelper.parse().startOf('day').toDate();

        // --- 3. Database Execution (Parallelized) ---
        // Execute all independent queries concurrently to optimize performance
        const [
            articles,
            filteredCount,
            readArticlesCount,
            todayArticlesCount,
            allCategories
        ] = await Promise.all([
            // Primary query: Fetch articles with sort, skip, and limit
            Article.find(queryFilter).sort(sortOptions).skip(skip).limit(limit),
            // Count total articles matching the current filter (for pagination)
            Article.countDocuments(queryFilter),
            // Global statistic: Total articles marked as read
            Article.countDocuments({ isRead: true }),
            // Global statistic: Articles collected since 00:00 today
            Article.countDocuments({ createdAt: { $gte: startOfToday } }),
            // Utility: Get unique categories for the UI dropdown filter
            Article.distinct('category')
        ]);

        // --- 4. Data Transformation ---
        const formattedArticles = articles.map(article => {
            const s = article.toObject();
            // Format timestamps using helper; fallback to 'Null' if missing
            s.createdAtDisplay = article.createdAt
                ? dateHelper.getDateTime(article.createdAt)
                : 'Null';
            return s;
        });

        // Calculate total pages based on the filtered results
        const totalPages = Math.ceil(filteredCount / limit);

        // --- 5. UI Rendering ---
        res.render('articleList', {
            articles: formattedArticles,
            totalArticles: filteredCount,
            readCount: readArticlesCount,
            todayCount: todayArticlesCount,
            categoryCount: allCategories.length,
            allCategories,
            currentPage: page,
            totalPages,
            limit,
            searchQuery,
            sortBy,
            // Pass original sortOrder string for UI icon toggling
            sortOrder: req.query.sortOrder || 'desc',
            // Pre-calculate query string for pagination links to preserve state
            queryString: `&q=${searchQuery}&category=${category}&sortBy=${sortBy}&sortOrder=${req.query.sortOrder || 'desc'}`,
            selectedCategory: category,
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