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

/**
 * Helper: Delay execution for a given time
 * @param { number } ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

router.post('/ai-explain', async (req, res) => {
    const { text, context } = req.body;

    // Validate input
    if (!text) {
        return res.status(400).json({ success: false, message: 'No text provided' });
    }

    // 1. Separate large system prompt for cleaner logic
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

    // 2. API Endpoint configuration (Using Gemini)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

    // 3. Retry Strategy Configuration
    const MAX_RETRIES = 3;
    let retryCount = 0;

    // Execute logic within a retry loop to handle transient failures
    while (retryCount <= MAX_RETRIES) {
        try {
            // Setup request timeout (20 seconds)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: `Context: ${context}\nTarget: ${text}` }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 2048,
                        responseMimeType: "application/json"
                    }
                })
            });

            clearTimeout(timeoutId);
            const result = await response.json();

            // 4. Handle API Errors
            if (result.error) {
                const errMsg = result.error.message;

                // Scenario A: Regional Restriction (CRITICAL)
                // Google often returns this when the IP is from Hong Kong or mainland China.
                if (errMsg.includes('location is not supported')) {
                    console.error("Critical: Regional restriction detected.");
                    // Return 403 immediately, do not retry.
                    return res.status(403).json({
                        success: false,
                        message: "Google API does not support your server's current location (Region Restricted).\n If you are in HK/China, please use a VPN/Proxy."
                    });
                }

                // Scenario B: Transient Service Overload
                const isHighDemand = response.status === 503 || errMsg.includes('high demand');
                if (isHighDemand && retryCount < MAX_RETRIES) {
                    retryCount++;
                    const delay = Math.pow(2, retryCount) * 1000;
                    console.warn(`Gemini Busy. Retrying in ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }

                // Scenario C: Other API errors (e.g., Invalid Key)
                // We throw this so it gets caught by the catch block below
                throw new Error(errMsg);
            }

            // 5. Validate Candidate Output
            if (!result.candidates || result.candidates.length === 0) {
                console.warn("Gemini Warning: Safety filter blocked the response.");
                return res.status(200).json({
                    success: false,
                    message: 'Response blocked by safety filters. Please try a different selection.'
                });
            }

            const candidate = result.candidates[0];

            // Handle output truncation due to token limits
            if (candidate.finishReason === 'MAX_TOKENS') {
                console.error("Gemini Error: Output truncated by maxOutputTokens.");
                return res.status(500).json({
                    success: false,
                    message: 'Analysis is too long. Please try a shorter selection.'
                });
            }

            // 6. Final Data Extraction and Parsing
            try {
                const rawText = candidate.content.parts[0].text;
                const aiData = JSON.parse(rawText);
                return res.json({ success: true, data: aiData });
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError, "Raw Text:", candidate.content.parts[0].text);
                return res.status(500).json({ success: false, message: 'Failed to parse AI response schema.' });
            }

        } catch (error) {
            // Handle Request Timeout
            if (error.name === 'AbortError') {
                return res.status(504).json({ success: false, message: 'AI Engine timeout (20s).' });
            }

            // Determine if we should retry or fail
            const recoverable = error.message.includes('high demand') || error.message.includes('fetch failed');

            if (retryCount >= MAX_RETRIES || !recoverable) {
                console.error("Gemini API Final Failure:", error.message);

                // 🔥 FIX: Return the ACTUAL error message to the user instead of a generic one.
                return res.status(500).json({
                    success: false,
                    message: `AI Engine Error: ${error.message}`,
                    suggestion: error.message.includes('location') ? "Please check your server's regional IP." : "Try again later."
                });
            }

            // Retry logic for recoverable errors
            retryCount++;
            await sleep(1000);
        }
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