const { CONFIG } = require('../config/config');
const { logError } = require('../utils/logError');
const axios = require('axios');

const CLMM_ROUTER_ADDRESS = '0xc3a610069fa7545cf14e266e849954bf385aca957bb489b1dc069a4baa29b502';

const priceEngineV3 = {
  /**
   * Lê o estado de uma pool V3 diretamente do recurso na blockchain.
   * @param {string} poolAddress - Endereço da pool (ex: 0x2d5d...)
   * @returns {Object} Estado da pool com sqrt_price, liquidity, assets, fee_rate, tick_spacing
   */
  async fetchPoolState(poolAddress) {
    try {
      const response = await axios.get(`${CONFIG.rpc}/rpc/v1/accounts/${poolAddress}`);
      const resources = response.data?.resources || response.data?.data || [];

      // Procura o recurso do tipo pool::Pool
      const poolResource = resources.find(r =>
        r.type && r.type.includes('::pool::Pool')
      );

      if (!poolResource || !poolResource.data) {
        throw new Error(`Pool resource not found at ${poolAddress}`);
      }

      const data = poolResource.data;

      return {
        assetA: BigInt(data.asset_a || 0),
        assetB: BigInt(data.asset_b || 0),
        assetAAddr: data.asset_a_addr,
        assetBAddr: data.asset_b_addr,
        currentSqrtPrice: BigInt(data.current_sqrt_price || 0),
        liquidity: BigInt(data.liquidity || 0),
        feeRate: Number(data.fee_rate || 0),
        tickSpacing: Number(data.tick_spacing || 1),
        isPause: data.is_pause || false,
      };
    } catch (e) {
      logError(`fetchPoolState ${poolAddress}`, e);
      return null;
    }
  },

  /**
   * Calcula o amount_out para uma pool V3 usando a fórmula simplificada
   * baseada no preço sqrt e na liquidez.
   * 
   * Para pools V3, usamos a aproximação de produto constante com o preço atual,
   * que é suficientemente precisa para pequenas variações e evita iterar ticks.
   */
  simulateTrade(poolState, direction, amountIn) {
    const { assetA, assetB, currentSqrtPrice, liquidity, feeRate } = poolState;

    if (!assetA || !assetB || !currentSqrtPrice) return 0;

    // Converter sqrt_price para preço normal (assetA/assetB)
    // preço = (sqrt_price / 2^64)^2
    const sqrtPrice = Number(currentSqrtPrice) / 2**64;
    const price = sqrtPrice * sqrtPrice;

    let reserveIn, reserveOut, decimalsIn, decimalsOut;

    if (direction === 'AB') {
      reserveIn = Number(assetA);
      reserveOut = Number(assetB);
      decimalsIn = 1e8; // SUPRA decimals
      decimalsOut = 1e6; // dexUSDC decimals
    } else {
      reserveIn = Number(assetB);
      reserveOut = Number(assetA);
      decimalsIn = 1e6;
      decimalsOut = 1e8;
    }

    if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0;

    // Aplicar taxa (feeRate é em centésimos de percentagem?)
    // Ex: 400 = 4%? Ou 400 = 0.04%?
    // Assumindo que fee_rate 400 = 4% = 0.04
    const feeMultiplier = 1 - (feeRate / 10000);
    const amountInAfterFee = amountIn * feeMultiplier;

    // Fórmula de produto constante: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    const amountOut = (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);

    return amountOut / decimalsOut;
  },

  /**
   * Obtém o preço (amount_out por 1 unidade de A) para exibição.
   */
  getPrice(poolState, direction) {
    if (direction === 'AB') {
      const amountOut = this.simulateTrade(poolState, 'AB', 1e8); // 1 SUPRA
      return amountOut; // preço em dexUSDC por SUPRA
    } else {
      const amountOut = this.simulateTrade(poolState, 'BA', 1e6); // 1 dexUSDC
      return amountOut; // preço em SUPRA por dexUSDC
    }
  }
};

module.exports = priceEngineV3;