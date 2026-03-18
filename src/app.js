const express = require('express');
const path = require('path');
const fs = require('fs');
const { getWordDetails } = require('./lib/dictionaryService');
const connectDB = require('./config/db');

const app = express();

connectDB();

// --- Configurations ---
// Serve static CSS files from the config folder
app.use(express.static(path.join(__dirname, 'config/css')));

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Routes ---

// 0. Root Redirect
app.get('/', (req, res) => {
    // Redirect users to the main article list by default
    res.redirect('/articles');
});

// 1. Crawler Config Page
app.get('/crawler/new', (req, res) => {
    // Renders the form to set up a new crawler task
    res.render('crawlerConfig');
});

// 2. Article List Page
app.get('/articles', (req, res) => {
    // TODO: Fetch the list of crawled articles from your database or file system
    res.render('articleList', {
        articles: [] // Pass an array of article data to the template later
    });
});

// 3. Article View/Edit Page (Dynamic ID)
app.get('/articles/view/:id', (req, res) => {
    // Get the dynamic ID from the URL (e.g., /articles/view/Severe-COVID)
    const articleId = req.params.id;

    // NOTE: Once you add a database, you will use articleId to query the exact file path.
    // For now, I am simulating your folder structure.
    const category = 'Health/Allergy';
    const filePath = path.join(__dirname, `../output/${category}/${articleId}.md`);

    let markdownContent = "# Loading Error"; // Default message

    try {
        // Check if file exists before reading
        if (fs.existsSync(filePath)) {
            markdownContent = fs.readFileSync(filePath, 'utf-8');
        } else {
            markdownContent = `# File not found\nCould not locate: ${articleId}.md`;
        }
    } catch (err) {
        // Handle potential read errors
        markdownContent = "# Error reading file\n" + err.message;
    }

    // Pass the content to EJS template
    res.render('viewArticle', {
        initialMarkdown: markdownContent,
        articleId: articleId
    });
});

// API Route: Get word details from dictionary service
app.get('/api/dictionary/:word', (req, res) => {
    // Sanitize input: remove non-alphabetic characters
    const word = req.params.word.replace(/[^a-zA-Z]/g, '');

    // Fetch data from service
    const details = getWordDetails(word);

    // Return JSON response based on result
    if (details) {
        res.json({ success: true, data: details });
    } else {
        res.json({ success: false, message: "Word not found" });
    }
});

// --- Server Activation ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
