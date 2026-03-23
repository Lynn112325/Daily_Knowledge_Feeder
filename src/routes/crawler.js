const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const Task = require('../models/Task');
const { handleIncremental, handleBackfill } = require('../lib/crawlerService');
const STRATEGIES = require('../config/strategies');
const globalConfig = require('../config/global');

// Display mapping for different crawling mechanisms
const labels = {
    'SINGLE_PAGE_API': {
        title: 'Fetch [ 10 ] items per category',
        unit: 'items',
        backfillLabel: 'Data retrieved'
    },
    'INFINITE_SCROLL': {
        title: 'Scroll [ 10 ] times for more',
        unit: 'scrolls',
        backfillLabel: 'Scroll depth'
    },
    'PAGINATION': {
        title: 'Go back [ 10 ] pages',
        unit: 'pages',
        backfillLabel: 'History depth'
    },
}

// GET /crawler - Render the main source management dashboard
router.get('/', async (req, res) => {
    try {
        const allSources = await Source.find().sort({ siteName: 1, category: 1 });
        res.render('crawlerIndex', {
            sources: allSources,
            title: 'Crawler Management',
            breadcrumbs: [{ name: 'Crawler' }]
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

    // Register the task in DB before execution
    const task = await Task.create({
        name: `${crawlMode.toUpperCase()}: ${siteName}`,
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