// detector/arbDetector.js
// CORRIGIDO: usa pair._simulate() para simular trades — suporta Dexlyn V2, V3 e Spikey
// BUG ORIGINAL: usava sempre priceEngine.simulateTrade (Dexlyn V2) para todos os ciclos

const { findOptimalAmount } = require('../engine/optimalSize');
const { CONFIG } = require('../config/config');
const { priceHistory } = require('../tracker/priceTracker');

const arbLog = [];

const arbDetector = {
  // Simula um ciclo completo usando a interface _simulate de cada par
  simulateCycle(cycle, amountIn) {
    let amount = amountIn;
    const steps = [];

    for (const edge of cycle.edges) {
      const ps = edge.pair;
      let out = 0;

      // CORRIGIDO: usa _simulate se disponível (Dexlyn V2+V3+Spikey)
      if (typeof ps._simulate === 'function') {
        out = ps._simulate(edge.direction, amount);
      } else {
        // Fallback para Dexlyn V2 puro (compatibilidade)
        const tokA = CONFIG.tokens[ps.tokenA];
        const tokB = CONFIG.tokens[ps.tokenB];
        if (!tokA || !tokB || amount <= 0) { out = 0; break; }

        const getAmountOut = (rIn, rOut, aIn, fee, fs) => {
          if (rIn <= 0 || rOut <= 0 || aIn <= 0) return 0;
          const feeMul = BigInt(fs - fee);
          const afterFee = (BigInt(Math.floor(aIn)) * feeMul) / BigInt(fs);
          if (afterFee <= 0n) return 0;
          return Number((afterFee * BigInt(Math.floor(rOut))) / (BigInt(Math.floor(rIn)) + afterFee));
        };

        if (edge.direction === 'AB') {
          out = getAmountOut(ps.reserveA, ps.reserveB, amount * tokA.decimals, ps.fee, ps.feeScale) / tokB.decimals;
        } else {
          out = getAmountOut(ps.reserveB, ps.reserveA, amount * tokB.decimals, ps.fee, ps.feeScale) / tokA.decimals;
        }
      }

      const from = edge.direction === 'AB' ? ps.tokenA : ps.tokenB;
      const to   = edge.direction === 'AB' ? ps.tokenB : ps.tokenA;

      steps.push({ from, to, amtIn: amount, amtOut: out, dex: ps.dex, pair: ps });

      if (!out || out <= 0) {
        // Ciclo inválido — interrompe e devolve perda total
        return {
          steps, startAmount: amountIn, endAmount: 0,
          profitAbs: -amountIn, profitPct: -100,
        };
      }
      amount = out;
    }

    const profitAbs = amount - amountIn;
    const profitPct = (profitAbs / amountIn) * 100;
    return { steps, startAmount: amountIn, endAmount: amount, profitAbs, profitPct };
  },

  scoreOpportunity(cycle, result) {
    const { profit: wP, liquidity: wL, trend: wT } = CONFIG.scoreWeights;

    const profitScore = Math.min(1, result.profitPct / 2);

    const minLiquidity = Math.min(...result.steps.map(s => {
      const tok  = CONFIG.tokens[s.to];
      const ps   = s.pair;
      if (!tok) return 1;
      const resB = ps.tokenB === s.to ? ps.reserveB : ps.reserveA;
      return (resB || 0) / tok.decimals;
    }));
    const liquidityScore = Math.min(1, Math.log10(Math.max(1, minLiquidity)) / 6);

    let trendAlign = 0, trendCount = 0;
    for (const step of result.steps) {
      const key = `${step.pair.tokenA}_${step.pair.tokenB}_${step.pair.curve}`;
      const h   = priceHistory[key];
      if (!h) continue;
      const isAB  = step.from === step.pair.tokenA;
      const emaOk = isAB ? h.ema > 0 : h.ema < 0;
      trendAlign += emaOk ? 1 : -0.5;
      trendCount++;
    }
    const trendScore = trendCount
      ? Math.max(0, Math.min(1, (trendAlign / trendCount + 0.5) / 1.5))
      : 0.5;

    const score = Math.round((wP * profitScore + wL * liquidityScore + wT * trendScore) * 100);
    return { score, profitScore, liquidityScore, trendScore };
  },

  analyzeAll(cycles) {
    const results = [];
    for (const cycle of cycles) {
      const { optimalAmount, optimalProfit } = findOptimalAmount(cycle, CONFIG);
      if (optimalProfit <= 0) continue;
      const result = this.simulateCycle(cycle, optimalAmount);
      if (result.profitPct < CONFIG.minProfitPct) continue;
      const scoring = this.scoreOpportunity(cycle, result);
      results.push({ cycle, result, optimalAmount, ...scoring });
    }
    return results.sort((a, b) => b.score - a.score);
  },
};

module.exports = { arbDetector, arbLog };