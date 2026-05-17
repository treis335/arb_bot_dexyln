const fs = require('fs');
const path = require('path');
const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');
const { CONFIG } = require('../config/config');
const { logError } = require('../utils/logError');

// Carregar bytecode
const scriptBytecode = (() => {
    try { return fs.readFileSync(path.join(__dirname, '..', 'move', 'arbitrage_script.mv')); }
    catch (e) { console.error('Script compilado não encontrado.'); return null; }
})();

async function executeArbitrage(opportunity) {
    if (!scriptBytecode) return null;

    try {
        // 1. Inicializar cliente e conta (exatamente como buyTest)
        const client = await SupraClient.init('https://rpc-mainnet.supra.com');
        const privateKeyHex = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
        const account = new SupraAccount(HexString.ensure(privateKeyHex).toUint8Array());

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
            tokenA.type, tokenB.type, tokenC.type,
            `${dex.moduleAddress}::${curveAB}`,
            `${dex.moduleAddress}::${curveBC}`,
            `${dex.moduleAddress}::${curveCA}`,
        ];

        const amountIn = BigInt(Math.floor(optimalAmount * tokenA.decimals));
        const minOutAB = BigInt(Math.floor(steps[0].amtOut * CONFIG.tokens[steps[0].to].decimals * 0.995));
        const minOutBC = BigInt(Math.floor(steps[1].amtOut * CONFIG.tokens[steps[1].to].decimals * 0.995));
        const minOutCA = BigInt(Math.floor(steps[2].amtOut * CONFIG.tokens[steps[2].to].decimals * 0.995));

        // 2. Obter sequence number (exatamente como buyTest)
        const accountInfo = await client.getAccountInfo(new HexString(process.env.SENDER_ADDRESS));
        const sequenceNumber = BigInt(accountInfo.sequence_number);

        // 3. Construir o SCRIPT (não entry function)
        const script = new TxnBuilderTypes.Script(
            new Uint8Array(scriptBytecode),                              // code
            typeArgs.map(ta => new TxnBuilderTypes.TypeTagParser(ta).parseTypeTag()), // type args
            [                                                              // arguments
                new TxnBuilderTypes.TransactionArgumentU64(amountIn),
                new TxnBuilderTypes.TransactionArgumentU64(minOutAB),
                new TxnBuilderTypes.TransactionArgumentU64(minOutBC),
                new TxnBuilderTypes.TransactionArgumentU64(minOutCA),
            ]
        );

        // 4. Construir o payload do script
        const payload = new TxnBuilderTypes.TransactionPayloadScript(script);

        // 5. Construir a RawTransaction (exatamente como os tipos que o buyTest usa internamente)
        const rawTransaction = new TxnBuilderTypes.RawTransaction(
            new TxnBuilderTypes.AccountAddress(HexString.ensure(process.env.SENDER_ADDRESS).toUint8Array()),
            sequenceNumber,
            payload,
            5000n,          // max_gas_amount
            100000n,        // gas_unit_price
            BigInt(Math.floor(Date.now() / 1000) + 300), // expiration
            new TxnBuilderTypes.ChainId(8)
        );

        // 6. Serializar e enviar (exatamente como buyTest)
        const serializer = new BCS.Serializer();
        rawTransaction.serialize(serializer);
        const serializedRawTx = serializer.getBytes();

        console.log('A assinar e submeter arbitragem...');
        const txResult = await client.sendTxUsingSerializedRawTransaction(
            account,
            serializedRawTx,
            { enableWaitForTransaction: true, enableTransactionSimulation: true }
        );

        console.log('✅ Arbitragem submetida:', txResult.txHash);
        return { txHash: txResult.txHash, success: true };
    } catch (err) {
        logError('executeArbitrage', err);
        console.error('Erro na execução:', err.message);
        return null;
    }
}

module.exports = { executeArbitrage };