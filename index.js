require('dotenv').config();
const { initScreen } = require('./tui/monitor');
const { tick } = require('./loop/tick');
const { CONFIG } = require('./config/config');
const { logError } = require('./utils/logError');
const { getSupraClient } = require('./utils/supraClient');

(async () => {
  // Tratamento global de erros
  process.on('uncaughtException', (err) => { logError('uncaughtException', err); });
  process.on('unhandledRejection', (reason) => { logError('unhandledRejection', reason); });

  // Inicialização segura do SDK – se falhar, o bot continua só com deteção
  try {
   // await getSupraClient();
    console.log('✅ Cliente Supra pronto.');
  } catch (e) {
    logError('SupraClient init', e);
    console.warn('⚠️ Cliente Supra indisponível – execução de arbitragem desativada.');
  }

  const boxes = initScreen();

  function shutdown() {
    try { boxes.screen.program.showCursor(); boxes.screen.destroy(); } catch {}
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    boxes.pricesBox.setContent('{grey-fg}  ◈ Dexlyn Arb Bot v2.5.1 — a inicializar...{/}');
    boxes.screen.render();
    await tick(boxes);
  } catch (e) {
    logError('tick inicial', e);
  }

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try { await tick(boxes); } catch (e) { logError('tick interval', e); }
    running = false;
  }, CONFIG.pollingMs);
})();