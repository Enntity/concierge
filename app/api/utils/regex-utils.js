/**
 * Escape regex special characters to prevent ReDoS attacks
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string safe for use in regex patterns
 */
export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
