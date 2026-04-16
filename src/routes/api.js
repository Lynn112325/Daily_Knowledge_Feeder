const express = require('express');
const router = express.Router();
const { getWordDetails } = require('../lib/dictionaryService');
const { API_KEY } = require('../config/global');
const { manualDailySync, getDailySyncStatus } = require('../services/scheduler');

router.get('/dictionary/:word', (req, res) => {
    const word = req.params.word.replace(/[^a-zA-Z]/g, '');
    const details = getWordDetails(word);
    res.json(details ? { success: true, data: details } : { success: false });
});

router.post('/ai-explain', async (req, res) => {
    const { text, context } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'No text provided' });

    const systemPrompt = `You are a top-tier Bilingual Linguist, Journalistic Editor, and English Teacher.
                Your task is to analyze the text inside <Target> based on the background <Context>.
                Showcase the true advantage of AI: providing deep contextual insights, natural phrasing, and explaining the "WHY" behind the language.

                [Core Rules]
                1. Respond STRICTLY in valid JSON.
                - All newlines within values MUST be escaped as "\\n". 
                - All double quotes within values MUST be escaped as '\"'.
                - Do not include any trailing commas.
                2. ALL explanations MUST be written in Traditional Chinese (Hong Kong).
                3. Distinguish if <Target> is a "word/phrase" or "sentence/clause".
                4. Dynamic Semantic Prosody is CRITICAL. You MUST analyze the emotional tone (Positive/Negative/Neutral) BEFORE translating.
                5. Translation Target Control:
                - If type is "word": The "meaning" field MUST ONLY contain the translation of the word/phrase itself (adapted to the context). DO NOT translate the whole sentence.
                - If type is "sentence": The "meaning" field should be a natural translation of the entire Target.
                If type is "word" or "phrase": Do NOT pull hidden subjects or external objects from the Context into the literal translation. Keep the translation focused strictly on the boundaries of the <Target> words.
                6. Word Deep Dive (For "word" type only):
                **ENTIRE Target** FIRST. Then, provide 1-2 alternative ways to express this concept or individual word meanings if useful.
                [JSON Output Schema]
                {
                    "type": "word" | "sentence",
                    "clean_text": "<exact English text from Target>",
                    "pos": "<part of speech of the context meaning, null if sentence>",
                    
                    // --- Step 1: Context & Sentiment Analysis ---
                    "context_sentiment": "<Positive | Negative | Neutral>",
                    "translation_strategy": "<Analyze the semantic prosody. Identify trap words in the Target. Explain how to adapt them to match the sentiment.>",

                    // --- Step 2: Vocabulary Mapping ---
                    // Map the English trap words to their contextualized Traditional Chinese translation.
                    "vocabulary_mapping": {
                        "<trap_word_1>": "<context-aware_chinese_translation>",
                    },
                    
                    // --- Step 3: Final Output ---
                    "meaning": "If sentence: Provide a natural Traditional Chinese translation using 'vocabulary_mapping'. If word/phrase: Use this format (separated by \\n): \n1. [Literal] Literal translation/structure (e.g., Too... to...) \n2. [Contextual] Meaning adapted to this specific context \n3. [POS] Basic definition of core words",
                    "grammar": "<For sentences: Explain the syntactic logic or rhetoric ('the WHY'). For phrases: Explain the collocation logic (e.g., adverb modifying a past participle). For single words: null.>",
                    "extension": "<For words: Explain the contextual meaning and provide 2+ practical English examples with Chinese explanations. For sentences: Provide 1 related English keyword or phrase with a Chinese explanation.>",
        }`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `Context: ${context}\nTarget: ${text}` }]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json"
                }
            })
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(`Google API Error: ${result.error.message}`);
        }

        // 1. Check for valid candidates (Handle Safety Filters)
        if (!result.candidates || result.candidates.length === 0) {
            console.warn("Gemini Warning: No candidates returned (likely safety filtered).");
            return res.status(200).json({
                success: false,
                message: 'Response blocked by safety filters. Please try a different selection.'
            });
        }

        const candidate = result.candidates[0];

        // 2. 🛡️ Handle Token Limit Truncation
        if (candidate.finishReason === 'MAX_TOKENS') {
            console.error("Gemini Error: Output truncated due to MAX_TOKENS limit.");
            return res.status(500).json({
                success: false,
                message: 'Analysis is too long and was truncated. Please try a shorter selection.'
            });
        }

        // 3. Extract and Parse
        try {
            const rawText = candidate.content.parts[0].text;
            const aiData = JSON.parse(rawText);
            res.json({ success: true, data: aiData });
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Raw Text:", candidate.content.parts[0].text);
            res.status(500).json({ success: false, message: 'Failed to parse AI response.' });
        }
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ success: false, message: 'AI Engine error.' });
    }
});

router.post('/daily-sync', async (req, res) => {
    try {
        // 1. Optional: Check if sync was already done today to prevent duplicates
        const dailySyncDone = await getDailySyncStatus();
        if (!dailySyncDone) {
            return res.status(400).json({
                success: false,
                message: 'System already synchronized for today.'
            });
        }

        // 2. Perform the heavy lifting
        // Using await to ensure the process finishes before responding
        const results = await manualDailySync();

        // 3. Return success
        return res.status(200).json({
            success: true,
            data: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('API Error [Daily Sync]:', error);

        // 4. Return structured error
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            details: error.message
        });
    }
});

module.exports = router;