// dexes/spikey/spikeyEngine.js — CORRIGIDO
// BUG ORIGINAL: getTokenAddress() devolvia só o endereço do pacote (split('::')[0])
// mas a API da Spikey precisa do TYPE COMPLETO (ex: 0x1::supra_coin::SupraCoin).
// Também: get_reserves aceita type_arguments (não args posicionais).

const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');
const callView = require('../../utils/callView');

const SPIKEY_ADDRESS = '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083';

const spikeyEngine = {
  // CORRIGIDO: devolve o type completo, não apenas o endereço do pacote
  getTokenType(tokenSymbol) {
    const tok = CONFIG.tokens[tokenSymbol];
    if (!tok) return null;
    return tok.type; // ex: "0x1::supra_coin::SupraCoin"
  },

  async fetchPairState(tokenA, tokenB) {
    try {
      const typeA = this.getTokenType(tokenA);
      const typeB = this.getTokenType(tokenB);
      if (!typeA || !typeB) {
        logError(`[Spikey] tipo não encontrado`, new Error(`Token ${tokenA} ou ${tokenB} sem type`));
        return null;
      }

      // A Spikey amm_factory::get_reserves recebe os tipos como type_arguments
      const reserves = await callView(
        SPIKEY_ADDRESS,
        'amm_factory::get_reserves',
        [typeA, typeB], // ← CORRIGIDO: type_arguments, não positional args
        []
      );

      if (!reserves || !Array.isArray(reserves) || reserves.length < 2) {
        // Par pode não existir na Spikey — não é erro, apenas não listado
        return null;
      }

      const reserveA = BigInt(reserves[0]);
      const reserveB = BigInt(reserves[1]);

      if (reserveA === 0n || reserveB === 0n) return null;

      // Taxa de swap: tenta buscar, usa 30 (0.3%) como fallback
      let swapFee = 30;
      try {
        const feeResult = await callView(
          SPIKEY_ADDRESS,
          'amm_controller::get_swap_fee',
          [],
          []
        );
        if (feeResult !== null && feeResult !== undefined && !isNaN(Number(feeResult))) {
          swapFee = Number(feeResult);
        }
      } catch (_) {
        // Usa fallback 30 (0.3%)
      }

      const feeScale = 10000;
      const tokA = CONFIG.tokens[tokenA];
      const tokB = CONFIG.tokens[tokenB];

      const amountOut = this.getAmountOut(
        reserveA, reserveB,
        BigInt(tokA.decimals),
        swapFee, feeScale
      );
      const priceAinB = Number(amountOut) / tokB.decimals;

      return {
        dex: 'SPIKEY',
        tokenA,
        tokenB,
        curve: 'constant_product',
        pairAddress: `${typeA}_${typeB}`,
        reserveA: Number(reserveA),
        reserveB: Number(reserveB),
        fee: swapFee,
        feeScale,
        priceAinB,
        // _simulate: interface unificada usada pelo arbDetector e optimalSize
        _simulate: (direction, amountIn) => this.simulateTrade(
          { tokenA, tokenB, reserveA: Number(reserveA), reserveB: Number(reserveB), fee: swapFee, feeScale },
          direction,
          amountIn
        ),
      };
    } catch (e) {
      logError(`fetchSpikeyPair ${tokenA}/${tokenB}`, e);
      return null;
    }
  },

  getAmountOut(reserveIn, reserveOut, amountIn, fee, feeScale) {
    if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) return 0n;
    const feeMul = BigInt(feeScale - fee);
    const afterFee = (amountIn * feeMul) / BigInt(feeScale);
    if (afterFee <= 0n) return 0n;
    return (afterFee * reserveOut) / (reserveIn + afterFee);
  },

  simulateTrade(ps, direction, amountIn) {
    const tokA = CONFIG.tokens[ps.tokenA] || { decimals: 1e6 };
    const tokB = CONFIG.tokens[ps.tokenB] || { decimals: 1e6 };
    if (amountIn <= 0) return 0;

    if (direction === 'AB') {
      const raw = this.getAmountOut(
        BigInt(Math.floor(ps.reserveA)),
        BigInt(Math.floor(ps.reserveB)),
        BigInt(Math.floor(amountIn * tokA.decimals)),
        ps.fee, ps.feeScale
      );
      return Number(raw) / tokB.decimals;
    } else {
      const raw = this.getAmountOut(
        BigInt(Math.floor(ps.reserveB)),
        BigInt(Math.floor(ps.reserveA)),
        BigInt(Math.floor(amountIn * tokB.decimals)),
        ps.fee, ps.feeScale
      );
      return Number(raw) / tokA.decimals;
    }
  },
};

module.exports = spikeyEngine;