class MarkdownService {
    // Unique identifier to separate system-generated header from user content
    static MARKER_UUID = 'System boundary, please do not edit or delete!';

    // Hidden HTML marker used as a split point
    static CONTENT_SEPARATOR = `\n<span id="protection-marker" data-info="${this.MARKER_UUID}"></span>\n\n`;

    /**
     * Splits the full markdown into system header (metadata/summary) and user content
     * @param {string} fullMarkdown 
     * @returns {Object} { summary, content }
     */
    static extractContent(fullMarkdown) {
        // Validate existence of the system marker
        if (!fullMarkdown.includes(this.MARKER_UUID)) {
            throw new Error('PROTECTION_MARKER_DELETED');
        }

        // Split by the exact separator string
        const parts = fullMarkdown.split(this.CONTENT_SEPARATOR);

        // Handle cases where the marker exists but structural characters (newlines) were altered
        if (parts.length < 2) {
            throw new Error('MARKER_CORRUPTED');
        }

        const headerPart = parts[0].trim();
        const contentPart = parts[parts.length - 1].trim();

        // Extract Summary using regex (targets text between "**Summary:**" and the next "---")
        const summaryMatch = headerPart.match(/\*\*Summary:\*\*\s*([\s\S]*?)\n\n---/);
        const summary = summaryMatch ? summaryMatch[1].trim() : null;

        return {
            summary: summary,
            content: contentPart
        };
    }

    /**
     * Combines metadata and content into a single formatted Markdown string
     * @param {Object} article 
     * @returns {string}
     */
    static formatFullArticle(article) {
        if (!article) return 'Error: No article data provided.';

        const categoryDisplay = Array.isArray(article.category)
            ? article.category.join(' / ')
            : (article.category || 'Uncategorized');

        // Generate the metadata header
        const header = [
            `# ${article.title || 'Untitled'}`,
            `> **Author:** ${article.author || 'Unknown'} | **Site:** ${article.siteName || 'Unknown'}`,
            `> **Date:** ${article.originalDate || 'N/A'} | **Category:** ${categoryDisplay}`,
            article.originalUrl ? `> [Read Original Article](${article.originalUrl})` : '',
            '---',
            article.summary ? `**Summary:** ${article.summary}\n\n---` : '',
        ].filter(Boolean).join('\n\n');

        // Append the separator and user-editable content
        return `${header}${this.CONTENT_SEPARATOR}${article.content || ''}`;
    }
}

module.exports = MarkdownService;