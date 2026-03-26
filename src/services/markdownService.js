class MarkdownService {
    static formatFullArticle(article) {

        if (!article) return 'Error: No article data provided.';

        const categoryDisplay = Array.isArray(article.category)
            ? article.category.join(' / ')
            : (article.category || 'Uncategorized');

        const header = [
            `# ${article.title || 'Untitled'}`,
            `> **Author:** ${article.author || 'Unknown'} | **Site:** ${article.siteName || 'Unknown'}`,
            `> **Date:** ${article.originalDate || 'N/A'} | **Category:** ${categoryDisplay}`,
            article.originalUrl ? `> [Read Original Article](${article.originalUrl})` : '',
            '---',
            article.summary ? `**Summary:** ${article.summary}\n\n---` : '',
        ].filter(Boolean).join('\n\n');

        const finalMarkdown = `${header}\n\n${article.content || ''}`;

        console.log("Final Markdown Header Preview:", finalMarkdown.substring(0, 100));
        return finalMarkdown;
    }
}
module.exports = MarkdownService;