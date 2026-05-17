// dexes/dexlyn/dexlynEngine.js
// CORRIGIDO: resultado inclui _simulate para interface unificada com Spikey e V3

const callView = require('../../utils/callView');
const { logError } = require('../../utils/logError');
const { CONFIG } = require('../../config/config');

// Cache de pares com TTL de 1,5 segundos
const pairCache = new Map();
const CACHE_TTL = 1500; // ms

const priceEngine = {
  getAmountOut(reserveIn, reserveOut, amountIn, fee, feeScale) {
    if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0;
    const feeMul   = BigInt(feeScale - fee);
    const afterFee = (BigInt(Math.floor(amountIn)) * feeMul) / BigInt(feeScale);
    if (afterFee <= 0n) return 0;
    return Number(
      (afterFee * BigInt(Math.floor(reserveOut))) /
      (BigInt(Math.floor(reserveIn)) + afterFee)
    );
  },

  simulateTrade(ps, direction, amountIn) {
    // Suporta tanto o formato com _simulate como sem
    if (ps._simulate) return ps._simulate(direction, amountIn);
    const tokA = CONFIG.tokens[ps.tokenA];
    const tokB = CONFIG.tokens[ps.tokenB];
    if (!tokA || !tokB || amountIn <= 0) return 0;
    if (direction === 'AB') {
      const raw = this.getAmountOut(ps.reserveA, ps.reserveB, amountIn * tokA.decimals, ps.fee, ps.feeScale);
      return raw / tokB.decimals;
    } else {
      const raw = this.getAmountOut(ps.reserveB, ps.reserveA, amountIn * tokB.decimals, ps.fee, ps.feeScale);
      return raw / tokA.decimals;
    }
  },

  async fetchPairState(dexKey, tokenAKey, tokenBKey, curveKey) {
    const cacheKey = `${dexKey}:${tokenAKey}:${tokenBKey}:${curveKey}`;
    const now = Date.now();

    if (pairCache.has(cacheKey)) {
      const cached = pairCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL) return cached.data;
    }

    const dex   = CONFIG.dexes[dexKey];
    const tokA  = CONFIG.tokens[tokenAKey];
    const tokB  = CONFIG.tokens[tokenBKey];
    if (!dex || !tokA || !tokB) return null;

    const curve = `${dex.moduleAddress}::${dex.curveTypes[curveKey]}`;
    const types = [tokA.type, tokB.type, curve];

    try {
      const [reserves, fees] = await Promise.all([
        callView(dex.moduleAddress, 'get_reserves_size', types),
        callView(dex.moduleAddress, 'get_fees_config',   types),
      ]);

      if (!reserves || !Array.isArray(reserves)) return null;

      const reserveA  = Number(reserves[0]);
      const reserveB  = Number(reserves[1]);
      if (reserveA === 0 || reserveB === 0) return null;

      const fee       = fees?.[0] ?? 30;
      const feeScale  = fees?.[1] ?? 10000;
      const amountOut = this.getAmountOut(reserveA, reserveB, tokA.decimals, fee, feeScale);
      const priceAinB = amountOut / tokB.decimals;

      const result = {
        dex: dexKey,
        tokenA: tokenAKey,
        tokenB: tokenBKey,
        curve: curveKey,
        reserveA, reserveB, fee, feeScale, priceAinB,
        // _simulate: interface unificada com Spikey e V3
        _simulate: (direction, amountIn) => this.simulateTrade(
          { tokenA: tokenAKey, tokenB: tokenBKey, reserveA, reserveB, fee, feeScale },
          direction,
          amountIn
        ),
      };

      pairCache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (e) {
      logError(`fetchPairState ${tokenAKey}/${tokenBKey}`, e);
      return null;
    }
  },
};

module.exports = priceEngine;