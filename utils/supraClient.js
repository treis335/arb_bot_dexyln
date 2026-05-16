const { SupraClient, SupraAccount, BCS } = require('supra-l1-sdk');

let client = null;

async function getSupraClient() {
    if (client) return client;
    client = await SupraClient.init('https://rpc-mainnet.supra.com');
    return client;
}

module.exports = { getSupraClient, SupraAccount, BCS };