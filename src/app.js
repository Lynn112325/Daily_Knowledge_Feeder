const express = require('express');
const path = require('path');
const chalk = require('chalk');
const http = require('http'); // Required to wrap express app for Socket.io
const connectDB = require('./config/db');
const socketModule = require('../src/lib/socket');
const { cleanupStaleTasks, triggerDailySync } = require('../src/services/scheduler');
const mongoose = require('mongoose');

// --- Route Modules ---
const indexRoutes = require('./routes/index');
const crawlerRoutes = require('./routes/crawler');
const articleRoutes = require('./routes/articles');
const taskRoutes = require('./routes/tasks');
const apiRoutes = require('./routes/api');

const app = express();
/**
 * Create an HTTP server instance.
 * Socket.io requires a raw HTTP server to attach its listeners.
 */
const server = http.createServer(app);

/**
 * Initialize Socket.io and attach it to the server.
 * The 'io' instance is initialized here and can be accessed via socketModule.getIO() elsewhere.
 */
socketModule.init(server);

// --- Database Connection ---
connectDB(); // Establishes connection to MongoDB

// --- Middleware & View Engine Setup ---
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded form data
app.set('views', path.join(__dirname, 'views')); // Set the directory for EJS templates
app.set('view engine', 'ejs'); // Set EJS as the template engine

// --- Static Files ---
app.use(express.static(path.join(__dirname, '../public'))); // Serve static assets (CSS, JS, Images)

// --- Route Mounting ---
app.use('/', indexRoutes);             // Dashboard, home, and general navigation
app.use('/crawler', crawlerRoutes);    // Crawler controls and backfill logic
app.use('/articles', articleRoutes);   // Article listing, searching, and viewing
app.use('/tasks', taskRoutes);         // Task status API and log retrieval
app.use('/api', apiRoutes);            // Internal API utilities

// --- Error Handling (Optional but recommended) ---
app.use((err, req, res, next) => {
    console.error(chalk.red('System Error:'), err.stack);
    res.status(500).send('Something broke!');
});

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB Connected');

        await cleanupStaleTasks();

        await triggerDailySync();

        app.listen(3000, () => console.log('🚀 Server running on port 3000'));
    });

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
/**
 * Start the server using 'server.listen' instead of 'app.listen'
 * to ensure Socket.io functionality is active.
 */
server.listen(PORT, () => {
    console.log(chalk.cyan(`🚀 Server running at: http://localhost:${PORT}`));
    console.log(chalk.magenta(`🔌 Socket.io engine initialized and ready.`));
});