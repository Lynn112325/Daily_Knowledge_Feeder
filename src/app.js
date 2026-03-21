const express = require('express');
const path = require('path');
const chalk = require('chalk');
const connectDB = require('./config/db');

// 引入路由模組
const indexRoutes = require('./routes/index');
const crawlerRoutes = require('./routes/crawler');
const articleRoutes = require('./routes/articles');
const taskRoutes = require('./routes/tasks');
const apiRoutes = require('./routes/api');

const app = express();
connectDB();

// --- Middleware ---
// app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// --- Mounting Routes ---
app.use('/', indexRoutes);             // Dashboard
app.use('/crawler', crawlerRoutes);     // 所有 /crawler 開頭的請求
app.use('/articles', articleRoutes);   // 所有 /articles 開頭的請求
app.use('/tasks', taskRoutes);         // 所有 /tasks 開頭的請求
app.use('/api', apiRoutes);            // 字典或其他工具 API

// --- Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(chalk.cyan(`🚀 Server started: http://localhost:${PORT}`));
});