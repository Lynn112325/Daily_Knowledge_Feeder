const express = require('express');
const router = express.Router();
const Source = require('../models/Source');
const Article = require('../models/Article');

router.get('/', async (req, res) => {
    try {
        const stats = {
            totalArticles: await Article.countDocuments(),
            todayCount: await Article.countDocuments({
                createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
            }),
            activeSources: await Source.countDocuments({ isActive: true })
        };
        res.render('dashboard', {
            stats,
            title: 'Dashboard',
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

module.exports = router;