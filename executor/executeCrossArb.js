// executor/executeCrossArb.js
const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');
const { CONFIG } = require('../config/config');
const { logError } = require('../utils/logError');

async function executeCrossArbitrage(opportunity, onLog = () => {}) {
    const origLog = console.log;
    try {
        console.log = () => {};
        const client = await SupraClient.init('https://rpc-mainnet.supra.com');
        const pkHex = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
        const account = new SupraAccount(HexString.ensure(pkHex).toUint8Array());

        const { cycle, result, optimalAmount } = opportunity;
        const { steps } = result;

        onLog('{grey-fg}A obter sequence number...{/}');
        const accInfo = await client.getAccountInfo(new HexString(process.env.SENDER_ADDRESS));
        const seq = BigInt(accInfo.sequence_number);

        // Construir uma transação com múltiplas entry functions
        const operations = [];
        let currentAmount = BigInt(Math.floor(optimalAmount * CONFIG.tokens[cycle.path[0]].decimals));

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const tokenIn = CONFIG.tokens[step.from];
            const tokenOut = CONFIG.tokens[step.to];
            const minOut = BigInt(Math.floor(step.amtOut * tokenOut.decimals * 0.995));

            if (step.dex === 'DEXLYN' || step.dex === 'DEXLYN_V3') {
                // Dexlyn: usar scripts::swap
                operations.push({
                    function: `${CONFIG.dexes.DEXLYN.moduleAddress}::scripts::swap`,
                    type_arguments: [tokenIn.type, tokenOut.type, `${CONFIG.dexes.DEXLYN.moduleAddress}::${step.pair.curve === 'clmm' ? 'curves::Uncorrelated' : step.pair.curve}`],
                    arguments: [currentAmount.toString(), minOut.toString()],
                });
            } else if (step.dex === 'SPIKEY') {
                // Spikey: usar amm_router::swap_exact_supra_for_tokens_beta (se for SUPRA) ou swap_exact_coins_for_coins_beta
                const fnName = step.from === 'SUPRA' ? 'swap_exact_supra_for_tokens_beta' : 'swap_exact_coins_for_coins_beta';
                const typeArgs = step.from === 'SUPRA'
                    ? []
                    : [tokenIn.type, tokenOut.type];
                operations.push({
                    function: `0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083::amm_router::${fnName}`,
                    type_arguments: typeArgs,
                    arguments: [
                        currentAmount.toString(),
                        minOut.toString(),
                        [step.pair.pairAddress], // rota (apenas um par)
                        process.env.SENDER_ADDRESS,
                        (Math.floor(Date.now() / 1000) + 300).toString(),
                    ],
                });
            }
            currentAmount = minOut; // O output deste passo é o input do próximo
        }

        onLog('{grey-fg}A submeter transação multi‑operação...{/}');
        // Nota: o SupraClient pode não suportar transações multi‑operação diretamente.
        // Em alternativa, podemos usar o payload script (já existente) ou submeter cada operação sequencialmente?
        // A atomicidade só é garantida com um script.
        // Por enquanto, vamos usar o script compilado existente (arbitrage_script.mv) se todos os hops forem Dexlyn,
        // ou o da Spikey (spikey_script.mv) se todos forem Spikey.
        // Para cross‑DEX, precisamos mesmo do script compilado.
        onLog('{yellow-fg}⚠️ Transações multi‑operação ainda não são suportadas pelo SDK. Usa o script compilado.{/}');
        return null;
    } catch (e) {
        logError('executeCrossArbitrage', e);
        onLog(`{red-fg}❌ Erro: ${e.message}{/}`);
        return null;
    } finally {
        console.log = origLog;
    }
}

module.exports = { executeCrossArbitrage };