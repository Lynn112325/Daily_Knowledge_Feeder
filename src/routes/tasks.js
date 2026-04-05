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
router.post('/api/stop/:id', async (req, res) => {
    try {
        const taskId = req.params.id;

        // 1. Verify the task exists before attempting to modify it
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // 2. Set status to 'stopped'; the background engine checks this flag to exit loops
        await Task.findByIdAndUpdate(taskId, {
            status: 'stopped',
            errorLog: 'Manually stopped by user.',
            completedAt: new Date()
        });

        res.json({ success: true, message: `Task ${taskId} has been stopped.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;