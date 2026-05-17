// utils/callView.js 

const axios = require('axios');
const { CONFIG } = require('../config/config');

async function callView(moduleAddr, fn, types = [], args = []) {
    // Se fn contém '::', é um caminho completo (ex: 'amm_factory::get_reserves')
    // Caso contrário, usa o router padrão (Dexlyn V2)
    const fullPath = fn.includes('::')
        ? `${moduleAddr}::${fn}`
        : `${moduleAddr}::router::${fn}`;

    for (let attempt = 0; attempt < CONFIG.viewRetries; attempt++) {
        try {
            const r = await axios.post(`${CONFIG.rpc}/rpc/v1/view`, {
                function: fullPath,
                type_arguments: types,
                arguments: args,
            }, { timeout: CONFIG.viewTimeout });
            return r.data.result ?? r.data;
        } catch (err) {
            if (attempt === CONFIG.viewRetries - 1) throw err;
            const delay = Math.pow(2, attempt) * 500 + Math.random() * 300;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

module.exports = callView;