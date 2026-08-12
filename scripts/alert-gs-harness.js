// Minimal Apps Script stubs so the pure logic in ALERT.gs can be executed in Node.
const fs = require('fs');
const logs = [];
global.Logger = { log: m => logs.push(String(m)) };
const pad = (n, w = 2) => String(n).padStart(w, '0');
global.Utilities = {
  formatDate(d, tz, fmt) {
    return fmt
      .replace('yyyy', d.getFullYear())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('dd', pad(d.getDate()))
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()));
  },
  sleep() {},
};
// getFormUrlForDept_ reads the sheet; stub an empty spreadsheet so it falls
// back to DEPT_FORM_URLS, which is what a fresh install does.
global.SpreadsheetApp = { openById: () => ({ getSheetByName: () => null }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
global.ScriptApp = { getProjectTriggers: () => [], getService: () => ({ getUrl: () => '' }) };
global.UrlFetchApp = { fetch: () => {} };

const src = fs.readFileSync(process.argv[2], 'utf8');
try {
  (0, eval)(src);          // parse + define at global scope
} catch (e) {
  console.error('❌ SYNTAX/LOAD ERROR:', e.message);
  process.exit(1);
}
console.log('✅ parsed and loaded');

try {
  testComplianceScoring();
} catch (e) {
  logs.forEach(l => console.log('  ' + l));
  console.error('❌ ' + e.message);
  process.exit(1);
}
logs.forEach(l => console.log('  ' + l));
