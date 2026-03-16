const fs = require('fs');
const path = require('path');

/**
 * Generates an encapsulated static configuration file.
 * @param {Array} sourcesArray - Raw source data from the crawler.
 * @param {String} fileName - The filename (e.g., 'scienceDaily').
 */
function saveSourcesToStaticFile(sourcesArray, fileName) {
    const targetPath = path.join(__dirname, `../config/sources/${fileName}.js`);
    const strategyName = `${fileName}Strategy`;

    // 1. Organize data into a category map (Group by mainCategory)
    const categoryMap = {};
    sourcesArray.forEach(s => {
        if (!categoryMap[s.mainCategory]) categoryMap[s.mainCategory] = [];

        // Extract relative path from full URL
        // Example: https://www.sciencedaily.com/news/path/ -> path
        const pathPart = s.listUrl
            .replace('https://www.sciencedaily.com/news/', '')
            .replace(/\/$/, '');

        categoryMap[s.mainCategory].push({
            sub: s.category,
            path: pathPart
        });
    });

    // 2. Convert categoryMap object to a formatted JSON string
    const mapString = JSON.stringify(categoryMap, null, 4);

    // 3. Construct the output file content
    const fileContent = `/**
 * Auto-generated Static Sources List for ${fileName}
 * Generated on: ${new Date().toISOString()}
 */
const ${strategyName} = require('../../strategies/${fileName}');
const { createStandardConfig } = require('../SourceFactory');

const BASE_URL = "https://www.sciencedaily.com/news";

const CATEGORY_MAP = ${mapString};

module.exports = createStandardConfig({
    strategy: ${strategyName},
    categoryMap: CATEGORY_MAP,
    baseUrl: BASE_URL,
    prefix: 'SD'
});
`;

    // 4. Ensure directory exists and write the file
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(targetPath, fileContent);
    console.log(`✨ Successfully generated config file: ${targetPath}`);
}

module.exports = { saveSourcesToStaticFile };