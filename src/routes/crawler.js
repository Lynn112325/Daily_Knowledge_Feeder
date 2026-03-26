const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const Task = require('../models/Task');
const { handleIncremental, handleBackfill } = require('../lib/crawlerService');
const STRATEGIES = require('../config/strategies');
const globalConfig = require('../config/global');

// Display mapping for manual excavation mechanisms
const labels = {
    'SINGLE_PAGE_API': {
        title: '⛏️ Excavation Batch Size',
        unit: 'batches',
        factor: 10, // 1 unit = 10 items
        backfillLabel: 'Excavated Batches',
        description: 'Retrieves history using API windows. Each batch targets ~10 articles.'
    },
    'INFINITE_SCROLL': {
        title: '🖱️ Scroll Depth',
        unit: 'scrolls',
        factor: 15, // 1 scroll = ~15 items
        backfillLabel: 'Scroll Depth',
        description: 'Simulates page scrolls. Each scroll usually uncovers ~15 articles.'
    },
    'PAGINATION': {
        title: '📄 Page History Depth',
        unit: 'pages',
        factor: 20, // 1 page = ~20 items
        backfillLabel: 'Pages Unearthed',
        description: 'Moves back through archival pages. Each page yields ~20 articles.'
    },
}

// GET /crawler - Render the main source management dashboard
router.get('/', async (req, res) => {
    try {
        // Pagination logic: current page and records per page
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [allSources, totalSources, activeCount, todayUpdatedCount, uniqueWebsites] = await Promise.all([
            Source.find().sort({ siteName: 1, category: 1 }).skip(skip).limit(limit),
            Source.countDocuments(),
            Source.countDocuments({ isActive: true }),
            Source.countDocuments({ lastCrawledAt: { $gte: startOfToday } }),
            Source.distinct('siteName')
        ]);

        const totalPages = Math.ceil(totalSources / limit);

        res.render('crawlerIndex', {
            sources: allSources,
            totalSources,
            activeCount,
            todayUpdatedCount,
            websiteCount: uniqueWebsites.length,
            title: 'Crawler Management',
            breadcrumbs: [{ name: 'Crawler' }],

            currentPage: page,
            totalPages,
            limit,
            totalSources
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// GET /crawler/backfill - UI for configuring deep history scraping
router.get('/backfill', async (req, res) => {
    try {
        const sites = await Source.distinct('siteName');

        res.render('crawlerConfig', {
            task: null,
            sites,
            title: 'Deep Dive',
            breadcrumbs: [
                { name: 'Crawler', url: '/crawler' },
                { name: 'Deep Dive' }]
        });
    } catch (error) {
        console.error("Error loading crawler config:", error);
        res.status(500).send("Internal Server Error");
    }
});

// POST /crawler/start - Trigger the background scraping task
router.post('/start', async (req, res) => {
    const { siteName, crawlMode, limit, sourceIds } = req.body;

    // Calculate total items to process based on mode
    let totalTarget = sourceIds.length * limit;
    if (crawlMode === "backfill") {
        // For backfill, target is calculated by batch size
        totalTarget = globalConfig.BATCH_SIZE * (sourceIds.length * limit);
    }
    console.log(siteName);
    // Register the task in DB before execution
    const task = await Task.create({
        name: siteName,
        crawlMode: crawlMode,
        status: 'pending',
        totalTarget: totalTarget
    });

    // Run the async crawler engine (non-blocking)
    if (crawlMode === 'backfill') {
        handleBackfill(sourceIds, parseInt(limit), task._id);
    } else {
        handleIncremental(sourceIds, parseInt(limit), task._id);
    }

    res.redirect('/crawler/backfill');
});

// GET /api/sources/:siteName - Fetch categories and UI metadata for a specific site
router.get('/api/sources/:siteName', async (req, res) => {
    try {
        const query = { siteName: req.params.siteName, isActive: true };
        if (req.query.pendingOnly === 'true') {
            query.isBackfillCompleted = false;
        }

        const categories = await Source.find(query)
            .select('category _id lastProcessedUnit isBackfillCompleted strategyKey')
            .sort({ category: 1 })
            .lean();

        // Determine which help text to show based on the site's crawling strategy
        let commonHelpText = labels['PAGINATION'];
        if (categories.length > 0) {
            const firstStrategy = STRATEGIES[categories[0].strategyKey];
            const type = firstStrategy?.listConfig?.backfillType || 'PAGINATION';
            commonHelpText = labels[type] || labels['PAGINATION'];
        }

        res.json({
            meta: { helpText: commonHelpText },
            sources: categories
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;