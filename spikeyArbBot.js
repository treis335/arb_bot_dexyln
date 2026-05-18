// spikeyArbBot.js — Bot de Arbitragem da Spikey (TUI completo, anti‑crash)
// Usa spikeyPools.json como fonte de pools
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const blessed = require('blessed');
const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');

const RPC = 'https://rpc-mainnet.supra.com/rpc/v1';
const SPIKEY = '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083';
const POOLS_FILE = './spikeyPools.json';
const ERR_LOG = './spikey_errors.log';
const POLLING_MS = 3000;
const MIN_PROFIT_PCT = 0.05;
const MAX_GAS_AMOUNT = 5000;
const GAS_UNIT_PRICE = 100000;

function logError(ctx, err) {
    const msg = `[${new Date().toISOString()}] ${ctx}: ${err.message || err}\n`;
    try { fs.appendFileSync(ERR_LOG, msg); } catch {}
}

const DECIMALS = { SUPRA: 1e8, CASH: 1e8, SPIKE: 1e3 };
function getDecimals(sym) { return DECIMALS[sym] || 1e6; }

async function callView(fn, args = []) {
    const res = await axios.post(`${RPC}/view`, {
        function: `${SPIKEY}::${fn}`,
        type_arguments: [],
        arguments: args,
    }, { timeout: 10000 });
    return res.data.result;
}

function getAmountOut(reserveIn, reserveOut, amountIn, feeBps = 25) {
    const rIn = BigInt(Math.floor(reserveIn));
    const rOut = BigInt(Math.floor(reserveOut));
    const aIn = BigInt(Math.floor(amountIn));
    const feeMul = 10000n - BigInt(feeBps);
    const afterFee = (aIn * feeMul) / 10000n;
    if (afterFee <= 0n) return 0n;
    return (afterFee * rOut) / (rIn + afterFee);
}

function loadPools() {
    try { return JSON.parse(fs.readFileSync(POOLS_FILE, 'utf8')); }
    catch (e) { return []; }
}

async function fetchPoolState(pool) {
    try {
        const [reserves, fee] = await Promise.all([
            callView('amm_pair::get_reserves', [pool.address]),
            callView('amm_controller::get_swap_fee').catch(() => [25]),
        ]);
        if (!reserves || reserves.length < 2) return null;
        const r0 = Number(reserves[0]), r1 = Number(reserves[1]);
        if (r0 === 0 && r1 === 0) return null;
        const feeBps = Number(Array.isArray(fee) ? fee[0] : fee);
        const decA = getDecimals(pool.tokenA), decB = getDecimals(pool.tokenB);
        const price = Number(getAmountOut(r0, r1, decA, feeBps)) / decB;
        return {
            dex: 'SPIKEY', tokenA: pool.tokenA, tokenB: pool.tokenB,
            curve: 'constant_product', pairAddress: pool.address,
            reserveA: r0, reserveB: r1, fee: feeBps, feeScale: 10000,
            priceAinB: isNaN(price) ? 0 : price,
        };
    } catch (e) {
        logError(`fetchPoolState ${pool.address}`, e);
        return null;
    }
}

// Grafo, ciclos, simulação, execução (mantidos iguais ao original)
function buildGraph(states) {
    const g = {};
    for (const s of states) {
        if (!g[s.tokenA]) g[s.tokenA] = [];
        if (!g[s.tokenB]) g[s.tokenB] = [];
        g[s.tokenA].push({ neighbor: s.tokenB, pair: s, direction: 'AB' });
        g[s.tokenB].push({ neighbor: s.tokenA, pair: s, direction: 'BA' });
    }
    return g;
}

function findCycles(graph, maxLen = 4) {
    const cycles = [];
    const dfs = (start, cur, path, edges, visited) => {
        if (path.length > 1 && cur === start) { cycles.push({ path: [...path, start], edges: [...edges] }); return; }
        if (path.length >= maxLen) return;
        for (const edge of (graph[cur] || [])) {
            if (edge.neighbor === start && path.length > 1) { cycles.push({ path: [...path, start], edges: [...edges, edge] }); continue; }
            if (!visited.has(edge.neighbor)) {
                visited.add(edge.neighbor);
                dfs(start, edge.neighbor, [...path, edge.neighbor], [...edges, edge], visited);
                visited.delete(edge.neighbor);
            }
        }
    };
    for (const t of Object.keys(graph)) dfs(t, t, [t], [], new Set([t]));
    const seen = new Set();
    return cycles.filter(c => { const k = c.path.slice(0, -1).sort().join('-'); if (seen.has(k)) return false; seen.add(k); return true; });
}

function simulateCycle(cycle, amountIn) {
    let amt = amountIn;
    for (const e of cycle.edges) {
        const p = e.pair;
        const decIn = getDecimals(e.direction === 'AB' ? p.tokenA : p.tokenB);
        const decOut = getDecimals(e.direction === 'AB' ? p.tokenB : p.tokenA);
        const raw = getAmountOut(
            e.direction === 'AB' ? p.reserveA : p.reserveB,
            e.direction === 'AB' ? p.reserveB : p.reserveA,
            amt * decIn, p.fee
        );
        amt = Number(raw) / decOut;
        if (amt <= 0) return 0;
    }
    return amt;
}

function findOptimalAmount(cycle) {
    let lo = 1, hi = 50000;
    for (let i = 0; i < 25; i++) {
        const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        simulateCycle(cycle, m1) - m1 < simulateCycle(cycle, m2) - m2 ? lo = m1 : hi = m2;
    }
    const opt = (lo + hi) / 2;
    return { amount: opt, profit: simulateCycle(cycle, opt) - opt };
}

async function executeSpikeyArbitrage(opp, onLog = () => {}) {
    const origLog = console.log;
    try {
        console.log = () => {};
        const client = await SupraClient.init('https://rpc-mainnet.supra.com');
        const pkHex = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
        const account = new SupraAccount(HexString.ensure(pkHex).toUint8Array());

        const { cycle } = opp;
        const route = cycle.edges.map(e => e.pair.pairAddress);
        const tokenIn = cycle.path[0];
        const tokenOut = cycle.path[cycle.path.length - 1];
        const decIn = getDecimals(tokenIn);

        const amountIn = BigInt(Math.floor(opp.amount * decIn));
        const minOut = BigInt(Math.floor(cycle.edges[cycle.edges.length - 1].direction === 'AB'
            ? getAmountOut(cycle.edges[cycle.edges.length - 1].pair.reserveA, cycle.edges[cycle.edges.length - 1].pair.reserveB, opp.amount * decIn, cycle.edges[cycle.edges.length - 1].pair.fee)
            : getAmountOut(cycle.edges[cycle.edges.length - 1].pair.reserveB, cycle.edges[cycle.edges.length - 1].pair.reserveA, opp.amount * decIn, cycle.edges[cycle.edges.length - 1].pair.fee)) * 995n / 1000n);

        onLog('{grey-fg}A obter sequence number...{/}');
        const accInfo = await client.getAccountInfo(new HexString(process.env.SENDER_ADDRESS));
        const seq = BigInt(accInfo.sequence_number);

        onLog('{grey-fg}A construir transação Spikey...{/}');
        const funcArgs = [
            BCS.bcsSerializeUint64(amountIn),
            BCS.bcsSerializeUint64(minOut),
            route,
            process.env.SENDER_ADDRESS,
            Math.floor(Date.now() / 1000) + 300,
        ];
        const funcTypeArgs = [new TxnBuilderTypes.TypeTagParser(`0x1::supra_coin::SupraCoin`).parseTypeTag()];
        const fnName = tokenIn === 'SUPRA' ? 'swap_exact_supra_for_tokens_beta'
            : tokenOut === 'SUPRA' ? 'swap_exact_tokens_for_supra_beta'
            : 'swap_exact_coins_for_coins_beta';

        const rawTx = await client.createRawTxObject(
            new HexString(process.env.SENDER_ADDRESS), BigInt(seq),
            SPIKEY, 'amm_router', fnName,
            funcTypeArgs, funcArgs,
            { maxGasAmount: BigInt(MAX_GAS_AMOUNT), gasUnitPrice: BigInt(GAS_UNIT_PRICE), expirationTime: Math.floor(Date.now() / 1000) + 300 }
        );

        const ser = new BCS.Serializer();
        rawTx.serialize(ser);
        const serTx = ser.getBytes();

        onLog('{yellow-fg}A submeter transação...{/}');
        const txRes = await client.sendTxUsingSerializedRawTransaction(account, serTx, { enableWaitForTransaction: true, enableTransactionSimulation: true });
        onLog('{green-fg}✅ Transação submetida!{/}');
        return { txHash: txRes.txHash, success: true };
    } catch (e) {
        logError('executeSpikeyArbitrage', e);
        onLog(`{red-fg}❌ Erro: ${e.message}{/}`);
        return null;
    } finally { console.log = origLog; }
}

// ═══════════════ TUI ═══════════════
const screen = blessed.screen({ smartCSR: true, title: 'Spikey Arb Bot', fullUnicode: true, forceUnicode: true });
screen.program.hideCursor();

const headerBox = blessed.box({ top: 0, left: 0, width: '55%', height: 5, tags: true, wrap: false });
const pricesBox = blessed.box({ top: 5, left: 0, width: '55%', bottom: 2, tags: true, wrap: false, scrollable: true, alwaysScroll: true, scrollbar: { ch: '│', style: { fg: 'grey' } }, border: { type: 'line' }, label: ' {bold}{grey-fg}MERCADO SPIKEY{/}{/} ', style: { border: { fg: 'grey' } } });
const arbBox = blessed.box({ top: 0, left: '55%', width: '45%', height: '60%', tags: true, wrap: false, scrollable: true, alwaysScroll: true, scrollbar: { ch: '│', style: { fg: 'cyan' } }, border: { type: 'line' }, label: ' {bold}{cyan-fg}ARB DETECTOR{/}{/} ', style: { border: { fg: 'cyan' } } });
const logBox = blessed.box({ top: '60%', left: '55%', width: '45%', bottom: 2, tags: true, wrap: false, scrollable: true, alwaysScroll: true, scrollbar: { ch: '│', style: { fg: 'blue' } }, border: { type: 'line' }, label: ' {bold}{blue-fg}LOG DE ARBS{/}{/} ', style: { border: { fg: 'blue' } } });
const footerBox = blessed.box({ bottom: 0, left: 0, width: '100%', height: 2, tags: true, wrap: false });

screen.append(headerBox); screen.append(pricesBox); screen.append(arbBox); screen.append(logBox); screen.append(footerBox);

const scrollBoxes = [pricesBox, arbBox, logBox];
let focusIdx = 1, scrollPaused = false, autoMode = false, txInProgress = false, errorCount = 0;
function setFocus(i) { focusIdx = i; pricesBox.style.border.fg = i === 0 ? 'white' : 'grey'; arbBox.style.border.fg = i === 1 ? 'cyan' : 'grey'; logBox.style.border.fg = i === 2 ? 'blue' : 'grey'; scrollBoxes[i].focus(); screen.render(); }
setFocus(1);

screen.key(['tab'], () => setFocus((focusIdx + 1) % 3));
screen.key(['space'], () => { scrollPaused = !scrollPaused; arbBox.setLabel(scrollPaused ? ' {bold}{cyan-fg}ARB DETECTOR{/}{/} {yellow-fg}[PAUSADO]{/} ' : ' {bold}{cyan-fg}ARB DETECTOR{/}{/} '); screen.render(); });
screen.key(['up', 'down', 'pageup', 'pagedown', 'home', 'end'], (key) => {
    if (focusIdx > 0) scrollPaused = true;
    const box = scrollBoxes[focusIdx];
    if (key.name === 'up') box.scroll(-1); else if (key.name === 'down') box.scroll(1);
    else if (key.name === 'pageup') box.scroll(-10); else if (key.name === 'pagedown') box.scroll(10);
    else if (key.name === 'home') box.scrollTo(0); else if (key.name === 'end') box.scrollTo(box.getScrollHeight());
    screen.render();
});

pricesBox.on('wheeldown', () => { pricesBox.scroll(3); screen.render(); });
pricesBox.on('wheelup', () => { pricesBox.scroll(-3); screen.render(); });
arbBox.on('wheeldown', () => { scrollPaused = true; arbBox.scroll(3); screen.render(); });
arbBox.on('wheelup', () => { scrollPaused = true; arbBox.scroll(-3); screen.render(); });
logBox.on('wheeldown', () => { logBox.scroll(3); screen.render(); });
logBox.on('wheelup', () => { logBox.scroll(-3); screen.render(); });
pricesBox.on('click', () => setFocus(0)); arbBox.on('click', () => setFocus(1)); logBox.on('click', () => setFocus(2));

class TxOverlay {
    constructor(screen) {
        this.screen = screen; this.lines = []; this.visible = false; this.timeoutId = null;
        this.box = blessed.box({ parent: screen, top: 'center', left: 'center', width: '60%', height: '40%', tags: true, border: { type: 'line' }, style: { border: { fg: 'cyan' }, fg: 'white', bg: 'black' }, label: ' {bold}{cyan-fg}EXECUÇÃO SPIKEY{/} ', scrollable: true, alwaysScroll: true, scrollbar: { ch: '│', style: { fg: 'cyan' } }, keys: true, hidden: true, wrap: false, content: '' });
        this.box.hide();
    }
    show() { if (this.timeoutId) clearTimeout(this.timeoutId); this.lines = []; this.box.setContent(''); this.box.show(); this.visible = true; this.screen.render(); }
    hide() { if (!this.visible) return; this.box.hide(); this.visible = false; this.screen.render(); }
    log(msg) { this.lines.push(msg); if (this.lines.length > 100) this.lines.shift(); this.box.setContent(this.lines.join('\n')); this.box.scrollTo(this.lines.length); if (this.visible) this.screen.render(); }
    success(hash) { this.log('{green-fg}✅ Transação submetida!{/}'); this.log(`{grey-fg}Hash: {/}{bright-cyan-fg}${hash}{/}`); this.timeoutId = setTimeout(() => this.hide(), 8000); }
    error(msg) { this.log(`{red-fg}❌ Erro: ${msg}{/}`); this.timeoutId = setTimeout(() => this.hide(), 5000); }
}
const txOverlay = new TxOverlay(screen);

screen.key(['e'], async () => {
    if (txInProgress) return;
    const opp = opps[0];
    if (!opp) { txOverlay.show(); txOverlay.error('Nenhuma oportunidade.'); return; }
    txInProgress = true; txOverlay.show();
    txOverlay.log('{yellow-fg}⏳ A executar...{/}');
    try {
        const res = await executeSpikeyArbitrage(opp, (m) => txOverlay.log(m));
        if (res && res.txHash) txOverlay.success(res.txHash);
        else txOverlay.error('Falhou (ver logs).');
    } catch (e) { txOverlay.error(e.message); }
    txInProgress = false;
});

screen.key(['a'], () => { autoMode = !autoMode; screen.render(); });
screen.key(['c'], () => {
    try {
        const raw = arbBox.getContent(); const clean = blessed.stripTags(raw);
        const fname = `spikey_snapshot_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
        fs.writeFileSync(fname, clean, 'utf8');
        footerBox.setContent(`{green-fg}✅ Snapshot: ${fname}{/}`); screen.render();
    } catch (e) { footerBox.setContent('{red-fg}❌ Erro snapshot.{/}'); screen.render(); }
});
screen.key(['escape'], () => { txOverlay.hide(); txInProgress = false; });
screen.key(['q', 'C-c'], () => { screen.program.showCursor(); screen.destroy(); process.exit(0); });

let pairStates = [], opps = [], arbLog = [];

async function tick() {
    const t0 = Date.now();
    const pools = loadPools();
    const states = [];
    for (const p of pools) {
        const s = await fetchPoolState(p);
        if (s) states.push(s);
    }
    pairStates = states;

    // Header + prices
    const hdr = ['{bright-cyan-fg}{bold}  🦈 SPIKEY ARBITRAGE BOT{/}', `{grey-fg}  ${states.length} pares | ${new Date().toLocaleDateString('pt-PT')}{/}`, '', '{yellow-fg}{bold}  MERCADO{/}', '{grey-fg}  ' + 'PAR'.padEnd(14) + 'PREÇO'.padEnd(14) + 'RES.A'.padEnd(12) + 'RES.B'.padEnd(12) + 'FEE{/}', '{grey-fg}  ' + '─'.repeat(56) + '{/}'];
    const lines = [];
    for (const s of states) {
        const pair = `{bold}${s.tokenA}{/}/{grey-fg}${s.tokenB}{/}`.padEnd(14);
        const price = s.priceAinB.toFixed(6).padStart(10);
        const rA = (s.reserveA / getDecimals(s.tokenA)).toFixed(2).padStart(10);
        const rB = (s.reserveB / getDecimals(s.tokenB)).toFixed(2).padStart(10);
        const fee = ((s.fee / 100).toFixed(2) + '%').padStart(5);
        lines.push(`  ${pair}${price}  ${rA}  ${rB}  ${fee}`);
    }
    headerBox.setContent(hdr.join('\n'));
    pricesBox.setContent(lines.join('\n'));

    // Graph & cycles
    const graph = buildGraph(states);
    const cycles = findCycles(graph, 4);
    opps = [];
    for (const c of cycles) {
        const { amount, profit } = findOptimalAmount(c);
        if (profit <= 0) continue;
        const pct = (profit / amount) * 100;
        if (pct < MIN_PROFIT_PCT) continue;
        opps.push({ cycle: c, amount, profit, profitPct: pct });
    }
    opps.sort((a, b) => b.profitPct - a.profitPct);

    // ARB box
    const arbLines = opps.length === 0 ? ['{grey-fg}  Sem oportunidades acima de ' + MIN_PROFIT_PCT + '%{/}'] : [];
    for (const opp of opps.slice(0, 5)) {
        arbLines.push(`{yellow-fg}🔥 +${opp.profitPct.toFixed(3)}% +${opp.profit.toFixed(4)} ~${opp.amount.toFixed(1)}{/}`);
        arbLines.push(`  {grey-fg}Rota: ${opp.cycle.path.join(' → ')}{/}`);
        for (let i = 0; i < opp.cycle.edges.length; i++) {
            const e = opp.cycle.edges[i];
            const dir = e.direction === 'AB' ? `${e.pair.tokenA}→${e.pair.tokenB}` : `${e.pair.tokenB}→${e.pair.tokenA}`;
            arbLines.push(`  {grey-fg}${i + 1}. ${dir}{/}`);
        }
        arbLines.push('{grey-fg}  ' + '─'.repeat(30) + '{/}');
    }
    arbBox.setContent(arbLines.join('\n'));
    if (!scrollPaused) arbBox.scrollTo(0);

    // Log
    for (const opp of opps.slice(0, 3)) {
        arbLog.unshift({ time: new Date().toLocaleTimeString('pt-PT'), path: opp.cycle.path.join('→'), profitPct: opp.profitPct });
    }
    if (arbLog.length > 8) arbLog.length = 8;
    const logLines = arbLog.length ? arbLog.map(e => `{grey-fg}${e.time}{/} {yellow-fg}+${e.profitPct.toFixed(3)}%{/} {grey-fg}${e.path}{/}`) : ['{grey-fg} Aguardando...{/}'];
    logBox.setContent(logLines.join('\n'));

    // Footer
    const best = opps[0];
    const bestStr = best ? `{bright-green-fg}▲ +${best.profitPct.toFixed(3)}%{/}` : '{grey-fg}sem arb{/}';
    const errStr = errorCount > 0 ? `{red-fg}⚠${errorCount}{/}` : '';
    footerBox.setContent(`{grey-fg}─{/} ${autoMode ? '{green-fg}AUTO{/}' : '{grey-fg}MAN{/}'} ${bestStr} {grey-fg}t:${Date.now() - t0}ms a:e:q ${errStr}{/}`);

    // Auto-execute
    if (autoMode && opps.length > 0 && !txInProgress) {
        txInProgress = true;
        const bestOpp = opps[0];
        txOverlay.show();
        txOverlay.log('{yellow-fg}🤖 Auto-execução...{/}');
        try {
            const res = await executeSpikeyArbitrage(bestOpp, (m) => txOverlay.log(m));
            if (res && res.txHash) txOverlay.success(res.txHash);
            else txOverlay.error('Falhou.');
        } catch (e) { txOverlay.error(e.message); }
        txInProgress = false;
    }

    try { screen.render(); } catch (e) { logError('screen.render', e); }
}

(async () => {
    console.log = () => {}; // Silencia logs do SDK
    while (true) {
        try {
            await tick();
        } catch (e) {
            errorCount++;
            logError('tick', e);
            // Tenta restaurar o ecrã mesmo após erro
            try { screen.render(); } catch {}
        }
        await new Promise(r => setTimeout(r, POLLING_MS));
    }
})();