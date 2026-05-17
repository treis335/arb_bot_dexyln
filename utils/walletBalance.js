// utils/walletBalance.js 
const { getSupraClient } = require('./supraClient');
const { logError } = require('./logError');

let cachedBalance = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 segundos

async function fetchWalletBalance(address) {
    if (!address) return {};
    const now = Date.now();
    if (cachedBalance && now - lastFetch < CACHE_TTL) return cachedBalance;
    try {
        const client = await getSupraClient();
        const supraRaw = await client.getAccountSupraCoinBalance(address);
        cachedBalance = { SUPRA: Number(supraRaw) / 1e8 };
        lastFetch = now;
        return cachedBalance;
    } catch (e) {
        logError('fetchWalletBalance', e);
        return cachedBalance || {};
    }
}

module.exports = { fetchWalletBalance };