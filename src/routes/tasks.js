const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

router.get('/', async (req, res) => {
    const tasks = await Task.find().sort({ createdAt: -1 }).limit(10);
    res.render('taskLogs', {
        tasks,
        title: 'Execution Logs',
        breadcrumbs: [
            { name: 'Crawler', url: '/crawler' },
            { name: 'History' }
        ]
    });
});

// GET /tasks/api/active - Get running/recent tasks for monitor
router.get('/api/active', async (req, res) => {
    try {
        // Find tasks that are running, pending, or completed very recently (e.g., today)
        const tasks = await Task.find({
            $or: [
                { status: { $in: ['running', 'pending'] } },
                { updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Keep history for 24h
            ]
        }).sort({ createdAt: -1 }).limit(10);

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /tasks/api/stop/:id - Abort a running task
router.get('/api/stop/:id', async (req, res) => {
    try {
        // Set status to stopped
        await Task.findByIdAndUpdate(req.params.id, {
            status: 'stopped',
            errorLog: 'Manually stopped by user.',
            completedAt: new Date()
        });

        // Note: Actual stoppage requires your crawlerService.js to check the DB status 
        // during its loop and break if status !== 'running'.

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;