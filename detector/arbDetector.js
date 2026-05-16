const priceEngine = require('../engine/priceEngine');
const { findOptimalAmount } = require('../engine/optimalSize');
const { CONFIG } = require('../config/config');
const { priceHistory } = require('../tracker/priceTracker');

const arbLog = [];

const arbDetector = {
  simulateCycle(cycle, amountIn) {
    let amount = amountIn;
    const steps = [];
    for (const edge of cycle.edges) {
      const out = priceEngine.simulateTrade(edge.pair, edge.direction, amount);
      steps.push({
        from:   edge.direction === 'AB' ? edge.pair.tokenA : edge.pair.tokenB,
        to:     edge.direction === 'AB' ? edge.pair.tokenB : edge.pair.tokenA,
        amtIn: amount, amtOut: out, dex: edge.pair.dex, pair: edge.pair,
      });
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
      const resB = ps.tokenB === s.to ? ps.reserveB : ps.reserveA;
      return resB / tok.decimals;
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