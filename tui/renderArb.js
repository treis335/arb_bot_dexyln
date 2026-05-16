const { CONFIG } = require('../config/config');

function scoreBar(score) {
  const filled = Math.round(score / 10);
  const color  = score >= 70 ? 'bright-green' : score >= 40 ? 'yellow' : 'red';
  return `{${color}-fg}${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${score}{/}`;
}

function renderArb(opps, boxes) {
  const { arbBox } = boxes;
  const L = [];
  if (!opps.length) {
    L.push('');
    L.push('{grey-fg}  Sem oportunidades acima de ' + CONFIG.minProfitPct + '%{/}');
  } else {
    // 🆕 Soma dos profitAbs em SUPRA (ou token inicial)
    let totalSupraProfit = 0;
    let countSupraArbs = 0;

    for (const { cycle, result, optimalAmount, score, profitScore, liquidityScore, trendScore } of opps) {
      const { profitPct, profitAbs, steps } = result;
      const symIn  = CONFIG.tokens[cycle.path[0]].symbol;
      const isHot  = score >= 70;
      const isWarm = score >= 40;

      // 🆕 Acumula total se o token inicial for SUPRA
      if (symIn === 'SUPRA') {
        totalSupraProfit += profitAbs;
        countSupraArbs++;
      }

      const badge = isHot  ? '{green-bg}{black-fg} 🔥 EXEC {/}' :
                    isWarm ? '{yellow-fg} ◈ AVAL  {/}'            :
                             '{grey-fg} ○ FRACO {/}';
      const pc = isHot ? 'bright-green' : isWarm ? 'yellow' : 'grey';
      L.push(
        ` ${badge} {${pc}-fg}+${profitPct.toFixed(3)}%  +${profitAbs.toFixed(3)} ${symIn}{/}` +
        `  {grey-fg}opt:${optimalAmount.toFixed(0)} ${symIn}{/}`
      );

      L.push(
        `  ${scoreBar(score)} {grey-fg}P:${(profitScore*100).toFixed(0)}% L:${(liquidityScore*100).toFixed(0)}% T:${(trendScore*100).toFixed(0)}%{/}`
      );

      const pathStr = cycle.path
        .map(t => CONFIG.tokens[t]?.symbol || t)
        .join('{grey-fg}→{/}');
      L.push(`  {grey-fg}rota:{/} ${pathStr}`);

      for (let i = 0; i < steps.length; i++) {
        const s  = steps[i];
        const fA = CONFIG.tokens[s.from]?.symbol || s.from;
        const fB = CONFIG.tokens[s.to]?.symbol   || s.to;
        const co = i === steps.length - 1 ? '└' : '├';
        // 🔧 Mais casas decimais: in com até 6 dígitos, out com até 6 dígitos
        L.push(
          `  {grey-fg}${co} ${fA}→${fB}{/}` +
          `  {grey-fg}in:{/}{${pc}-fg}${s.amtIn.toFixed(6)}{/}` +
          `  {grey-fg}out:{/}{${pc}-fg}${s.amtOut.toFixed(6)}{/}`
        );
      }
      L.push('{grey-fg}  ' + '─'.repeat(38) + '{/}');
    }

    // 🆕 Cabeçalho com total SUPRA
    if (countSupraArbs > 0) {
      L.unshift(`{yellow-fg}{bold}  💰 Total estimado: ${totalSupraProfit.toFixed(3)} SUPRA (${countSupraArbs} arbs){/}`, '');
    }
  }
  arbBox.setContent(L.join('\n'));
  if (!boxes.scrollPaused()) arbBox.scrollTo(0);
}

module.exports = renderArb;