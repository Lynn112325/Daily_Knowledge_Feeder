const scienceDailyStrategy = require('../strategies/scienceDaily');
const natureStrategy = require('../strategies/nature');

const SOURCES = [
    {
        name: 'ScienceDaily Top News',
        source: scienceDailyStrategy,
        listUrl: 'https://www.sciencedaily.com/news/top/science/',
        enabled: false
    },
    {
        name: 'Nature News',
        source: natureStrategy,
        listUrl: 'https://www.nature.com/nature/articles?type=news',
        enabled: true
    }
];

module.exports = { SOURCES, USER_AGENT: 'KnowledgeFeederBot/1.0' };