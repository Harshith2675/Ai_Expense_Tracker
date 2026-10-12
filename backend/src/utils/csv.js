/**
 * CSV Sanitation Utilities
 * Defends against CSV Formula Injection (=, +, -, @, Tab, CR)
 */
module.exports = {
  sanitizeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const s = String(val);
    const dangerChars = ['=', '+', '-', '@', '\t', '\r'];
    if (dangerChars.some(c => s.startsWith(c))) {
      return `"'${s.replace(/"/g, '""')}"`;
    }
    return `"${s.replace(/"/g, '""')}"`;
  }
};
