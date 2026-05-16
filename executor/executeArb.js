const fs = require('fs');
const path = require('path');
const { getSupraClient, SupraAccount } = require('../utils/supraClient');
const { CONFIG } = require('../config/config');
const { logError } = require('../utils/logError');

let scriptBytecode = null;
try {
    scriptBytecode = fs.readFileSync(
        path.join(__dirname, '..', 'move', 'arbitrage_script.mv')
    );
} catch (e) {
    console.error('Script compilado não encontrado:', e.message);
}

function toU64LE(num) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setBigUint64(0, BigInt(num), true); // little-endian
    return new Uint8Array(buf);
}

async function executeArbitrage(opportunity) {
    if (!scriptBytecode) {
        console.error('Script compilado não encontrado.');
        return null;
    }

    const client = await getSupraClient();
    const account = new SupraAccount(process.env.PRIVATE_KEY);

    const { cycle, result, optimalAmount } = opportunity;
    const { steps } = result;

    const tokenA = CONFIG.tokens[cycle.path[0]];
    const tokenB = CONFIG.tokens[cycle.path[1]];
    const tokenC = CONFIG.tokens[cycle.path[2]];

    const dex = CONFIG.dexes.DEXLYN;
    const curveAB = dex.curveTypes[steps[0].pair.curve];
    const curveBC = dex.curveTypes[steps[1].pair.curve];
    const curveCA = dex.curveTypes[steps[2].pair.curve];

    const typeArgs = [
        tokenA.type,
        tokenB.type,
        tokenC.type,
        `${dex.moduleAddress}::${curveAB}`,
        `${dex.moduleAddress}::${curveBC}`,
        `${dex.moduleAddress}::${curveCA}`,
    ];

    const amountIn = Math.floor(optimalAmount * tokenA.decimals);
    const minOutAB = Math.floor(steps[0].amtOut * CONFIG.tokens[steps[0].to].decimals * 0.995);
    const minOutBC = Math.floor(steps[1].amtOut * CONFIG.tokens[steps[1].to].decimals * 0.995);
    const minOutCA = Math.floor(steps[2].amtOut * CONFIG.tokens[steps[2].to].decimals * 0.995);

    try {
        console.log('A criar transação...');
        const tx = await client.createTransaction({
            sender: process.env.SENDER_ADDRESS,
            payload: {
                type: 'script_payload',
                code: new Uint8Array(scriptBytecode),
                type_arguments: typeArgs,
                arguments: [
                    toU64LE(amountIn),
                    toU64LE(minOutAB),
                    toU64LE(minOutBC),
                    toU64LE(minOutCA),
                ],
            },
            max_gas_amount: 50000,
            gas_unit_price: 1,
        });

        console.log('A assinar...');
        const signedTx = await client.signTransaction(tx, account);
        
        console.log('A submeter...');
        const txHash = await client.submitTransaction(signedTx);
        console.log('Transação submetida:', txHash);

        const receipt = await client.waitForTransaction(txHash);
        return { txHash, success: receipt?.success ?? true };
    } catch (err) {
        logError('executeArbitrage', err);
        console.error('Erro ao executar:', err.message || err);
        return null;
    }
}

module.exports = { executeArbitrage };