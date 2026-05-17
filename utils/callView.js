// utils/callView.js — com retry inteligente + backoff adaptativo para 429

const axios = require('axios');
const { CONFIG } = require('../config/config');

// Backoff global partilhado: se RPC throttle, todos os pedidos abrandam
let globalBackoffMs = 0;
let lastThrottleTime = 0;

const axiosInstance = axios.create({
  baseURL: CONFIG.rpc,
  timeout: CONFIG.viewTimeout,
});

async function callView(moduleAddr, fn, types = [], args = []) {
  const fullPath = fn.includes('::')
    ? `${moduleAddr}::${fn}`
    : `${moduleAddr}::router::${fn}`;

  for (let attempt = 0; attempt < CONFIG.viewRetries; attempt++) {
    // Respeita o backoff global se o RPC estiver a throttle
    if (globalBackoffMs > 0) {
      const elapsed = Date.now() - lastThrottleTime;
      const remaining = globalBackoffMs - elapsed;
      if (remaining > 0) await new Promise(res => setTimeout(res, remaining));
    }

    try {
      const r = await axiosInstance.post('/rpc/v1/view', {
        function: fullPath,
        type_arguments: types,
        arguments: args,
      });

      // Sucesso — reset backoff
      if (globalBackoffMs > 0) globalBackoffMs = Math.max(0, globalBackoffMs - 200);
      return r.data.result ?? r.data;

    } catch (err) {
      const status = err?.response?.status;

      if (status === 429) {
        // Rate limit: aumenta backoff global e espera
        globalBackoffMs = Math.min(5000, (globalBackoffMs || 500) * 2);
        lastThrottleTime = Date.now();
        const waitMs = globalBackoffMs + Math.random() * 300;
        await new Promise(res => setTimeout(res, waitMs));
        // Não conta como tentativa falhada — retenta imediatamente
        attempt--;
        if (attempt < -5) throw err; // evita loop infinito
        continue;
      }

      if (attempt === CONFIG.viewRetries - 1) throw err;
      const delay = Math.pow(2, attempt) * 400 + Math.random() * 200;
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

module.exports = callView;