const asyncLimit = require('../utils/asyncLimit');
const { CONFIG } = require('../config/config');
const priceEngine = require('../engine/priceEngine');
const graphEngine = require('../engine/graphEngine');
const { arbDetector } = require('../detector/arbDetector');
const { logError } = require('../utils/logError');
const renderPrices = require('../tui/renderPrices');
const renderArb = require('../tui/renderArb');
const renderLog = require('../tui/renderlog');
const { renderFooter, setRpcHealthy } = require('../tui/renderFooter');

let bestOpportunity = null;

async function tick(boxes) {
  const t0 = Date.now();
  const limit = asyncLimit(CONFIG.maxConcurrent);

  const tasks = [];
  for (const [dexKey, dex] of Object.entries(CONFIG.dexes)) {
    for (const [tokenA, tokenB, curve] of dex.pairs) {
      tasks.push(limit(() =>
        priceEngine.fetchPairState(dexKey, tokenA, tokenB, curve)
          .catch(e => { logError(`fetchPair ${tokenA}/${tokenB}`, e); return null; })
      ));
    }
  }

  let pairStates, graph, cycles, opps;
  try {
    pairStates = await Promise.all(tasks);
    setRpcHealthy(pairStates.some(p => p !== null));
  } catch (e) {
    logError('Promise.all pairStates', e);
    pairStates = [];
    setRpcHealthy(false);
  }

  try {
    graph  = graphEngine.buildGraph(pairStates.filter(Boolean));
    cycles = graphEngine.findCycles(graph, 4);
  } catch (e) {
    logError('buildGraph/findCycles', e);
    graph = {}; cycles = [];
  }

  try {
    opps = arbDetector.analyzeAll(cycles);
    bestOpportunity = opps[0] || null;   // ← guarda a melhor
  } catch (e) {
    logError('analyzeAll', e);
    opps = [];
    bestOpportunity = null;
  }

  try { renderPrices(pairStates, boxes); } catch (e) { logError('renderPrices', e); }
  try { renderArb(opps, boxes);          } catch (e) { logError('renderArb', e); }
  try { renderLog(opps, boxes);          } catch (e) { logError('renderLog', e); }
  try { renderFooter(opps, Date.now() - t0, boxes); } catch (e) { logError('renderFooter', e); }

  try { boxes.screen.render(); } catch {}
}

function getBestOpportunity() {
  return bestOpportunity;
}

module.exports = { tick, getBestOpportunity };