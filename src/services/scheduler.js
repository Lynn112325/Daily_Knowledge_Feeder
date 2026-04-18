const cron = require('node-cron');
const chalk = require('chalk');
const { getActiveTask, handleIncremental } = require('../lib/crawlerService');
const Source = require('../models/Source');
const Task = require('../models/Task');
const { logToUI } = require('../lib/emitLog');
const { TIMEZONE } = require('../config/global');

/**
 * Generates the standard task name for today's Daily Sync
 */
function getTodaySyncTaskName() {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    return `Daily Sync: ${todayStr}`;
}

/**
 * Checks the status of today's DailySync (can be called directly by Dashboard API)
 * @returns {Promise<{isDone: boolean, isRunning: boolean, systemBusy: boolean}>}
 */
async function getDailySyncStatus() {
    const targetTaskName = getTodaySyncTaskName();

    const existingTask = await Task.findOne({
        name: targetTaskName,
        status: { $in: ['completed', 'running'] }
    });

    const runningTask = await getActiveTask();

    return {
        isDone: existingTask?.status === 'completed',
        isRunning: existingTask?.status === 'running',
        systemBusy: !!runningTask && runningTask.name !== targetTaskName // Check if other tasks are running in the system
    };
}

/**
 * Core: Logic to execute the Daily Sync
 * @param {string} triggerType - 'SYSTEM' | 'CRON' | 'MANUAL'
 */
async function executeDailySync(triggerType = 'SYSTEM') {
    try {
        const status = await getDailySyncStatus();

        if (status.isDone || status.isRunning) {
            return { success: false, message: 'Today\'s sync is already completed or running.' };
        }

        if (status.systemBusy) {
            return { success: false, message: 'System is busy with another task.' };
        }

        const activeSources = await Source.find({ isActive: true, isInitialized: true }).select('_id');
        if (activeSources.length === 0) {
            return { success: false, message: 'No active sources found to sync.' };
        }

        const sourceIds = activeSources.map(s => s._id);

        const newTask = await Task.create({
            name: getTodaySyncTaskName(),
            crawlMode: 'incremental',
            status: 'running',
            totalSources: sourceIds.length,
            processedSources: 0,
            startedAt: new Date(),
        });

        logToUI(chalk.green(`🚀 [${triggerType}] Starting daily sync task #${newTask._id}`));

        // Trigger the crawler; use await to block the API response
        await handleIncremental(sourceIds, newTask._id).catch(err => {
            console.error('Incremental sync error:', err);
        });

        return { success: true, message: 'Sync task started successfully.', taskId: newTask._id };

    } catch (err) {
        console.error(`[${triggerType}] Sync execution error:`, err);
        return { success: false, message: 'Internal server error during sync initiation.' };
    }
}

/**
 * Auto Sync called during system boot-up
 */
async function triggerDailySync() {
    await executeDailySync('SYSTEM');
}

/**
 * Manual Sync called by API
 */
async function manualDailySync() {
    return await executeDailySync('MANUAL');
}

/**
 * Initialize scheduling: Triggered at 1, 2, and 3 AM daily
 */
function initCronJobs() {
    // Cron Syntax: Minute(0) Hour(1,2,3) Day(*) Month(*) DayOfWeek(*)
    cron.schedule('0 1,2,3 * * *', async () => {
        logToUI(chalk.blue('⏰ Cron triggered daily sync check.'));
        await executeDailySync('CRON');
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    console.log(chalk.cyan('📅 Cron jobs initialized (Daily at 1AM, 2AM, 3AM).'));
}

/**
 * Cleanup mechanism for interrupted stale tasks
 */
async function cleanupStaleTasks() {
    const result = await Task.updateMany(
        { status: 'running' },
        {
            status: 'failed',
            errorLogs: ['Task interrupted by server restart/crash.'],
            completedAt: new Date()
        }
    );
    if (result.modifiedCount > 0) {
        console.log(chalk.yellow(`🧹 Cleaned up ${result.modifiedCount} stale tasks.`));
    }
}

module.exports = {
    getDailySyncStatus,
    manualDailySync,
    triggerDailySync,
    initCronJobs,
    cleanupStaleTasks
};