// src/lib/socket.js
const { Server } = require('socket.io');

let io; // Singleton instance for Socket.io

module.exports = {
    /**
     * Initialize Socket.io with HTTP server
     * @param {Object} httpServer - The native HTTP server instance
     */
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: { origin: "*" } // Allow all origins for development
        });

        io.on('connection', (socket) => {
            // Client joins a specific room based on Task ID
            socket.on('join_task', (taskId) => {
                socket.join(`task_${taskId}`);
                console.log(`👤 User joined room: task_${taskId}`);
            });
        });

        return io;
    },

    /**
     * Get the existing Socket.io instance
     * Useful for emitting events from other modules
     */
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    }
};