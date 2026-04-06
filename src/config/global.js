// src/config/global.js
module.exports = {
    USER_AGENT: 'KnowledgeFeederBot/1.0',
    BATCH_SIZE: parseInt(process.env.CRAWLER_BATCH_SIZE) || 10,
    TIMEZONE: process.env.timezone || "Asia/Hong_Kong"
};