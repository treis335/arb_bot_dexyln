const callView = require('../utils/callView');
const { logError } = require('../utils/logError');
const { CONFIG } = require('../config/config');

const priceEngine = {
  getAmountOut(reserveIn, reserveOut, amountIn, fee, feeScale) {
    if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0;
    const feeMul   = BigInt(feeScale - fee);
    const afterFee = (BigInt(Math.floor(amountIn)) * feeMul) / BigInt(feeScale);
    if (afterFee <= 0n) return 0;
    return Number((afterFee * BigInt(Math.floor(reserveOut))) / (BigInt(Math.floor(reserveIn)) + afterFee));
  },

  async fetchPairState(dexKey, tokenAKey, tokenBKey, curveKey) {
    const dex   = CONFIG.dexes[dexKey];
    const tokA  = CONFIG.tokens[tokenAKey];
    const tokB  = CONFIG.tokens[tokenBKey];
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
      const fee       = fees?.[0] ?? 30;
      const feeScale  = fees?.[1] ?? 10000;
      const amountOut = this.getAmountOut(reserveA, reserveB, tokA.decimals, fee, feeScale);
      const priceAinB = amountOut / tokB.decimals;

      return { dex: dexKey, tokenA: tokenAKey, tokenB: tokenBKey, curve: curveKey,
               reserveA, reserveB, fee, feeScale, priceAinB };
    } catch (e) {
      logError(`fetchPairState ${tokenAKey}/${tokenBKey}`, e);
      return null;
    }
  },

  simulateTrade(ps, direction, amountIn) {
    const tokA = CONFIG.tokens[ps.tokenA];
    const tokB = CONFIG.tokens[ps.tokenB];
    if (direction === 'AB') {
      const raw = this.getAmountOut(ps.reserveA, ps.reserveB, amountIn * tokA.decimals, ps.fee, ps.feeScale);
      return raw / tokB.decimals;
    } else {
      const raw = this.getAmountOut(ps.reserveB, ps.reserveA, amountIn * tokB.decimals, ps.fee, ps.feeScale);
      return raw / tokA.decimals;
    }
  },
};

module.exports = priceEngine;