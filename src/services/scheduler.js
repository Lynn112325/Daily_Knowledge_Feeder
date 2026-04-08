const cron = require('node-cron');
const { getActiveTask, handleIncremental } = require('../lib/crawlerService');
const Source = require('../models/Source');
const Task = require('../models/Task');
const { logToUI } = require('../lib/emitLog');
const chalk = require('chalk');
const { TIMEZONE } = require('../config/global');

/**
 * Initialize automated cron jobs
 */
function initArticleCronJobs() {
    // Run at 01:00, 02:00, and 03:00 every day
    const cronString = '0 1,2,3 * * *';
    // const cronString = '*/1 * * * *';

    cron.schedule(cronString, async () => {
        logToUI(chalk.bgBlue.white(' ⏰ CRON TRIGGERED: Daily Sync '));

        try {
            // 1. Generate unique task name for today (e.g., Daily Sync: 2026-04-06)
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
            const targetTaskName = `Daily Sync: ${todayStr}`;

            // 2. Check if today's task is already finished or currently in progress
            const existingTask = await Task.findOne({
                name: targetTaskName,
                status: { $in: ['completed', 'running'] }
            });

            if (existingTask) {
                // If running, we don't need to start another one
                // If completed, we definitely don't need to start another one
                const statusMsg = existingTask.status === 'running' ? 'is currently running' : 'is already completed';
                console.log(chalk.gray(`[Cron] ${targetTaskName} ${statusMsg}. Skipping.`));
                return;
            }

            // 3. Global lock: prevent concurrent execution with any other crawler tasks
            const runningTask = await getActiveTask();
            if (runningTask) {
                logToUI(chalk.yellow(`⚠️ Task [${runningTask.name}] is already running. Skipping this schedule.`));
                return;
            }

            // 4. Fetch sources that are both active and initialized
            const activeSources = await Source.find({
                isActive: true,
                isInitialized: true
            }).select('_id');

            if (activeSources.length === 0) {
                logToUI(chalk.yellow('⚠️ No initialized active sources found.'));
                return;
            }

            const sourceIds = activeSources.map(s => s._id);

            // 5. Create new task record
            const newTask = await Task.create({
                name: targetTaskName,
                crawlMode: 'incremental',
                status: 'running',
                totalSources: sourceIds.length,
                processedSources: 0,
                startedAt: new Date(),
                trigger: 'SYSTEM'
            });

            logToUI(chalk.green(`🚀 Starting Auto-Sync Task #${newTask._id}`));

            // 6. Execute incremental crawl
            await handleIncremental(sourceIds, newTask._id);

        } catch (err) {
            logToUI(chalk.bgRed(' CRON SCHEDULER ERROR '), err.message);
        }
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    console.log(chalk.cyan(`📅 Scheduler set to: ${cronString} (${TIMEZONE})`));
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

module.exports = { initArticleCronJobs, cleanupStaleTasks };