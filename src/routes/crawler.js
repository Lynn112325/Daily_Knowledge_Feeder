const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const Task = require('../models/Task');
const { getActiveTask, runQuickInitTask, handleBackfill } = require('../lib/crawlerService');
const STRATEGIES = require('../config/strategies');
const dateHelper = require('../utils/dateHelper');

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

        const startOfToday = dateHelper.parse().startOf('day').toDate();

        const [allSources, totalSources, activeCount, todayUpdatedCount, uniqueWebsites, pendingInitCount] = await Promise.all([
            Source.find().sort({ siteName: 1, category: 1 }).skip(skip).limit(limit),
            Source.countDocuments(),
            Source.countDocuments({ isActive: true }),
            Source.countDocuments({ lastCrawledAt: { $gte: startOfToday } }),
            Source.distinct('siteName'),
            Source.countDocuments({ isInitialized: false, isActive: true })
        ]);
        const totalPages = Math.ceil(totalSources / limit);

        const formattedSources = allSources.map(source => {
            const s = source.toObject();
            s.lastCrawledAtDisplay = source.lastCrawledAt
                ? dateHelper.getDateTime(source.lastCrawledAt)
                : 'Never';
            return s;
        });

        res.render('crawlerIndex', {
            sources: formattedSources,
            totalSources,
            activeCount,
            todayUpdatedCount,
            websiteCount: uniqueWebsites.length,
            title: 'Crawler Management',
            breadcrumbs: [{ name: 'Crawler' }],

            // Pagination
            currentPage: page,
            totalPages,
            limit,
            totalSources,
            // quick-init
            pendingInitCount
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

router.post('/quick-init-all', async (req, res) => {
    try {
        // 1. Concurrency Check: Prevent starting if another task is active
        const runningTask = await getActiveTask();
        if (runningTask) {
            return res.status(400).json({
                success: false,
                message: `Another task "${runningTask.name}" is currently running. Please try again later.`
            });
        }
        // 2. Identify sources that need a baseline crawl (pending initialization)
        const sourcesToInit = await Source.find({ isInitialized: false, isActive: true });

        if (sourcesToInit.length === 0) {
            return res.status(400).json({ message: 'No pending sources to initialize.' });
        }

        // 3. Create a Task document to track macro/micro progress in the UI
        const task = await Task.create({
            name: 'Quick Init Task',
            crawlMode: 'quick_init',
            status: 'running',
            totalSources: sourcesToInit.length,
            startedAt: new Date()
        });

        // 4. Fire-and-forget: Trigger the engine in the background without blocking the response
        runQuickInitTask(sourcesToInit, task._id);

        res.json({
            success: true,
            taskId: task._id,
            message: `Task #${task._id} started for ${sourcesToInit.length} sources.`
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
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
    try {
        // 1. Concurrency Check: Prevent starting if another task is active
        const runningTask = await getActiveTask();
        if (runningTask) {
            return res.status(400).json({
                success: false,
                message: `Another task "${runningTask.name}" is currently running. Please try again later.`
            });
        }
        const { siteName, crawlMode, limit, sourceIds } = req.body;

        // Register the task in DB before execution
        const task = await Task.create({
            name: siteName,
            crawlMode: crawlMode,
            status: 'pending',
            totalSources: sourceIds.length
        });

        // Run the async crawler engine (non-blocking)
        if (crawlMode === 'backfill') {
            handleBackfill(sourceIds, parseInt(limit), task._id);
        }
        return res.json({
            success: true,
            redirectUrl: '/tasks',
            message: 'Task started successfully.'
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
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