// loop/tick.js — CORRIGIDO + OTIMIZADO
// CORREÇÕES:
// 1. fetchPoolState recebe tokenA/tokenB para que o estado saiba os seus tokens
// 2. _simulate do V3 usa o estado com _tokenA/_tokenB
// 3. walletBalance via HTTP REST como fallback se SDK não disponível

const asyncLimit = require('../utils/asyncLimit');
const { CONFIG } = require('../config/config');
const priceEngine = require('../dexes/dexlyn/dexlynEngine');
const priceEngineV3 = require('../dexes/dexlyn/dexlynEngineV3');
const spikeyEngine = require('../dexes/spikey/spikeyEngine');
const { SPIKEY_CONFIG } = require('../dexes/spikey/spikeyConfig');
const graphEngine = require('../engine/graphEngine');
const { arbDetector } = require('../detector/arbDetector');
const { logError } = require('../utils/logError');
const renderPrices = require('../tui/renderPrices');
const renderArb = require('../tui/renderArb');
const renderLog = require('../tui/renderlog');
const { renderFooter, setRpcHealthy } = require('../tui/renderFooter');
const { fetchWalletBalance } = require('../utils/walletBalance');

let bestOpportunity = null;
let currentOpps = [];

function taskWithTimeout(task, ms = 20000) {
  return Promise.race([
    task,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Task timeout')), ms)
    ),
  ]);
}

let lastAutoTxTime = 0;
let consecutiveFails = 0;
let autoTxInProgress = false;

async function maybeAutoExecute(opps, balances, boxes) {
  const cfg = CONFIG.autoExecute;
  if (!cfg || !cfg.enabled) return;
  if (autoTxInProgress) return;

  const now = Date.now();
  if (now - lastAutoTxTime < cfg.cooldownMs) return;
  if (!opps || opps.length === 0) return;

  const availableSUPRA = Math.max(0, (balances.SUPRA || 0) - cfg.gasReserveSUPRA);

  const viableOpps = opps.filter(opp => {
    const tokenIn = opp.cycle.path[0];
    if (tokenIn !== 'SUPRA') return false;
    if (opp.result.profitPct < cfg.minProfitPct) return false;
    if (opp.score < cfg.minScore) return false;
    if (opp.optimalAmount > availableSUPRA) return false;
    return true;
  });

  if (viableOpps.length === 0) return;

  const bestOpp = viableOpps[0];
  autoTxInProgress = true;
  lastAutoTxTime = now;

  const { executeArbitrage } = require('../dexes/dexlyn/dexlynExecute');
  const log = (msg) => {
    boxes.footerBox.setContent(msg);
    boxes.screen.render();
  };

  log(`{yellow-fg}🤖 Auto: ${bestOpp.cycle.path.map(t => CONFIG.tokens[t]?.symbol || t).join('→')} (+${bestOpp.result.profitPct.toFixed(3)}%){/}`);

  try {
    const res = await executeArbitrage(bestOpp, () => {});
    if (res && res.txHash) {
      consecutiveFails = 0;
      log(`{green-fg}✅ Sucesso! Tx: ${res.txHash.slice(0, 10)}...{/}`);
    } else {
      consecutiveFails++;
      log(`{red-fg}❌ Falhou.{/}`);
    }
  } catch (e) {
    consecutiveFails++;
    log(`{red-fg}❌ Erro: ${e.message}{/}`);
  }

  if (consecutiveFails >= cfg.maxConsecutiveFails) {
    CONFIG.autoExecute.enabled = false;
    log(`{red-fg}⚠️ Muitas falhas. Auto-execução DESLIGADA.{/}`);
  }

  autoTxInProgress = false;
}

async function tick(boxes) {
  const t0 = Date.now();
  const limit = asyncLimit(CONFIG.maxConcurrent);
  const tasks = [];

  // ═══ 1. Dexlyn V2 ═══
  for (const [dexKey, dex] of Object.entries(CONFIG.dexes)) {
    for (const [tokenA, tokenB, curve] of dex.pairs) {
      tasks.push(limit(() =>
        taskWithTimeout(
          priceEngine.fetchPairState(dexKey, tokenA, tokenB, curve),
          20000
        ).catch(e => { logError(`fetchPair ${tokenA}/${tokenB}`, e); return null; })
      ));
    }
  }

  // ═══ 2. Dexlyn V3 ═══
  if (CONFIG.v3Pools?.pools?.length > 0) {
    for (const v3pool of CONFIG.v3Pools.pools) {
      tasks.push(limit(() =>
        taskWithTimeout(
          (async () => {
            // CORRIGIDO: passa tokenA e tokenB para o fetchPoolState
            const state = await priceEngineV3.fetchPoolState(v3pool.address, v3pool.tokenA, v3pool.tokenB);
            if (!state) return null;

            const tokA = CONFIG.tokens[v3pool.tokenA] || { decimals: 1e8 };
            const tokB = CONFIG.tokens[v3pool.tokenB] || { decimals: 1e6 };

            return {
              dex: 'DEXLYN_V3',
              tokenA: v3pool.tokenA,
              tokenB: v3pool.tokenB,
              curve: 'clmm',
              poolAddress: v3pool.address,
              state,
              reserveA: Number(state.assetA),
              reserveB: Number(state.assetB),
              fee: state.feeRate,
              feeScale: 1_000_000, // CORRIGIDO: V3 usa 1M como escala (basis points × 1M)
              priceAinB: priceEngineV3.getPrice(state, 'AB'),
              // _simulate: interface unificada
              _simulate: (direction, amountIn) =>
                priceEngineV3.simulateTrade(state, direction, amountIn),
            };
          })(),
          20000
        ).catch(e => { logError(`fetchPoolV3 ${v3pool.address}`, e); return null; })
      ));
    }
  }

  // ═══ 3. Spikey ═══
  if (SPIKEY_CONFIG?.pairs?.length > 0) {
    for (const pair of SPIKEY_CONFIG.pairs) {
      tasks.push(limit(() =>
        taskWithTimeout(
          spikeyEngine.fetchPairState(pair.tokenA, pair.tokenB),
          20000
        ).catch(e => { logError(`fetchSpikeyPair ${pair.tokenA}/${pair.tokenB}`, e); return null; })
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

  await new Promise(resolve => setImmediate(resolve));

  try {
    graph  = graphEngine.buildGraph(pairStates.filter(Boolean));
    cycles = graphEngine.findCycles(graph, 4);
  } catch (e) {
    logError('buildGraph/findCycles', e);
    graph  = {};
    cycles = [];
  }

  try {
    opps = arbDetector.analyzeAll(cycles);
    bestOpportunity = opps[0] || null;
    currentOpps = opps;
  } catch (e) {
    logError('analyzeAll', e);
    opps = [];
    bestOpportunity = null;
    currentOpps = [];
  }

  const walletBalances = process.env.SENDER_ADDRESS
    ? await fetchWalletBalance(process.env.SENDER_ADDRESS).catch(() => ({}))
    : {};

  if (CONFIG.autoExecute?.enabled) {
    await maybeAutoExecute(opps, walletBalances, boxes).catch(e => logError('autoExecute', e));
  }

  try { renderPrices(pairStates, boxes, walletBalances); } catch (e) { logError('renderPrices', e); }
  try { renderArb(opps, boxes); }    catch (e) { logError('renderArb', e); }
  try { renderLog(opps, boxes); }    catch (e) { logError('renderLog', e); }
  try { renderFooter(opps, Date.now() - t0, boxes); } catch (e) { logError('renderFooter', e); }

  try { boxes.screen.render(); } catch {}
}

function getBestOpportunity() { return bestOpportunity; }
function getOpps() { return currentOpps || []; }

module.exports = { tick, getBestOpportunity, getOpps };