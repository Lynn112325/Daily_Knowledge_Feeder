const express = require('express');
const path = require('path');
const chalk = require('chalk');
const connectDB = require('./config/db');

// --- Route Modules ---
const indexRoutes = require('./routes/index');
const crawlerRoutes = require('./routes/crawler');
const articleRoutes = require('./routes/articles');
const taskRoutes = require('./routes/tasks');
const apiRoutes = require('./routes/api');

const app = express();

// Initialize Database
connectDB();

// --- Middleware & View Engine ---
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.set('views', path.join(__dirname, 'views')); // Set views directory
app.set('view engine', 'ejs'); // Set template engine

// --- Route Mounting ---
app.use('/', indexRoutes);            // Dashboard & Home
app.use('/crawler', crawlerRoutes);    // Crawler management
app.use('/articles', articleRoutes);   // Article management
app.use('/tasks', taskRoutes);         // Task scheduling
app.use('/api', apiRoutes);            // API utilities

// --- Server Startup ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(chalk.cyan(`🚀 Server running at: http://localhost:${PORT}`));
});