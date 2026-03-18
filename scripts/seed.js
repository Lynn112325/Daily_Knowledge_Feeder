// scripts/seed.js
const scienceDaily = require('../src/strategies/scienceDaily');
const { syncCategories } = require('../src/lib/sourceManager');
const connectDB = require('../src/config/db');
const globalConfig = require('../src/config/global');

async function start() {
    await connectDB();

    await syncCategories(scienceDaily, globalConfig.USER_AGENT);

    process.exit(0);
}

start();