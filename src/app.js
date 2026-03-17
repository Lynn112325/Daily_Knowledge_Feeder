const express = require('express');
const path = require('path');
const fs = require('fs');
const { getWordDetails } = require('./lib/dictionaryService');

const app = express();

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


// Main Route: Read Markdown file and render the page
app.get('/', (req, res) => {
    const fileName = 'Severe COVID or flu may raise lung cancer risk years later';
    // Define the path to the target Markdown fileconst fileName = 'Severe COVID or flu may raise lung cancer risk years later';
    const filePath = path.join(__dirname, `../output/Health/Allergy/${fileName}.md`);

    let markdownContent = "# Loading Error"; // Default message

    try {
        // Check if file exists before reading
        if (fs.existsSync(filePath)) {
            markdownContent = fs.readFileSync(filePath, 'utf-8');
        } else {
            markdownContent = "# File not found\nPath: " + filePath;
        }
    } catch (err) {
        // Handle potential read errors
        markdownContent = "# Error reading file\n" + err.message;
    }

    // Pass the content to EJS template
    res.render('viewArticle', {
        initialMarkdown: markdownContent,
        articleId: fileName
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