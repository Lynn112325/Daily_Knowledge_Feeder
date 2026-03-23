const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    // Task name or target website
    name: { type: String, default: "General Scrape Task" },

    crawlMode: { type: String, enum: ['incremental', 'backfill'], default: 'incremental' },

    // Status: pending, running, completed, failed
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },

    // Progress tracking
    totalTarget: { type: Number, default: 0 },    // Total items to scrape
    processedCount: { type: Number, default: 0 }, // Items attempted
    successCount: { type: Number, default: 0 },   // Successfully saved items
    failCount: { type: Number, default: 0 },      // Failed items

    // Error details for failed status
    errorLog: { type: String },

    // Timing stats
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
}, {
    timestamps: true,           // Auto-manage createdAt and updatedAt
    toJSON: { virtuals: true }, // Include virtuals in JSON output
    toObject: { virtuals: true }
});

// Virtual field for real-time progress percentage
taskSchema.virtual('progressPercent').get(function () {
    if (this.totalTarget === 0) return 0;
    return Math.round((this.processedCount / this.totalTarget) * 100);
});

// Export Model
const Task = mongoose.model('Task', taskSchema);
module.exports = Task;