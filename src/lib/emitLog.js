const { getIO } = require('./socket');
const Task = require('../models/Task');
const { taskContext } = require('./context');

/**
 * Core logging utility: Sends logs to Console, Socket.io, and MongoDB
 * @param {string} message - The log string to broadcast
 */
async function logToUI(message = "") {
    // 1. Output to local terminal
    console.log(message);

    // 2. Retrieve current taskId from AsyncLocalStorage (taskContext)
    const store = taskContext.getStore();
    const taskId = store?.taskId;

    try {
        const io = getIO();

        // 3. Broadcast to Socket.io room (supports real-time UI updates)
        // We wrap it in an object for easier frontend filtering/parsing
        io.to(`task_${taskId}`).emit('task_log', {
            taskId: taskId,
            message: message
        });

        // 4. Save persistence logs to Database for critical nodes
        // Only saves key status indicators to avoid bloating DB
        if (message.includes('✅') || message.includes('📍') || message.includes('❌')) {
            await Task.findByIdAndUpdate(taskId, {
                $push: {
                    logs: { $each: [message], $slice: -200 } // Keep only the last 200 logs
                }
            });
        }
    } catch (err) {
        // Log error but don't crash the main crawler process
        console.error("LogToUI Error:", err.message);
    }
}

module.exports = { logToUI };