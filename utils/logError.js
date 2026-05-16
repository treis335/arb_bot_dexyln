const fs = require('fs');
const ERR_LOG = './arb_errors.log';
let errorCount = 0;
let lastError = null;

function logError(context, err) {
  errorCount++;
  lastError = `[${new Date().toISOString()}] ${context}: ${err?.message || err}`;
  try { fs.appendFileSync(ERR_LOG, lastError + '\n' + (err?.stack || '') + '\n\n'); } catch {}
}
module.exports = { logError, getErrorCount: () => errorCount, getLastError: () => lastError };