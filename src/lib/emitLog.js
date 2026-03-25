const { getIO } = require('./socket');
const Task = require('../models/Task'); const { taskContext } = require('./context');

/**
 * 核心日誌工具：發送到 Console、Socket 和資料庫
 */
async function logToUI(message = "") {
    // 輸出到系統終端
    console.log(message);
    const store = taskContext.getStore(); // 從口袋拿資料
    const taskId = store?.taskId;

    try {
        // 獲取 Socket 實例並發送
        const io = getIO();

        // 建議發送物件格式，包含 taskId，方便前端 Alpine.js 過濾
        io.to(`task_${taskId}`).emit('task_log', {
            taskId: taskId,
            message: message
        });

        // 關鍵節點存入資料庫
        if (message.includes('✅') || message.includes('📍') || message.includes('❌')) {
            await Task.findByIdAndUpdate(taskId, {
                $push: {
                    logs: { $each: [message], $slice: -200 }
                }
            });
        }
    } catch (err) {
        // 防止 Socket 未初始化導致爬蟲崩潰
        console.error("LogToUI Error:", err.message);
    }
}

module.exports = { logToUI };