const scienceDailyStrategy = require('../strategies/scienceDaily');

const SOURCES = [
    {
        name: 'ScienceDaily Top News',
        source: scienceDailyStrategy,
        listUrl: 'https://www.sciencedaily.com/news/top/science/',
        enabled: false
    },

];

module.exports = { SOURCES, USER_AGENT: 'KnowledgeFeederBot/1.0' };