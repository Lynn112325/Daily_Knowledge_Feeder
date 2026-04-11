const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const Article = require('../models/Article');
const dateHelper = require('../utils/dateHelper');

/**
 * Route: GET /
 * Desc: Main dashboard controller fetching system-wide statistics and curated article lists
 */
router.get('/', async (req, res) => {
    try {
        // Run multiple database queries in parallel for better performance
        const [statsData, readingList, laterList, pendingInitCount] = await Promise.all([

            // 1. Aggregate core system statistics
            (async () => {
                // Get start of today (00:00:00) using local timezone
                const startOfToday = dateHelper.parse().startOf('day').toDate();

                const [total, today, activeSources, totalSources, readCount] = await Promise.all([
                    Article.countDocuments(), // Total articles in DB
                    Article.countDocuments({ createdAt: { $gte: startOfToday } }), // New arrivals today
                    Source.countDocuments({ isActive: true }), // Currently running crawlers
                    Source.countDocuments(), // Total configured sources
                    Article.countDocuments({ status: { $in: ['read', 'archived'] } }), // Consumption progress
                ]);

                return {
                    totalArticles: total || 0,
                    todayCount: today || 0,
                    activeSources: activeSources || 0,
                    totalSources: totalSources || 0,
                    readCount: readCount || 0
                };
            })(),

            // 2. Fetch top 5 "Reading Now" articles (most recently updated first)
            Article.find({ status: 'reading' }).sort({ updatedAt: -1 }).limit(5).lean(),

            // 3. Fetch top 5 "Read Later" articles (oldest added first to avoid backlog)
            Article.find({ status: 'later' }).sort({ createdAt: 1 }).limit(5).lean(),

            // 4. Count sources that are active but not yet initialized (for Quick Init UI)
            Source.countDocuments({ isInitialized: false, isActive: true }),
        ]);

        // Render the dashboard with fetched data and safety fallbacks
        res.render('dashboard', {
            stats: statsData || { totalArticles: 0, todayCount: 0, activeSources: 0 },
            readingArticles: readingList || [],
            laterArticles: laterList || [],
            dateHelper,
            title: 'Dashboard',
            pendingInitCount: pendingInitCount || 0
        });

    } catch (err) {
        // Log the error and render a user-friendly error page
        console.error("Dashboard Error:", err);
        res.status(500).render('error', {
            message: "Failed to load dashboard data",
            error: err
        });
    }
});

module.exports = router;