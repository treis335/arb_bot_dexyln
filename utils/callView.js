// utils/callView.js (corrigido)
const axios = require('axios');
const { CONFIG } = require('../config/config');

async function callView(moduleAddr, fn, types = [], args = []) {
    for (let attempt = 0; attempt < CONFIG.viewRetries; attempt++) {
        try {
            const r = await axios.post(`${CONFIG.rpc}/rpc/v1/view`, {
                function: `${moduleAddr}::router::${fn}`,
                type_arguments: types,
                arguments: args,
            }, { timeout: CONFIG.viewTimeout });
            return r.data.result ?? r.data;
        } catch (err) {
            if (attempt === CONFIG.viewRetries - 1) throw err;
            // Backoff exponencial com jitter para evitar thundering herd
            const delay = Math.pow(2, attempt) * 500 + Math.random() * 300;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

module.exports = callView;