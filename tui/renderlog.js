const { CONFIG } = require('../config/config');
const { arbLog } = require('../detector/arbDetector');

const DEX_LABELS = {
  DEXLYN: 'DLyn',
  DEXLYN_V3: 'DLV3',
  SPIKEY: 'Spky',
};

function getDexLabel(dex) {
  return DEX_LABELS[dex] || (dex ? dex.substring(0, 4) : '???');
}

function renderLog(opps, boxes) {
  const { logBox } = boxes;
  const now = new Date().toLocaleTimeString('pt-PT');
  for (const { cycle, result, score } of opps) {
    const pathParts = cycle.path.map((token, idx) => {
      const sym = CONFIG.tokens[token]?.symbol || token;
      if (idx === 0) return sym;
      const prevEdge = cycle.edges[idx - 1];
      const dexLabel = getDexLabel(prevEdge.pair.dex);
      return `[${dexLabel}] → ${sym}`;
    });
    const fullPath = pathParts.join(' ');

    arbLog.unshift({
      time: now,
      path: fullPath,
      profitPct: result.profitPct,
      profitAbs: result.profitAbs,
      score,
      symIn: CONFIG.tokens[cycle.path[0]]?.symbol || cycle.path[0],
    });
  }
  while (arbLog.length > CONFIG.arbLogMax) arbLog.pop();

  const L = [];
  if (!arbLog.length) {
    L.push('{grey-fg} Aguardando...{/}');
  } else {
    for (const e of arbLog) {
      const color = e.score >= 70 ? 'bright-green' : e.score >= 40 ? 'yellow' : 'grey';
      L.push(
        `{grey-fg}${e.time}{/} {${color}-fg}+${e.profitPct.toFixed(3)}%{/}` +
        ` {grey-fg}sc:${e.score}{/} {grey-fg}${e.path}{/}`
      );
    }
  }
  logBox.setContent(L.join('\n'));
  logBox.scrollTo(0);
}

module.exports = renderLog;