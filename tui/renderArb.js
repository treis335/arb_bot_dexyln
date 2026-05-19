const { CONFIG } = require('../config/config');

const DEX_LABELS = {
  DEXLYN: 'DLyn',
  DEXLYN_V3: 'DLV3',
  SPIKEY: 'Spky',
};

function getDexLabel(dex) {
  return DEX_LABELS[dex] || (dex ? dex.substring(0, 4) : '???');
}

function scoreBar(score) {
  const filled = Math.round(score / 10);
  const color = score >= 70 ? 'bright-green' : score >= 40 ? 'yellow' : 'red';
  return `{${color}-fg}${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${score}{/}`;
}

function renderArb(opps, boxes) {
  const { arbBox } = boxes;
  const L = [];
  if (!opps.length) {
    L.push('{grey-fg}  Sem oportunidades acima de ' + CONFIG.minProfitPct + '%{/}');
  } else {
    let totalSupraProfit = 0;
    for (const { cycle, result, optimalAmount, score, profitScore, liquidityScore, trendScore } of opps) {
      const { profitPct, profitAbs, steps } = result;
      const symIn = CONFIG.tokens[cycle.path[0]]?.symbol || cycle.path[0];
      if (symIn === 'SUPRA') totalSupraProfit += profitAbs;

      const isHot = score >= 70, isWarm = score >= 40;
      const badge = isHot ? '{green-bg}{black-fg} 🔥 EXEC {/}' : isWarm ? '{yellow-fg} ◈ AVAL  {/}' : '{grey-fg} ○ FRACO {/}';
      const pc = isHot ? 'bright-green' : isWarm ? 'yellow' : 'grey';

      L.push(
        ` ${badge} {${pc}-fg}+${profitPct.toFixed(3)}%  +${profitAbs.toFixed(3)} ${symIn}{/}` +
        `  {grey-fg}opt:${optimalAmount.toFixed(0)} ${symIn}{/}`
      );

      L.push(
        `  ${scoreBar(score)} {grey-fg}P:${(profitScore * 100).toFixed(0)}% L:${(liquidityScore * 100).toFixed(0)}% T:${(trendScore * 100).toFixed(0)}%{/}`
      );

      // Rota com DEX labels
      const pathParts = cycle.path.map((token, idx) => {
        const sym = CONFIG.tokens[token]?.symbol || token;
        if (idx === 0) return sym;
        const prevEdge = cycle.edges[idx - 1];
        const dexLabel = getDexLabel(prevEdge.pair.dex);
        return `{grey-fg}[${dexLabel}]{/} → ${sym}`;
      });
      L.push(`  {grey-fg}Rota: {/}${pathParts.join(' ')}`);

      // Passos individuais
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const fA = CONFIG.tokens[s.from]?.symbol || s.from;
        const fB = CONFIG.tokens[s.to]?.symbol || s.to;
        const dexLabel = getDexLabel(s.dex);
        const co = i === steps.length - 1 ? '└' : '├';
        L.push(
          `  {grey-fg}${co} ${fA} → ${fB} {/}[{magenta-fg}${dexLabel}{/}]` +
          `  {grey-fg}in:{/}{${pc}-fg}${s.amtIn.toFixed(6)}{/}` +
          `  {grey-fg}out:{/}{${pc}-fg}${s.amtOut.toFixed(6)}{/}`
        );
      }
      L.push('{grey-fg}  ' + '─'.repeat(38) + '{/}');
    }
    if (totalSupraProfit > 0) L.unshift(`{yellow-fg}{bold}  💰 Total estimado: ${totalSupraProfit.toFixed(3)} SUPRA{/}`, '');
  }
  arbBox.setContent(L.join('\n'));
  if (!boxes.scrollPaused()) arbBox.scrollTo(0);
}

module.exports = renderArb;