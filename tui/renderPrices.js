const fmtReserve = require('../utils/fmtReserve');
const { trackPrice, sparkline } = require('../tracker/priceTracker');
const { CONFIG } = require('../config/config');

let sortedPairs = null;

// Mapeamento do nome interno da DEX para o que aparece no ecrã
const DEX_LABELS = {
  DEXLYN:    'DLyn',
  DEXLYN_V3: 'DLV3',
  SPIKEY:    'Spky',
};

function getDexLabel(dex) {
  return DEX_LABELS[dex] || dex?.substring(0, 4) || '???';
}

function renderPrices(pairStates, boxes, walletBalances = {}) {
  const { headerBox, pricesBox } = boxes;
  const active = pairStates.filter(Boolean);

  // Ordena sempre pelos mais recentes (sem cache estática)
  const sorted = [...active].sort((a, b) => {
    const keyA = a.tokenB + a.tokenA + (a.dex || '');
    const keyB = b.tokenB + b.tokenA + (b.dex || '');
    return keyA.localeCompare(keyB);
  });

  // Linha de saldos da carteira
  let balanceLine = '';
  if (Object.keys(walletBalances).length > 0) {
    const parts = Object.entries(walletBalances).map(([symbol, amount]) => {
      const formatted = amount >= 1000 ? amount.toFixed(0) : amount.toFixed(4);
      return `{yellow-fg}${formatted} ${symbol}{/}`;
    });
    balanceLine = `{grey-fg}  Carteira: {/}${parts.join('  ')}\n`;
  }

  const DEX_COL = 6;

  const hdr = [
    '{bright-cyan-fg}{bold}  ◈  DEXLYN ARBITRAGE BOT v2.5.1{/}',
    '{grey-fg}  EMA Trend · Opt Size · Auto Score · ' + new Date().toLocaleDateString('pt-PT') + '{/}',
    balanceLine,
    `{yellow-fg}{bold}  MERCADO — ${sorted.length} pares activos{/}`,
    '{grey-fg}  ' +
      'DEX'.padEnd(DEX_COL) +
      'PAR'.padEnd(12) +
      'PREÇO'.padEnd(12) +
      'TREND'.padEnd(5) +
      'Δ%'.padEnd(9) +
      'SPARK'.padEnd(14) +
      'RES.A'.padEnd(8) +
      'RES.B'.padEnd(8) +
      'FEE' +
    '{/}',
    '{grey-fg}  ' + '─'.repeat(DEX_COL + 12 + 12 + 5 + 9 + 14 + 8 + 8 + 6 + 2) + '{/}',
  ];
  headerBox.setContent(hdr.join('\n'));

  const L = [];
  for (const ps of sorted) {
    if (!ps || !ps.tokenA || !ps.tokenB) continue;

    const key  = `${ps.dex || 'UNK'}_${ps.tokenA}_${ps.tokenB}_${ps.curve || 'unknown'}`;
    const t    = trackPrice(key, ps.priceAinB);
    const symA = ps.tokenA;
    const symB = ps.tokenB;

    // DEX
    const dexLabel = getDexLabel(ps.dex);
    const dexCol = `{magenta-fg}${dexLabel.padEnd(DEX_COL)}{/}`;

    // PAR
    const pairRaw = `${symA}/${symB}`;
    const pairStr = `{bold}${symA}{/}/{grey-fg}${symB}{/}`;
    const pairPad = ' '.repeat(Math.max(0, 12 - pairRaw.length));

    // PREÇO
    const priceRaw = (ps.priceAinB || 0).toFixed(6);
    const priceStr = `{${t.priceTag}-fg}${priceRaw}{/}`;
    const pricePad = ' '.repeat(Math.max(0, 12 - priceRaw.length));

    // TREND
    const trendStr = t.isNew ? '{grey-fg}─    {/}' : `${t.trendStr}   `;

    // Δ%
    const tickStr = t.isNew
      ? '{grey-fg}─        {/}'
      : `{${t.dirTag}-fg}${t.pctStr.padEnd(8)}{/}`;

    // SPARKLINE
    const sp = sparkline(t.ticks);

    // RESERVAS (com fallback para 0)
    const decA = CONFIG.tokens[ps.tokenA]?.decimals || 1e6;
    const decB = CONFIG.tokens[ps.tokenB]?.decimals || 1e6;
    const rA = fmtReserve((ps.reserveA || 0) / decA).padEnd(8);
    const rB = fmtReserve((ps.reserveB || 0) / decB).padEnd(8);

    // FEE
    let feePct = '0.30%';
    if (ps.fee !== undefined && ps.feeScale) {
      feePct = ((ps.fee / ps.feeScale) * 100).toFixed(2) + '%';
    } else if (ps.fee !== undefined) {
      feePct = (ps.fee / 100).toFixed(2) + '%'; // Spikey usa fee em bps
    }
    const feeCol = feePct.padEnd(6);

    L.push(
      `  ${dexCol}` +
      `${pairStr}${pairPad}${priceStr}${pricePad}` +
      `${trendStr}${tickStr}${sp}  ` +
      `{grey-fg}${rA}${rB}${feeCol}{/}`
    );
  }

  pricesBox.setContent(L.join('\n'));
}

module.exports = renderPrices;