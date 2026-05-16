const { SupraClient } = require('supra-l1-sdk');
const { CONFIG } = require('../config/config');

let client = null;

async function getSupraClient() {
    if (client) return client;
    client = await SupraClient.init(CONFIG.rpc);
    return client;
}

module.exports = { getSupraClient };