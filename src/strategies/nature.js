const he = require('he');

const natureStrategy = {
    name: 'Nature News',
    domain: 'nature.com',

    listConfig: {
        container: 'article',
        linkSelector: 'a[data-track-label="link"]',
        baseUrl: 'https://www.nature.com',
        limit: 3
    },

    extract: function ($) {
        // 1. Metadata from Meta Tags (Much more reliable)
        // Corrected og:title selector (property vs name)
        const title = $('meta[property="og:title"]').attr('content') ||
            $('h1').first().text().trim();

        const date = $('meta[name="dc.date"]').attr('content') ||
            $('meta[property="article:published_time"]').attr('content');

        // Handle dc.creator (Nature often uses multiple creator tags)
        const creators = $('meta[name="dc.creator"]').map((i, el) => $(el).attr('content')).get();
        const author = creators.length > 0 ? creators.join(', ') : 'Nature Staff';

        // 2. Tags (Nature uses multiple dc.subject tags)
        // We look in meta keywords, dc.subject, and the JSON-LD script for maximum coverage
        const dcSubjects = $('meta[name="dc.subject"]').map((i, el) => $(el).attr('content')).get();
        const newsKeywords = $('meta[name="news_keywords"]').attr('content')?.split(',') || [];

        let keywords = [...new Set([...dcSubjects, ...newsKeywords])]
            .map(k => k.trim())
            .filter(k => k !== "" && k.toLowerCase() !== "multidisciplinary");

        // 3. High-Res Image
        const image = $('meta[property="og:image"]').attr('content') || '';

        // 4. Content Cleaning Logic
        // Target specific Nature article body containers
        const contentSelector = '.c-article-body, .article-item__body, .c-article-section__content';
        let $content = $(contentSelector).clone();

        // Strip UI noise: ads, paywall prompts, sidebars, and subscription CTAs
        $content.find('.c-article-ad, .c-article-access-options, .c-article-upgrade, #login-menu, .c-ads, aside, .c-article-magazine-subscription-ad, .c-article-access-indicator').remove();
        $content.find('article.recommended, article.pull, aside, .c-article-ad, .c-article-related-articles').remove();

        $content.find('p').each((i, el) => {
            if ($(el).text().includes('Related article')) {
                $(el).remove();
            }
        });
        let rawHtmlContent = $content.html();
        // Minimize HTML by removing whitespace between tags
        if (rawHtmlContent) {
            rawHtmlContent = rawHtmlContent.replace(/>\s+</g, '><').trim();
        }


        // // Extra guard: if HTML conversion results in login text, mark as protected
        if (rawHtmlContent && rawHtmlContent.includes('Sign in or create an account')) {
            // We could potentially slice the content to keep only the part before the paywall
            rawHtmlContent = rawHtmlContent.split('Enjoying our latest content?')[0];
        }

        return {
            title: he.decode(title),
            date,
            author: he.decode(author),
            keywords,
            image,
            summary: he.decode($('meta[name="description"]').attr('content') || ''),
            rawHtmlContent: rawHtmlContent || 'Content protected or not found.'
        };
    }
};

module.exports = natureStrategy;