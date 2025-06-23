/**
 * Format a date for display
 * @param {Date} date - The date to format
 * @returns {string} The formatted date
 */
export function formatDate(date) {
  if (!date) return "N/A";

  // Use the globally available dateFns object
  return dateFns.formatDistanceToNow(date, { addSuffix: true });
}
