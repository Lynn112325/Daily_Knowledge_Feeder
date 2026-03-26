const Database = require('better-sqlite3');
const path = require('path');

/**
 * StarDict Interface: Encapsulates SQLite operations
 */
class StarDict {
    constructor(dbPath) {
        // Initialize database in read-only mode
        this.db = new Database(dbPath, { readonly: true });
    }

    /**
     * Query a single word's metadata
     */
    query(word) {
        const row = this.db.prepare(
            'SELECT word, translation, tag, frq, collins, oxford FROM stardict WHERE word = ?'
        ).get(word.toLowerCase());
        return row || null;
    }

    /**
     * Batch query for multiple words (performance optimization)
     */
    queryBatch(words) {
        const placeholders = words.map(() => '?').join(',');
        return this.db.prepare(`SELECT * FROM stardict WHERE word IN (${placeholders})`).all(...words);
    }
}

// Initialize database instance
const sd = new StarDict(path.join(__dirname, '../data/stardict.db'));

/**
 * Core Logic: Determines if a word needs an annotation based on difficulty
 */
async function getHardWordAnnotation(word) {
    let cleanWord = word.toLowerCase();
    if (cleanWord.length < 5) return null; // Skip short words

    let res = sd.query(cleanWord);

    // 1. Lemmatization: Attempt to find the root form (e.g., "running" -> "run")
    if (res && (res.frq > 15000 || res.tag === '')) {
        const stems = [
            cleanWord.replace(/ed$/, ''),
            cleanWord.replace(/d$/, ''),
            cleanWord.replace(/s$/, ''),
            cleanWord.replace(/ings$/, 'ing'),
            cleanWord.replace(/ings$/, ''),
            cleanWord.replace(/ing$/, '')
        ];

        for (const stem of stems) {
            if (stem === cleanWord) continue;
            const baseRes = sd.query(stem);
            // If the root form is more common, inherit its metadata
            if (baseRes && baseRes.frq < (res.frq || 99999)) {
                Object.assign(res, {
                    frq: baseRes.frq,
                    tag: baseRes.tag,
                    collins: baseRes.collins,
                    oxford: baseRes.oxford
                });
                break;
            }
        }
    }

    if (!res) return null;

    // Define difficulty metrics
    const frq = res.frq || 99999;
    const tag = res.tag || '';
    const collins = res.collins || 0;
    const oxford = res.oxford || 0;

    // A. Filter basic vocabulary (Common/School level)
    const isBasic = (collins >= 3) || (oxford === 1) || /zk|gk|cet4/.test(tag);

    // B. Filter very common words by frequency
    const isCommon = frq > 0 && frq < 4000;

    // C. Identify advanced/academic words (TOEFL/GRE/IELTS)
    const isAdvanced = (collins > 0 && collins <= 2) || /toefl|gre|ielts/.test(tag);

    // D. Identify rare or technical jargon
    const isRareTechnical = (tag === '' && collins === 0 && frq > 8000);

    // Annotation Decision Logic
    let shouldAnnotate = false;

    if (isBasic || frq >= 99999) {
        shouldAnnotate = false; // Ignore easy or invalid words
    } else if (isAdvanced || isRareTechnical || !isCommon) {
        shouldAnnotate = true;  // Mark difficult or academic words
    }

    return (shouldAnnotate && res.translation) ? await getCleanTranslation(res.translation) : null;
}

/**
 * Helper: Extracts clean, concise Chinese definitions
 */
async function getCleanTranslation(translation) {
    if (!translation) return null;

    // Get the first line and remove content inside brackets
    const firstLine = translation.split('\n')[0].trim();
    let meaningsPart = firstLine.replace(/[\(\（].*?[\)\）]/g, '').trim();

    // Split by delimiters and return the first two meanings
    const meanings = meaningsPart
        .split(/[,；;]/)
        .map(m => m.trim())
        .filter(m => m.length > 0)
        .slice(0, 2)
        .join(', ');

    return meanings || null;
}


/**
 * Processes Markdown text to add inline Chinese annotations for difficult English words.
 * Uses a batch-processing approach to handle asynchronous dictionary lookups efficiently.
 */
async function annotateMarkdown(text) {
    // 1. Guard clause: Return early if text is empty
    if (!text) return text;
    const placeholders = [];
    // 保護 圖片 ![alt](url)、連結 [text](url)、以及代碼塊 `code`
    // 這個正則會匹配這些區塊並暫時存入 placeholders 陣列
    const protectedText = text.replace(/(!?\[.*?\]\(.*?\))|(`.*?`)/g, (match) => {
        const id = `__PROTECTED_${placeholders.length}__`;
        placeholders.push(match);
        return id;
    });

    // --- 2. 提取階段：只從「非保護區」提取單字 ---
    const words = Array.from(new Set(protectedText.match(/\b[a-zA-Z]{3,}\b/g) || []));
    // 2. Extraction: Identify unique English words (3+ characters) to avoid redundant lookups
    // const words = Array.from(new Set(text.match(/\b[a-zA-Z]{3,}\b/g) || []));

    // 3. Storage: Initialize a Map to store word-to-translation pairs
    const annotationMap = new Map();

    // 4. Batch Processing: Run all dictionary queries in parallel for high performance
    await Promise.all(words.map(async (word) => {
        const annotation = await getHardWordAnnotation(word);
        if (annotation) {
            // Only store if the word meets the difficulty criteria and has a translation
            annotationMap.set(word, annotation);
        }
    }));

    let annotatedText = protectedText.replace(/\b[a-zA-Z]{3,}\b/g, (word) => {
        const ann = annotationMap.get(word);
        return ann ? `${word} ==(${ann})==` : word;
    });

    // --- 5. 還原階段：把佔位符換回原始的 Markdown ---
    return annotatedText.replace(/__PROTECTED_(\d+)__/g, (match, index) => {
        return placeholders[parseInt(index)];
    });
}

/**
 * Public API: Get full database row for a specific word
 */
function getWordDetails(word) {
    let cleanWord = word.toLowerCase().trim();
    return cleanWord ? sd.query(cleanWord) : null;
}

module.exports = { annotateMarkdown, getWordDetails };