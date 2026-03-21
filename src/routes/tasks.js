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
module.exports = router;