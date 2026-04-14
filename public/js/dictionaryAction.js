(function () {
    // Global state to store current selection and audio instance
    const State = {
        selectedText: '',
        contextText: '',
        currentAudio: null
    };

    // Initialize tooltip element and prevent text selection conflicts
    const tooltip = document.getElementById('tooltip');
    tooltip.addEventListener('mousedown', (e) => e.stopPropagation());
    tooltip.addEventListener('mouseup', (e) => e.stopPropagation());

    const Utils = {
        // Prevent XSS by converting special characters to HTML entities
        escapeHtml: (str) => {
            if (!str) return '';
            return str.replace(/[&<>'"]/g, tag => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            }[tag] || tag));
        },
        // Remove markdown formatting and extra whitespace
        cleanSelectedText: (rawText) => {
            if (!rawText) return "";
            return rawText
                .replace(/_([^_]+)_/g, '$1')
                .replace(/==\(.*?\)==/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        },
        // Convert newline-separated dictionary text into HTML divs
        formatDictTranslation: (translation) => {
            if (!translation) return '';
            return translation
                .trim()
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => `<div class="mb-1">${line}</div>`)
                .join('');
        },
        // Smart selection: expands highlight to capture the full word
        expandSelectionToWord: () => {
            const sel = window.getSelection();
            if (sel.rangeCount === 0 || sel.isCollapsed) return '';
            let range = sel.getRangeAt(0).cloneRange();

            const originalStart = range.startOffset;
            const originalEnd = range.endOffset;
            const startNode = range.startContainer;
            const endNode = range.endContainer;

            if (startNode.nodeType !== Node.TEXT_NODE || endNode.nodeType !== Node.TEXT_NODE) {
                return sel.toString().trim();
            }

            // Define characters that separate words
            const isNotWordChar = /[^a-zA-Z0-9.\-\(\)\u4e00-\u9fa5]/;
            const isCleanup = /[^a-zA-Z0-9\-\(\)\u4e00-\u9fa5]/;

            // Expand range start backwards to the beginning of the word
            while (range.startOffset > 0) {
                const nextStart = range.startOffset - 1;
                range.setStart(startNode, nextStart);
                if (isNotWordChar.test(range.toString()[0])) {
                    range.setStart(startNode, nextStart + 1);
                    break;
                }
            }

            // Expand range end forwards to the end of the word
            while (range.endOffset < endNode.length) {
                const nextEnd = range.endOffset + 1;
                range.setEnd(endNode, nextEnd);
                const text = range.toString();
                if (isNotWordChar.test(text[text.length - 1])) {
                    range.setEnd(endNode, nextEnd - 1);
                    break;
                }
            }

            // Trim invalid symbols from the start/end of the expanded selection
            let currentText = range.toString();
            while (range.startOffset < originalStart && currentText.length > 0 && isCleanup.test(currentText[0])) {
                range.setStart(startNode, range.startOffset + 1);
                currentText = range.toString();
            }
            while (range.endOffset > originalEnd && currentText.length > 0 && isCleanup.test(currentText[currentText.length - 1])) {
                range.setEnd(endNode, range.endOffset - 1);
                currentText = range.toString();
            }

            // Apply the expanded range back to the browser selection
            sel.removeAllRanges();
            sel.addRange(range);

            return {
                text: currentText.trim(),
                context: startNode.parentNode ? startNode.parentNode.innerText : currentText.trim()
            };
        }
    };

    const AudioController = {
        // Text-to-Speech using Google Translate TTS API
        play: (text) => {
            const maxLength = 200;
            if (text.length > maxLength) {
                Swal.fire({
                    toast: true, position: 'top-end', icon: 'warning',
                    title: 'Text too long', text: `Limit is ${maxLength} chars.`,
                    showConfirmButton: false, timer: 3000, heightAuto: false,
                });
            }

            const safeText = text.substring(0, maxLength);
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=en&client=tw-ob`;

            // Stop current playback before starting new audio
            if (State.currentAudio) {
                State.currentAudio.pause();
                State.currentAudio.src = '';
                State.currentAudio = null;
            }

            const audio = new Audio(url);
            State.currentAudio = audio;

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error("TTS failed:", err);
                        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Playback Error', showConfirmButton: false, timer: 3000, heightAuto: false });
                    }
                });
            }
        }
    };

    const API = {
        // Fetch simple translation from Google
        getGoogleTranslate: async (text) => {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;
                const response = await fetch(url);
                const data = await response.json();
                return data[0].map(item => item[0]).join("");
            } catch (error) {
                console.error("Google Translate Error:", error);
                return "Translation failed. Please try AI Explain.";
            }
        },
        // Fetch detailed local dictionary data
        getDictionary: async (word) => {
            try {
                const res = await fetch(`/api/dictionary/${word}`);
                return await res.json();
            } catch (error) {
                console.error("Dictionary Error:", error);
                return { success: false };
            }
        },
        // Request deep analysis from LLM backend
        getAIExplain: async (text, context) => {
            const res = await fetch('/api/ai-explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, context })
            });
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        }
    };

    const UI = {
        // Shared Tailwind classes for tooltip styling
        baseTooltipClass: "p-4 min-w-[260px] max-w-[320px] bg-white/95 backdrop-blur-md text-slate-800 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-200/80 font-sans",

        // HTML for single-word dictionary lookup
        renderTooltipWordMode: (dict, safeText) => `
        <div class="${UI.baseTooltipClass}">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2.5">
                    <b class="text-slate-900 text-xl tracking-tight font-bold">${dict.word}</b>
                    <button class="action-speak text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all p-1.5 rounded-full" data-text="${safeText}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                    </button>
                </div>
                <button class="action-ai group bg-slate-900 hover:bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm">
                    <span class="group-hover:rotate-12 transition-transform">✨</span> AI Explain
                </button>
            </div>
            <div class="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-3 tracking-wider">
                <span class="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">COLLINS ${dict.collins || 0}★</span>
            </div>
            <div class="text-[14px] leading-relaxed text-slate-600 border-t border-slate-100 pt-3 italic font-serif">
                ${Utils.formatDictTranslation(dict.translation)}
            </div>
        </div>
    `,

        // HTML for multi-word sentence translation
        renderTooltipSentenceMode: (translatedText, safeText) => `
        <div class="${UI.baseTooltipClass}">
            <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                <span class="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Quick Translation</span>
                <button class="action-speak text-slate-400 hover:text-indigo-500 p-1.5 rounded-full transition-colors" data-text="${safeText}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                </button>
            </div>
            <p class="text-[14px] leading-relaxed mb-4 text-slate-700 font-medium">${translatedText}</p>
            <button class="action-ai w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2">
                ✨ Deep AI Analysis
            </button>
        </div>
    `,

        // HTML for the SweetAlert2 popup showing AI results
        renderAIResult: (data, safeText) => {
            const isWord = data.type === 'word';
            return `
        <div class="text-left font-sans antialiased max-w-lg" id="ai-result-container">
            <div class="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl mb-6 relative group transition-colors hover:bg-white hover:border-indigo-100">
                <div class="${isWord ? 'text-2xl font-bold text-slate-900' : 'text-slate-600 text-sm italic text-base'} leading-relaxed pr-10">
                    ${data.clean_text || State.selectedText}
                </div>
                <button class="action-speak absolute top-5 right-5 p-2 bg-white shadow-sm border border-slate-200 rounded-xl hover:text-indigo-600 hover:border-indigo-200 transition-all" data-text="${safeText}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                </button>
                ${isWord ? `<div class="mt-2 text-indigo-600 font-semibold text-sm">${data.pos || ''}</div>` : ''}
            </div>

            <div class="space-y-6 px-1">
                <section>
                    <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Meaning</h4>
                    <p class="text-slate-800 font-medium leading-snug text-md whitespace-pre-line">${data.meaning}</p>
                </section>

                ${data.grammar != "null" && data.grammar != null ? `
                <section>
                    <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Grammar & Structure</h4>
                    <div class="bg-indigo-50/30 border-l-4 border-indigo-200 px-5 py-4 rounded-r-2xl text-[14px] text-slate-700 leading-loose shadow-sm">
                        ${data.grammar}
                    </div>
                </section>
                ` : ''}

                ${data.extension != "null" && data.extension != null ? `
                <section class="pt-4 border-t border-slate-100">
                    <div class="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-widest mb-3">
                        <span class="text-lg">💡</span> Learning Insight
                    </div>
                    <p class="text-[14px] text-slate-600 leading-relaxed bg-amber-50/40 p-4 rounded-xl border
                        whitespace-pre-line border-amber-100/50 italic">${data.extension}</p>
                </section>
                ` : ''}
            </div>
        </div>`;
        }
    };

    // Helper to handle AI button click: shows loader, calls API, displays result
    const executeAIExplain = async () => {
        tooltip.style.display = 'none';
        Swal.fire({
            title: 'AI is analyzing...',
            text: 'This may take a few seconds...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            heightAuto: false,
        });

        try {
            const result = await API.getAIExplain(State.selectedText, State.contextText);
            if (result.success) {
                const textToSpeak = result.data.clean_text || State.selectedText;
                const htmlContent = UI.renderAIResult(result.data, Utils.escapeHtml(textToSpeak));

                Swal.fire({
                    title: 'Analysis Complete',
                    html: htmlContent,
                    confirmButtonText: 'Close',
                    customClass: { popup: 'ai-result-popup' },
                    didOpen: (popup) => {
                        const container = popup.querySelector('#ai-result-container');
                        if (container) {
                            container.addEventListener('click', (e) => {
                                const speakBtn = e.target.closest('.action-speak');
                                if (speakBtn) AudioController.play(speakBtn.dataset.text);
                            });
                        }
                    },
                    heightAuto: false,
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Analysis Failed', text: error.message || 'Make sure Ollama is running.', heightAuto: false, });
        }
    };

    // Global tooltip click listener for AI and Speech buttons
    tooltip.addEventListener('click', (e) => {
        const speakBtn = e.target.closest('.action-speak');
        if (speakBtn) AudioController.play(speakBtn.dataset.text);

        const aiBtn = e.target.closest('.action-ai');
        if (aiBtn) executeAIExplain();
    });

    // Main event: triggers when user releases mouse within the editor
    document.getElementById('vditor').addEventListener('mouseup', async (e) => {
        // Ignore clicks on editor buttons/toolbar
        if (e.target.closest('.vditor-toolbar') || e.target.closest('button')) {
            console.log("Toolbar clicked, ignoring selection.");
            return;
        }

        const selectionResult = Utils.expandSelectionToWord();
        if (!selectionResult || !selectionResult.text) return;

        const cleanedText = Utils.cleanSelectedText(selectionResult.text);
        const cleanedContext = Utils.cleanSelectedText(selectionResult.context);

        // Filter out selections that are too short or contain illegal characters
        const validRegex = /^[a-zA-Z0-9\s\u00A0,.'’":;?!°/_ \-\(\)\u4e00-\u9fa5\uff08\uff09\u3000-\u303f]{2,}$/;
        const isRegexValid = validRegex.test(cleanedText);
        console.log("Regex Test Result:", isRegexValid);

        if (validRegex.test(cleanedText)) {
            State.selectedText = cleanedText;
            State.contextText = cleanedContext;
            const safeTextForHtml = Utils.escapeHtml(cleanedText);
            const isSentence = cleanedText.trim().includes(' ');

            let renderedHtml = '';

            if (!isSentence) {
                // Fetch dictionary data for single words
                const dictData = await API.getDictionary(cleanedText);
                if (dictData.success) {
                    renderedHtml = UI.renderTooltipWordMode(dictData.data, safeTextForHtml);
                } else {
                    // Fallback to Google Translate if dictionary fails
                    const googleText = await API.getGoogleTranslate(cleanedText);
                    renderedHtml = UI.renderTooltipSentenceMode(googleText, safeTextForHtml);
                }
            } else {
                // Sentence Mode: simple translation
                const googleText = await API.getGoogleTranslate(cleanedText);
                renderedHtml = UI.renderTooltipSentenceMode(googleText, safeTextForHtml);
            }

            // Position and show the tooltip
            tooltip.innerHTML = renderedHtml;
            tooltip.style.left = e.clientX + 15 + 'px';
            tooltip.style.top = e.clientY + 15 + 'px';
            tooltip.style.display = 'block';
        }
    });

    // Hide tooltip when clicking elsewhere on the page
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('a')) return; // Ignore links
        if (!tooltip.contains(e.target)) tooltip.style.display = 'none';
    });

})();