const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    // Task name or target website
    name: { type: String, default: "General Scrape Task" },

    crawlMode: { type: String, enum: ['incremental', 'backfill', 'quick_init'], default: 'incremental' },

    // Status: pending, running, completed, failed
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },

    // --- Progress Tracking (Macro: Category Level) ---
    totalSources: { type: Number, default: 0 },     // Total number of categories to process
    processedSources: { type: Number, default: 0 }, // Number of categories completed

    // --- Data Statistics (Micro: Article Level) ---
    successCount: { type: Number, default: 0 },     // Total articles successfully saved
    failCount: { type: Number, default: 0 },        // Total articles that failed to save

    // Error details for failed status
    errorLog: { type: [String] },
    logs: { type: [String] },

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
    if (this.totalSources === 0) return 0;
    return Math.round((this.processedSources / this.totalSources) * 100);
});

// Export Model
const Task = mongoose.model('Task', taskSchema);
module.exports = Task;