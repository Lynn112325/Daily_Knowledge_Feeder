const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const dateHelper = require('../utils/dateHelper');

router.get('/', async (req, res) => {
    const allTasks = await Task.find().sort({ createdAt: -1 }).limit(10);

    const formattedTasks = allTasks.map(task => {
        const t = task.toObject();
        t.createdAtDisplay = task.createdAt
            ? dateHelper.getDateTime(task.createdAt)
            : 'Never';
        return t;
    });

    res.render('taskLogs', {
        tasks: formattedTasks,
        title: 'Execution Logs',
        breadcrumbs: [
            { name: 'Crawler', url: '/crawler' },
            { name: 'History' }
        ]
    });
});

// GET /tasks/api/active
router.get('/api/active', async (req, res) => {
    try {
        // 1. Fetch recent tasks for the list
        const tasks = await Task.find({
            $or: [
                { status: { $in: ['running', 'pending'] } },
            ]
        }).sort({ createdAt: -1 }).limit(10);

        // 2. Determine if the engine is "Busy" (Is there any task currently running/pending?)
        const isBusy = tasks.some(t => ['running', 'pending'].includes(t.status));

        res.json({
            active: isBusy, // This satisfies the frontend check
            tasks: tasks    // This provides the list data
        });
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