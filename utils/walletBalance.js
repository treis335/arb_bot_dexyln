// utils/walletBalance.js — CORRIGIDO
// BUG ORIGINAL: dependia exclusivamente do SupraClient SDK para saldo.
// Se o SDK não inicializa (ex: falta de env), saldo fica sempre {}.
// CORREÇÃO: fallback via REST API direto quando SDK não está disponível.

const { logError } = require('./logError');
const axios = require('axios');
const { CONFIG } = require('../config/config');

let cachedBalance = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 segundos

// Tenta usar o SDK primeiro, depois faz fallback para REST
async function fetchWalletBalance(address) {
  if (!address) return {};

  const now = Date.now();
  if (cachedBalance && now - lastFetch < CACHE_TTL) return cachedBalance;

  // Método 1: via SDK (se disponível)
  try {
    const { getSupraClient } = require('./supraClient');
    const client = await getSupraClient();
    const supraRaw = await client.getAccountSupraCoinBalance(address);
    cachedBalance = { SUPRA: Number(supraRaw) / 1e8 };
    lastFetch = now;
    return cachedBalance;
  } catch (_sdkErr) {
    // SDK falhou — tenta REST direto
  }

  // Método 2: via REST (fallback robusto sem SDK)
  try {
    const resp = await axios.get(
      `${CONFIG.rpc}/rpc/v1/accounts/${address}/resources`,
      { timeout: 8000 }
    );
    const resources = resp.data?.resources || resp.data || [];

    // Procura o recurso de saldo de SUPRA (CoinStore)
    const supraCoinStore = resources.find(r =>
      r.type && r.type.includes('0x1::coin::CoinStore<0x1::supra_coin::SupraCoin>')
    );

    if (supraCoinStore?.data?.coin?.value) {
      const supraRaw = BigInt(supraCoinStore.data.coin.value);
      cachedBalance = { SUPRA: Number(supraRaw) / 1e8 };
      lastFetch = now;
      return cachedBalance;
    }

    // Tenta também via fungible asset store
    const faStore = resources.find(r =>
      r.type && r.type.includes('fungible_asset') && r.type.includes('SupraCoin')
    );
    if (faStore?.data?.balance) {
      cachedBalance = { SUPRA: Number(faStore.data.balance) / 1e8 };
      lastFetch = now;
      return cachedBalance;
    }

    return cachedBalance || {};
  } catch (e) {
    logError('fetchWalletBalance REST', e);
    return cachedBalance || {};
  }
}

module.exports = { fetchWalletBalance };