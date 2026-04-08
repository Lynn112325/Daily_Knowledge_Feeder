const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const config = require('../config/global');

// 1. Load required plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// 2. Set global default timezone based on system configuration
dayjs.tz.setDefault(config.TIMEZONE);

/**
 * Date Utility Helper
 * Provides standardized date handling across the application.
 */
const dateHelper = {
    /**
     * Core Logic: Parses input and converts it to a Day.js object in the configured timezone.
     * @param {any} input - Optional. Supports Date objects, strings, or timestamps.
     * @returns {dayjs.Dayjs}
     */
    parse: (input) => {
        return dayjs(input || new Date()).tz();
    },

    /**
     * Returns a formatted date-time string (YYYY-MM-DD HH:mm:ss).
     * @param {any} input
     * @returns {string}
     */
    getDateTime: (input = null) => {
        return dateHelper.parse(input).format('YYYY-MM-DD HH:mm:ss');
    },

    /**
     * Returns a standardized date string (YYYY-MM-DD).
     * @param {any} input
     * @returns {string}
     */
    getDate: (input = null) => {
        return dateHelper.parse(input).format('YYYY-MM-DD');
    }
};

module.exports = dateHelper;