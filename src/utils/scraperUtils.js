const scraperUtils = {
    /**
     * Get high-quality image URL (handles srcset and relative paths)
     */
    resolveImageUrl: ($, imgEl, baseUrl) => {
        if (!imgEl || imgEl.length === 0) return null;

        const srcset = imgEl.attr('srcset');
        // Get the largest image from srcset, otherwise fallback to src
        let path = srcset
            ? srcset.split(',').pop().trim().split(' ')[0]
            : imgEl.attr('src');

        if (!path) return null;

        // Convert relative path to absolute URL
        if (!path.startsWith('http')) {
            const origin = new URL(baseUrl).origin;
            path = path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`;
        }
        return path;
    },

    /**
     * Process content: Normalize image URLs and prepend the lead image
     */
    processContent: ($, { bodySelector, leadImgSelector, baseUrl }) => {
        const $body = $(bodySelector);

        // 1. Update all images inside the body to high-res URLs
        $body.find('img').each((i, el) => {
            const $img = $(el);
            const highResUrl = scraperUtils.resolveImageUrl($, $img, baseUrl);
            if (highResUrl) {
                $img.attr('src', highResUrl);
            }
        });

        // 2. Handle the "Lead Image" (usually outside the body container)
        const $leadImg = $(leadImgSelector);
        const leadImageUrl = scraperUtils.resolveImageUrl($, $leadImg, baseUrl);

        let finalHtml = $body.html();

        if (leadImageUrl) {
            const alt = $leadImg.attr('alt') || 'lead image';
            // Prepend lead image as HTML to avoid escaping issues in Markdown converters
            finalHtml = `<img src="${leadImageUrl}" alt="${alt}">\n\n` + finalHtml;
        }

        return {
            contentHtml: finalHtml,
            leadImage: leadImageUrl
        };
    }
};

module.exports = scraperUtils;