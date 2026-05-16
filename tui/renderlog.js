const { CONFIG } = require('../config/config');
const { arbLog } = require('../detector/arbDetector');

function renderLog(opps, boxes) {
  const { logBox } = boxes;
  const now = new Date().toLocaleTimeString('pt-PT');
  for (const { cycle, result, score } of opps) {
    arbLog.unshift({
      time: now,
      path: cycle.path.map(t => CONFIG.tokens[t]?.symbol || t).join('→'),
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