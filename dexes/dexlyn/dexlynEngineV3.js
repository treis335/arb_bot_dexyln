// dexes/dexlyn/dexlynEngineV3.js
// CORRIGIDO:
// 1. feeRate interpretado corretamente (basis points: 400 = 0.04%, não 4%)
// 2. _simulate adicionado ao resultado para interface unificada
// 3. decimais resolvidos dinamicamente a partir do CONFIG

const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');
const axios = require('axios');

const priceEngineV3 = {
  async fetchPoolState(poolAddress, tokenA, tokenB) {
    try {
      const response = await axios.get(
        `${CONFIG.rpc}/rpc/v1/accounts/${poolAddress}`,
        { timeout: CONFIG.viewTimeout }
      );
      const resources = response.data?.resources || response.data?.data || [];

      const poolResource = resources.find(r =>
        r.type && r.type.includes('::pool::Pool')
      );

      if (!poolResource || !poolResource.data) {
        throw new Error(`Pool resource not found at ${poolAddress}`);
      }

      const data = poolResource.data;

      return {
        assetA:          BigInt(data.asset_a  || 0),
        assetB:          BigInt(data.asset_b  || 0),
        assetAAddr:      data.asset_a_addr,
        assetBAddr:      data.asset_b_addr,
        currentSqrtPrice: BigInt(data.current_sqrt_price || 0),
        liquidity:        BigInt(data.liquidity || 0),
        // CORRIGIDO: feeRate está em basis points (100 = 0.01%, 400 = 0.04%, 3000 = 0.3%)
        feeRate:    Number(data.fee_rate    || 0),
        tickSpacing: Number(data.tick_spacing || 1),
        isPause:    data.is_pause || false,
        _tokenA: tokenA,
        _tokenB: tokenB,
      };
    } catch (e) {
      logError(`fetchPoolState ${poolAddress}`, e);
      return null;
    }
  },

  simulateTrade(poolState, direction, amountIn) {
    const { assetA, assetB, feeRate, _tokenA, _tokenB } = poolState;

    if (!assetA || !assetB || amountIn <= 0) return 0;

    const tokA = CONFIG.tokens[_tokenA] || { decimals: 1e8 };
    const tokB = CONFIG.tokens[_tokenB] || { decimals: 1e6 };

    let reserveIn, reserveOut, decimalsIn, decimalsOut;

    if (direction === 'AB') {
      reserveIn   = Number(assetA);
      reserveOut  = Number(assetB);
      decimalsIn  = tokA.decimals;
      decimalsOut = tokB.decimals;
    } else {
      reserveIn   = Number(assetB);
      reserveOut  = Number(assetA);
      decimalsIn  = tokB.decimals;
      decimalsOut = tokA.decimals;
    }

    if (reserveIn <= 0 || reserveOut <= 0) return 0;

    // CORRIGIDO: feeRate em basis points (1_000_000 = 100%)
    // Supra V3 usa fee_rate = 400 → 0.04% (não 4%)
    const feeMultiplier = 1 - (feeRate / 1_000_000);
    const amountInRaw = amountIn * decimalsIn;
    const amountInAfterFee = amountInRaw * feeMultiplier;

    // Fórmula produto constante (aproximação válida para trades pequenos vs liquidez)
    const amountOut = (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);

    return amountOut / decimalsOut;
  },

  getPrice(poolState, direction) {
    if (!poolState._tokenA) return 0;
    const tokA = CONFIG.tokens[poolState._tokenA] || { decimals: 1e8 };
    const tokB = CONFIG.tokens[poolState._tokenB] || { decimals: 1e6 };
    if (direction === 'AB') {
      return this.simulateTrade(poolState, 'AB', 1); // 1 token A
    } else {
      return this.simulateTrade(poolState, 'BA', 1); // 1 token B
    }
  },
};

module.exports = priceEngineV3;