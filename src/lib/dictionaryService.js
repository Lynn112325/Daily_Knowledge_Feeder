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
 * Adds Chinese annotations to difficult English words in Markdown.
 * Uses a placeholder system to protect Markdown syntax from being modified.
 */
async function annotateMarkdown(text) {
    if (!text) return text;

    const placeholders = [];

    // 1. Protect: Replace Markdown images, links, and code blocks with IDs
    const protectedText = text.replace(/(!?\[.*?\]\(.*?\))|(`.*?`)/g, (match) => {
        const id = `__PROTECTED_${placeholders.length}__`;
        placeholders.push(match);
        return id;
    });

    // 2. Extract: Get unique English words (3+ chars) from unprotected text
    const words = Array.from(new Set(protectedText.match(/\b[a-zA-Z]{3,}\b/g) || []));
    const annotationMap = new Map();

    // 3. Batch Process: Perform dictionary lookups in parallel
    await Promise.all(words.map(async (word) => {
        const annotation = await getHardWordAnnotation(word);
        if (annotation) {
            annotationMap.set(word, annotation);
        }
    }));

    // 4. Annotate: Insert annotations using the Mark highlighting syntax ==(translation)==
    let annotatedText = protectedText.replace(/\b[a-zA-Z]{3,}\b/g, (word) => {
        const ann = annotationMap.get(word);
        return ann ? `${word} ==(${ann})==` : word;
    });

    // 5. Restore: Swap placeholders back with original Markdown content
    return annotatedText.replace(/__PROTECTED_(\d+)__/g, (_, index) => {
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