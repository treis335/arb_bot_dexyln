const { getSupraClient } = require('./supraClient');
const { logError } = require('./logError');

// Cache para evitar demasiadas chamadas RPC
let cachedBalance = null;
let lastFetch = 0;
const CACHE_TTL = 8000; // 8 segundos

/**
 * Obtém o saldo de SUPRA da carteira (e tenta outras moedas se possível).
 * @param {string} address - Endereço da carteira (SENDER_ADDRESS)
 * @returns {Promise<Object>} Ex: { SUPRA: 1500.25, dexUSDC: 340.0 }
 */
async function fetchWalletBalance(address) {
    if (!address) return {};

    const now = Date.now();
    if (cachedBalance && now - lastFetch < CACHE_TTL) {
        return cachedBalance;
    }

    try {
        const client = await getSupraClient();

        // Saldo de SUPRA
        const supraRaw = await client.getAccountSupraCoinBalance(address);
        const balances = {
            SUPRA: Number(supraRaw) / 1e8, // converter de quants para unidades
        };

        // Tentar saldo de outras moedas (opcional)
        // Como exemplo, tentamos também dexUSDC
        try {
            const dexusdcRaw = await client.getAccountCoinBalance(
                address,
                '0x8f7d16ade319b0fce368ca6cdb98589c4527ce7f5b51e544a9e68e719934458b::hyper_coin::DexlynUSDC'
            );
            balances.dexUSDC = Number(dexusdcRaw) / 1e6;
        } catch (_) {
            // dexUSDC pode não existir na carteira
        }

        cachedBalance = balances;
        lastFetch = now;
        return balances;
    } catch (e) {
        logError('fetchWalletBalance', e);
        return cachedBalance || {};
    }
}

module.exports = { fetchWalletBalance };