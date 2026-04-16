const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const Article = require('../models/Article');
const dateHelper = require('../utils/dateHelper');
const { getDailySyncStatus } = require('../services/scheduler');

/**
 * Route: GET /
 * Desc: Main dashboard controller fetching system-wide statistics and curated article lists
 */
router.get('/', async (req, res) => {
    try {
        const [
            statsData,
            readingList,
            laterList,
            pendingInitCount,
            syncStatus
        ] = await Promise.all([

            // 1.1 Aggregate core system statistics
            (async () => {
                const startOfToday = dateHelper.parse().startOf('day').toDate();

                const [total, today, activeSources, totalSources, readCount] = await Promise.all([
                    Article.countDocuments(), // Total articles in DB                   
                    Article.countDocuments({ createdAt: { $gte: startOfToday } }),
                    Source.countDocuments({ isActive: true }),
                    Source.countDocuments(),
                    Article.countDocuments({ status: { $in: ['read', 'archived'] } }),
                ]);

                return {
                    totalArticles: total || 0, todayCount: today || 0,
                    activeSources: activeSources || 0,
                    totalSources: totalSources || 0,
                    readCount: readCount || 0
                };
            })(),

            // 1.2 Fetch "Reading Now"
            Article.find({ status: 'reading' }).sort({ updatedAt: -1 }).lean(),

            // 1.3 Fetch "Read Later"
            Article.find({ status: 'later' }).sort({ updatedAt: 1 }).lean(),

            // 1.4 Count pending initialization
            Source.countDocuments({ isInitialized: false, isActive: true }),

            // 1.5 check daily sync status for button state
            getDailySyncStatus()
        ]);

        res.render('dashboard', {
            stats: {
                ...statsData,
                dailySyncDone: syncStatus.isDone || syncStatus.isRunning,
                systemBusy: syncStatus.systemBusy
            },
            readingArticles: readingList || [],
            laterArticles: laterList || [],
            dateHelper,
            title: 'Dashboard',
            pendingInitCount: pendingInitCount || 0
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).render('error', {
            message: "Failed to load dashboard data",
            error: err
        });
    }
});

module.exports = router;