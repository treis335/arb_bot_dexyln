const fmtReserve = require('../utils/fmtReserve');
const { trackPrice, sparkline } = require('../tracker/priceTracker');
const { CONFIG } = require('../config/config');

let sortedPairs = null;

function renderPrices(pairStates, boxes, walletBalances = {}) {
  const { headerBox, pricesBox } = boxes;
  const active = pairStates.filter(Boolean);
  if (!sortedPairs) {
    sortedPairs = [...active].sort((a, b) => a.tokenB.localeCompare(b.tokenB) || a.tokenA.localeCompare(a.tokenA));
  }

  // Linha de saldos da carteira
  let balanceLine = '';
  if (Object.keys(walletBalances).length > 0) {
    const parts = Object.entries(walletBalances).map(([symbol, amount]) => {
      const formatted = amount >= 1000 ? amount.toFixed(0) : amount.toFixed(4);
      return `{yellow-fg}${formatted} ${symbol}{/}`;
    });
    balanceLine = `{grey-fg}  Carteira: {/}${parts.join('  ')}\n`;
  }

  const hdr = [
    '{bright-cyan-fg}{bold}  ◈  DEXLYN ARBITRAGE BOT v2.5.1{/}',
    '{grey-fg}  EMA Trend · Opt Size · Auto Score · ' + new Date().toLocaleDateString('pt-PT') + '{/}',
    balanceLine,
    `{yellow-fg}{bold}  MERCADO — ${active.length} pares activos{/}`,
    '{grey-fg}  ' +
      'PAR'.padEnd(12) +
      'PREÇO'.padEnd(12) +
      'TREND'.padEnd(5) +
      'Δ%'.padEnd(9) +
      'SPARK'.padEnd(14) +
      'RES.A'.padEnd(8) +
      'RES.B'.padEnd(8) +
      'FEE' +
    '{/}',
    '{grey-fg}  ' + '─'.repeat(74) + '{/}',
  ];
  headerBox.setContent(hdr.join('\n'));

  const L = [];
  for (const orig of sortedPairs) {
    const ps = active.find(p =>
      p.tokenA === orig.tokenA && p.tokenB === orig.tokenB && p.curve === orig.curve
    );
    if (!ps) { L.push(''); continue; }

    const key  = `${ps.tokenA}_${ps.tokenB}_${ps.curve}`;
    const t    = trackPrice(key, ps.priceAinB);
    const symA = CONFIG.tokens[ps.tokenA].symbol;
    const symB = CONFIG.tokens[ps.tokenB].symbol;

    const pairRaw = `${symA}/${symB}`;
    const pairStr = `{bold}${symA}{/}/{grey-fg}${symB}{/}`;
    const pairPad = ' '.repeat(Math.max(0, 12 - pairRaw.length));

    const priceStr = `{${t.priceTag}-fg}${ps.priceAinB.toFixed(6)}{/}`;
    const pricePad = ' '.repeat(Math.max(0, 12 - ps.priceAinB.toFixed(6).length));

    const trendStr = t.isNew ? '{grey-fg}─    {/}' : `${t.trendStr}   `;
    const tickStr = t.isNew
      ? '{grey-fg}─        {/}'
      : `{${t.dirTag}-fg}${t.pctStr.padEnd(8)}{/}`;

    const sp = sparkline(t.ticks);

    const rA = fmtReserve(ps.reserveA / CONFIG.tokens[ps.tokenA].decimals).padEnd(8);
    const rB = fmtReserve(ps.reserveB / CONFIG.tokens[ps.tokenB].decimals).padEnd(8);
    const feePct = ((ps.fee / ps.feeScale) * 100).toFixed(2) + '%';

    L.push(
      `  ${pairStr}${pairPad}${priceStr}${pricePad}` +
      `${trendStr}${tickStr}${sp}  ` +
      `{grey-fg}${rA}${rB}${feePct}{/}`
    );
  }

  pricesBox.setContent(L.join('\n'));
}

module.exports = renderPrices;