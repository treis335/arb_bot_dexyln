const { getSupraClient } = require('./supraClient');
const { logError } = require('./logError');

let cachedBalance = null;
let lastFetch = 0;
const CACHE_TTL = 8000;

async function fetchWalletBalance(address) {
    if (!address) return {};
    const now = Date.now();
    if (cachedBalance && now - lastFetch < CACHE_TTL) return cachedBalance;
    try {
        const client = await getSupraClient();
        const supraRaw = await client.getAccountSupraCoinBalance(address);
        const balances = {
            SUPRA: Number(supraRaw) / 1e8,
        };
        try {
            // Tenta obter saldo de dexUSDC usando invokeViewMethod
            const dexusdcResult = await client.invokeViewMethod(
                '0x1::coin::balance',
                ['0x8f7d16ade319b0fce368ca6cdb98589c4527ce7f5b51e544a9e68e719934458b::hyper_coin::DexlynUSDC'],
                [address]
            );
            if (dexusdcResult?.result) {
                balances.dexUSDC = Number(dexusdcResult.result) / 1e6;
            }
        } catch (_) {}
        cachedBalance = balances;
        lastFetch = now;
        return balances;
    } catch (e) {
        logError('fetchWalletBalance', e);
        return cachedBalance || {};
    }
}

module.exports = { fetchWalletBalance };