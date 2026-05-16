const priceEngine = require('./priceEngine');

function simulateCycleAmount(cycle, amountIn) {
  let amount = amountIn;
  for (const edge of cycle.edges) {
    amount = priceEngine.simulateTrade(edge.pair, edge.direction, amount);
    if (!amount || amount <= 0) return 0;
  }
  return amount;
}

function findOptimalAmount(cycle, config) {
  const { min, max, iterations } = config.optimalSearch;
  let lo = min, hi = max;
  for (let i = 0; i < iterations; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const p1 = simulateCycleAmount(cycle, m1) - m1;
    const p2 = simulateCycleAmount(cycle, m2) - m2;
    if (p1 < p2) lo = m1; else hi = m2;
  }
  const optimalAmount = (lo + hi) / 2;
  const optimalProfit = simulateCycleAmount(cycle, optimalAmount) - optimalAmount;
  return { optimalAmount, optimalProfit };
}

module.exports = { findOptimalAmount };