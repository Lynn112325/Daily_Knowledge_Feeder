// src/lib/context.js
const { AsyncLocalStorage } = require('async_hooks');
const taskContext = new AsyncLocalStorage();

module.exports = { taskContext };