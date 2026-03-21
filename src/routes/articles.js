const express = require('express');
const router = express.Router();
const Article = require('../models/Article');

// List: /articles
router.get('/', async (req, res) => {
    const articles = await Article.find().sort({ originalDate: -1 });
    res.render('articleList', {
        articles,
        title: 'All Articles',
        breadcrumbs: [{ name: 'Articles', url: '/articles' }, { name: 'List' }]
    });
});

// view：/articles/view/:id
router.get('/view/:id', async (req, res) => {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).send("Article Not Found");

    const categoryParts = article.category.split('/').filter(p => p);
    const breadcrumbs = [
        { name: 'Articles', url: '/articles' },
        ...categoryParts.map((cat, idx) => ({
            name: cat, url: `/articles?category=${categoryParts.slice(0, idx + 1).join('/')}`
        })),
        { name: article.title.substring(0, 20) + '...' }
    ];

    res.render('viewArticle', { article, title: article.title, breadcrumbs, needEditor: true });
});

module.exports = router;