const scienceDailyStrategy = require('../strategies/scienceDaily');
// const techCrunchStrategy = require('../strategies/techCrunch'); // unimplemented

/**
 * List of all scraping tasks
 */
const SOURCES = [
    {
        name: 'ScienceDaily Top News',
        source: scienceDailyStrategy,
        listUrl: 'https://www.sciencedaily.com/news/top/science/',
        enabled: true
    },
    /* unimplemented
    {
        name: 'TechCrunch Startups',
        source: techCrunchStrategy,
        listUrl: 'https://techcrunch.com/category/startups/',
        enabled: false
    }
    */
];

module.exports = { SOURCES, USER_AGENT: 'KnowledgeFeederBot/1.0' };