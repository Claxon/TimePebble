// This file contains functions for formatting text content, like event descriptions.

/**
 * A list of replacement rules to apply to description text.
 * Each rule is an object with a regex pattern and the replacement string.
 * The 'g' flag is important to replace all occurrences.
 */
const descriptionReplacements = [
    // Replace 10 or more underscores with a themed horizontal rule.
    {
        regex: /_{10,}/g,
        replacement: '<hr class="description-hr">'
    },
    // Future rules can be added here, for example:
    // {
    //     regex: /\[link:(.*?)]/g,
    //     replacement: '<a href="$1" target="_blank">$1</a>'
    // }
];

/**
 * Formats a description string by applying a series of predefined regex replacements.
 * @param {string} text - The original description text.
 * @returns {string} The formatted HTML string.
 */
function formatDescription(text) {
    if (!text) return '';
    let formattedText = text;
    for (const rule of descriptionReplacements) {
        formattedText = formattedText.replace(rule.regex, rule.replacement);
    }
    return formattedText;
}
