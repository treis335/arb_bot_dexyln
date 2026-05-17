//renderFooter.js

const { CONFIG } = require('../config/config');
const { getErrorCount, getLastError } = require('../utils/logError');

let rpcHealthy = true;

function setRpcHealthy(val) { rpcHealthy = val; }

function renderFooter(opps, tickMs, boxes) {
  const { footerBox } = boxes;
  const now     = new Date().toLocaleTimeString('pt-PT');
  const best    = opps[0];
  const bestStr = best
    ? `{bright-green-fg}▲ MELHOR: +${best.result.profitPct.toFixed(3)}% sc=${best.score} opt=${best.optimalAmount.toFixed(0)}{/}`
    : '{grey-fg}sem arb detectado{/}';
  const rpcIcon = rpcHealthy ? '{green-fg}🟢{/}' : '{red-fg}🔴{/}';
  const pauseStr = boxes.scrollPaused() ? '{yellow-fg}[PAUSADO] {/}' : '';
  const autoStatus = CONFIG.autoExecute.enabled ? '{green-fg}🤖 AUTO{/}' : '{grey-fg}⏸ MANUAL{/}';
  const errStr   = getErrorCount() > 0 ? `{red-fg} ⚠${getErrorCount()}{/}` : '';

  footerBox.setContent(
    `{grey-fg}─{/} ${autoStatus} ${pauseStr}${bestStr}` +
    `  {grey-fg}${rpcIcon} RPC ${rpcHealthy ? 'ok' : 'falha'} · opps:${opps.length} tick:${tickMs}ms α=${CONFIG.emaAlpha} ${now}` +
    `  TAB foco · SPACE pausa · a auto · q sai${errStr}{/}`
  );
}

module.exports = { renderFooter, setRpcHealthy };