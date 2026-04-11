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

        // Default to 'Active' to hide archived articles unless specifically requested
        const selectedStatus = req.query.status || 'Active';

        // Build the filter object based on user input
        let queryFilter = {};

        if (selectedStatus === 'Active') {
            queryFilter.status = { $ne: 'archived' }; // Exclude archived
        } else if (selectedStatus !== 'All') {
            queryFilter.status = selectedStatus; // Filter by specific status
        }

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
            // Update statistics to use the new status field instead of isRead
            Article.countDocuments({ status: { $in: ['read', 'archived'] } }),
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
            selectedStatus,
            // Pre-calculate query string for pagination links to preserve state
            queryString: `&q=${searchQuery}&category=${category}&status=${selectedStatus}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
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

router.put('/:id', async (req, res) => {
    try {
        const { article } = req.body;

        const { summary, content } = MarkdownService.extractContent(article);

        const updateData = {
            content: content,
            updatedAt: Date.now()
        };

        if (summary !== null) {
            updateData.summary = summary;
        } else {
            console.log("Summary not found in Markdown, skipping summary update.");
        }

        await Article.findByIdAndUpdate(req.params.id, updateData);
        res.status(200).json({ message: 'Content saved successfully' });
    } catch (err) {
        res.status(400).json({
            error: 'Save failed',
            message: err.message === 'PROTECTION_MARKER_DELETED' ? 'Protection marker deleted' : 'Invalid content format'
        });
    }
});

router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        await Article.findByIdAndUpdate(req.params.id, { status });
        res.status(200).json({ message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

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
            breadcrumbs: [
                { name: 'Articles', url: '/articles' },
                { name: article.title }
            ],
            needEditor: true
        });
    } catch (err) {
        console.error('View error:', err);
        res.status(500).send("Server Error: " + err.message);
    }
});

module.exports = router;