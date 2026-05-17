// engine/optimalSize.js
// CORRIGIDO: usa pair._simulate() em vez de priceEngine hardcoded
// BUG ORIGINAL: simulateCycleAmount usava sempre dexlynEngine.simulateTrade

function simulateCycleAmount(cycle, amountIn) {
  let amount = amountIn;
  for (const edge of cycle.edges) {
    const ps = edge.pair;
    let out = 0;

    if (typeof ps._simulate === 'function') {
      out = ps._simulate(edge.direction, amount);
    } else {
      // Fallback produto constante genérico
      const { reserveA, reserveB, fee, feeScale } = ps;
      const rIn  = edge.direction === 'AB' ? reserveA : reserveB;
      const rOut = edge.direction === 'AB' ? reserveB : reserveA;

      const require = (p) => global.require ? global.require(p) : null;
      const tokAKey = edge.direction === 'AB' ? ps.tokenA : ps.tokenB;
      const tokBKey = edge.direction === 'AB' ? ps.tokenB : ps.tokenA;

      // Fallback sem CONFIG — estimativa aproximada
      if (rIn <= 0 || rOut <= 0 || amount <= 0) { out = 0; break; }
      const feeMul = (feeScale - fee) / feeScale;
      out = (amount * feeMul * rOut) / (rIn + amount * feeMul);
    }

    if (!out || out <= 0) return 0;
    amount = out;
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