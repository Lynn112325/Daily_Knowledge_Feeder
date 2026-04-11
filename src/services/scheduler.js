const { getActiveTask, handleIncremental } = require('../lib/crawlerService');
const Source = require('../models/Source');
const Task = require('../models/Task');
const { logToUI } = require('../lib/emitLog');
const chalk = require('chalk');
const { TIMEZONE } = require('../config/global');

/**
 * Core logic to trigger the daily sync, extracted for reuse
 */
async function triggerDailySync() {
    try {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
        const targetTaskName = `Daily Sync: ${todayStr}`;

        // Check if task exists
        const existingTask = await Task.findOne({
            name: targetTaskName,
            status: { $in: ['completed', 'running'] }
        });

        if (existingTask) return; // Already done or doing

        const runningTask = await getActiveTask();
        if (runningTask) return; // System busy

        const activeSources = await Source.find({ isActive: true, isInitialized: true }).select('_id');
        if (activeSources.length === 0) return;

        const sourceIds = activeSources.map(s => s._id);

        const newTask = await Task.create({
            name: targetTaskName,
            crawlMode: 'incremental',
            status: 'running',
            totalSources: sourceIds.length,
            processedSources: 0,
            startedAt: new Date(),
            trigger: 'SYSTEM'
        });

        logToUI(chalk.green(`🚀 [Auto-Boot] Starting missed sync task #${newTask._id}`));
        await handleIncremental(sourceIds, newTask._id);

    } catch (err) {
        console.error('Boot-up sync error:', err);
    }
}

/**
 * Cleanup mechanism to fail stale 'running' tasks on server startup
 */
async function cleanupStaleTasks() {
    const result = await Task.updateMany(
        { status: 'running' },
        {
            status: 'failed',
            errorLog: ['Task interrupted by server restart/crash.'],
            completedAt: new Date()
        }
    );
    if (result.modifiedCount > 0) {
        console.log(chalk.yellow(`🧹 Cleaned up ${result.modifiedCount} stale tasks.`));
    }
}

module.exports = { triggerDailySync, cleanupStaleTasks };