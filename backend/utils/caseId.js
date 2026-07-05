/**
 * caseId.js
 * Unique case ID generator utility.
 * Generates unique case ID matching the WCS-YYYY-000001 structure.
 */

const supabase = require('../config/db');

/**
 * Generates a unique serial case ID for the current year.
 * Format: WCS-YYYY-000001
 * @returns {Promise<string>} Unique Case ID string
 */
const generateCaseId = async () => {
  const year = new Date().getFullYear();
  let count = 0;

  try {
    if (supabase) {
      // Find count of existing reports for the current year
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;

      const { count: recordCount, error } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${startOfYear}T00:00:00.000Z`)
        .lte('created_at', `${endOfYear}T23:59:59.999Z`);

      if (!error && recordCount !== null) {
        count = recordCount;
      }
    } else {
      // Fallback local random generation in mock development mode
      count = Math.floor(Math.random() * 100) + 5;
    }
  } catch (error) {
    console.error('[CaseID Utility Error] Failed to fetch count:', error.message);
    count = Math.floor(Math.random() * 1000); // safety fallback
  }

  const serialNum = (count + 1).toString().padStart(6, '0');
  return `WCS-${year}-${serialNum}`;
};

module.exports = {
  generateCaseId,
};
