// Import configuration files for each specific website
const scienceDaily = require('./sources/scienceDaily');

// Combine all sources into one main array
const ALL_SOURCES = [
    ...(scienceDaily.sources || []), // 加上保護，防止 scienceDaily 為空
];

// Export everything as a single object for the app to use
module.exports = {
    SOURCES: ALL_SOURCES,
    STRATEGIES: {
        scienceDaily: scienceDaily.strategy
    }
};