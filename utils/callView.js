const { getSupraClient } = require('./supraClient');
const { CONFIG } = require('../config/config');

async function callView(moduleAddr, fn, types = [], args = []) {
    for (let attempt = 0; attempt < CONFIG.viewRetries; attempt++) {
        try {
            const client = await getSupraClient();
            const fullPath = `${moduleAddr}::router::${fn}`;
            const result = await client.invokeViewMethod(fullPath, types, args);
            return result?.result ?? result;
        } catch (err) {
            if (attempt === CONFIG.viewRetries - 1) throw err;
            await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 200));
        }
    }
}

module.exports = callView;