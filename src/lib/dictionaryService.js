const Database = require('better-sqlite3');
const path = require('path');
const chalk = require('chalk');

/**
 * StarDict Interface - Encapsulates DB operations for future-proofing
 */
class StarDict {
    constructor(dbPath) {
        this.db = new Database(dbPath, { readonly: true });
    }

    /**
     * Query a single word with full metadata
     */
    query(word) {
        const row = this.db.prepare(
            'SELECT word, translation, tag, frq, collins, oxford FROM stardict WHERE word = ?'
        ).get(word.toLowerCase());
        return row || null;
    }

    /**
     * Batch query for performance optimization
     */
    queryBatch(words) {
        const placeholders = words.map(() => '?').join(',');
        return this.db.prepare(`SELECT * FROM stardict WHERE word IN (${placeholders})`).all(...words);
    }
}

const sd = new StarDict(path.join(__dirname, '../data/stardict.db'));

/**
 * Core Annotation Logic: Filters words based on difficulty and corpus data
 */
function getHardWordAnnotation(word) {
    let cleanWord = word.toLowerCase();
    if (cleanWord.length < 5) return null;

    let res = sd.query(cleanWord);

    // 1. Lemmatization: Attempt to find the root form for verbs/plurals
    let isLemmatized = false;
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
            // If stem is more common/valid, inherit its metadata
            if (baseRes && baseRes.frq < (res.frq || 99999)) {
                res.frq = baseRes.frq;
                res.tag = baseRes.tag;
                res.collins = baseRes.collins;
                res.oxford = baseRes.oxford;
                isLemmatized = true;
                break;
            }
        }
    }

    if (!res) return null;

    const frq = res.frq || 99999;
    const tag = res.tag || '';
    const collins = res.collins || 0;
    const oxford = res.oxford || 0;

    // A. Basic Word Check: One-vote veto for elementary vocabulary
    const isBasic = (collins >= 3) || (oxford === 1) || /zk|gk|cet4/.test(tag);

    // B. Frequency Check: Threshold for common words
    const isCommon = frq > 0 && frq < 4000;

    // C. Advanced/Academic Check: Target vocabulary (TOEFL/GRE/IELTS)
    const isAdvanced = (collins > 0 && collins <= 2) || /toefl|gre|ielts/.test(tag);

    // D. Rare/Technical Check: Unlabeled low-frequency words
    const isRareTechnical = (tag === '' && collins === 0 && frq > 8000);

    // 3. Final Annotation Decision
    let shouldAnnotate = false;

    if (isBasic || frq >= 99999) {
        shouldAnnotate = false; // Veto basic/invalid words
    } else if (isAdvanced) {
        shouldAnnotate = true;  // Pass academic words
    } else if (isRareTechnical || !isCommon) {
        shouldAnnotate = true;  // Pass rare jargon
    }

    // Debugging for specific keywords
    if (['treatment', 'cells', 'doctors', 'immune', 'tumor'].includes(cleanWord)) {
        console.log(chalk.yellow(`[DEBUG] ${cleanWord} | Collins: ${collins} | Oxford: ${oxford} | Tag: "${tag}" | FRQ: ${frq}`));
        console.log(chalk.blue(`        isBasic: ${isBasic}, isAdvanced: ${isAdvanced}, should: ${shouldAnnotate}`));
    }

    if (shouldAnnotate && res.translation) {
        return getCleanTranslation(res.translation);
    }

    return null;
}

/**
 * Translation Cleaning: Extracts the most relevant Chinese meanings
 */
function getCleanTranslation(translation) {
    if (!translation) return null;

    // Extract first line and remove parentheses
    const firstLine = translation.split('\n')[0].trim();
    let meaningsPart = firstLine.replace(/[\(\（].*?[\)\）]/g, '').trim();

    // Split and return the first two definitions
    const meanings = meaningsPart
        .split(/[,；;]/)
        .map(m => m.trim())
        .filter(m => m.length > 0)
        .slice(0, 2)
        .join(', ');

    return meanings || null;
}

/**
 * Markdown Processor: Scans text for hard words to annotate
 */
function annotateMarkdown(text) {
    // Matches English words 4 characters or longer
    return text.replace(/\b[a-zA-Z]{4,}\b/g, (word) => {
        const annotation = getHardWordAnnotation(word);
        if (annotation) {
            return `${word} *(${annotation})*`;
        }
        return word;
    });
}

module.exports = { annotateMarkdown };