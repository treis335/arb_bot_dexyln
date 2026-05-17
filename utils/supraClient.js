const { SupraClient, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');

let client = null;
async function getSupraClient() {
    if (client) return client;
    client = await SupraClient.init('https://rpc-mainnet.supra.com');
    return client;
}

module.exports = { getSupraClient, SupraAccount, BCS, TxnBuilderTypes };