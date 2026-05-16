const fs = require('fs');
const path = require('path');
const { getSupraClient } = require('../utils/supraClient');
const { CONFIG } = require('../config/config');
const { SupraAccount } = require('supra-l1-sdk');

// Carregar bytecode compilado uma vez
const scriptBytecode = fs.readFileSync(
    path.join(__dirname, '..', 'move', 'arbitrage_script.mv')
);

/**
 * Executa uma oportunidade de arbitragem.
 * @param {Object} opportunity - Oportunidade gerada pelo arbDetector
 * @returns {Object} Resultado da transação ou null
 */
async function executeArbitrage(opportunity) {
    const client = await getSupraClient();
    const account = new SupraAccount(process.env.PRIVATE_KEY);

    const { cycle, result, optimalAmount } = opportunity;
    const { steps } = result;

    // 1. Extrair tokens e curvas
    const tokenA = CONFIG.tokens[cycle.path[0]];
    const tokenB = CONFIG.tokens[cycle.path[1]];
    const tokenC = CONFIG.tokens[cycle.path[2]];

    const dex = CONFIG.dexes.DEXLYN;
    const curveAB = dex.curveTypes[steps[0].pair.curve];
    const curveBC = dex.curveTypes[steps[1].pair.curve];
    const curveCA = dex.curveTypes[steps[2].pair.curve];

    // 2. Type arguments para o script (genéricos)
    const typeArgs = [
        tokenA.type,
        tokenB.type,
        tokenC.type,
        `${dex.moduleAddress}::${curveAB}`,
        `${dex.moduleAddress}::${curveBC}`,
        `${dex.moduleAddress}::${curveCA}`,
    ];

    // 3. Calcular montantes com slippage (0.5% de margem)
    const amountIn = BigInt(Math.floor(optimalAmount * tokenA.decimals));
    const minOutAB = BigInt(Math.floor(steps[0].amtOut * CONFIG.tokens[steps[0].to].decimals * 0.995));
    const minOutBC = BigInt(Math.floor(steps[1].amtOut * CONFIG.tokens[steps[1].to].decimals * 0.995));
    const minOutCA = BigInt(Math.floor(steps[2].amtOut * CONFIG.tokens[steps[2].to].decimals * 0.995));

    const args = [
        amountIn.toString(),
        minOutAB.toString(),
        minOutBC.toString(),
        minOutCA.toString(),
    ];

    // 4. Construir transação
    try {
        const tx = await client.createTransaction({
            sender: process.env.SENDER_ADDRESS,
            payload: {
                type: 'script_payload',
                code: Array.from(scriptBytecode), // SDK espera byte array
                type_arguments: typeArgs,
                arguments: args,
            },
            // Opções de gás (ajustar conforme necessário)
            max_gas_amount: 50000,
            gas_unit_price: 1,
        });

        // 5. Assinar e submeter
        const signedTx = await client.signTransaction(tx, account);
        const txHash = await client.submitTransaction(signedTx);
        console.log('Transação submetida:', txHash);

        // 6. Aguardar confirmação (opcional, podes só retornar o hash)
        const receipt = await client.waitForTransaction(txHash);
        return { txHash, success: receipt.success };
    } catch (err) {
        console.error('Erro ao executar arbitragem:', err.message || err);
        return null;
    }
}

module.exports = { executeArbitrage };