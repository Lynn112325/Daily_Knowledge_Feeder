const express = require('express');
const router = express.Router();
const { getWordDetails } = require('../lib/dictionaryService');

router.get('/api/dictionary/:word', (req, res) => {
    const word = req.params.word.replace(/[^a-zA-Z]/g, '');
    const details = getWordDetails(word);
    res.json(details ? { success: true, data: details } : { success: false });
});
module.exports = router;