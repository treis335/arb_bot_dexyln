const fs = require('fs');
const path = require('path');
const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');
const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');

const scriptBytecode = (() => {
    try { return fs.readFileSync(path.join(__dirname, '..', '..', 'move', 'arbitrage_script.mv')); }
    catch (e) { console.error('Script compilado não encontrado.'); return null; }
})();

async function executeArbitrage(opportunity, onLog = () => {}) {
    if (!scriptBytecode) {
        onLog('{red-fg}Script compilado não encontrado.{/}');
        return null;
    }

    // Guarda a referência original do console.log
    const originalLog = console.log;

    try {
        // 🔇 Silencia o console.log durante a transação para não sujar o terminal
        console.log = () => {};

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

        onLog('{grey-fg}A obter sequence number...{/}');
        const accountInfo = await client.getAccountInfo(new HexString(process.env.SENDER_ADDRESS));
        const sequenceNumber = BigInt(accountInfo.sequence_number);

        onLog('{grey-fg}A construir script...{/}');
        const script = new TxnBuilderTypes.Script(
            new Uint8Array(scriptBytecode),
            typeArgs.map(ta => new TxnBuilderTypes.TypeTagParser(ta).parseTypeTag()),
            [
                new TxnBuilderTypes.TransactionArgumentU64(amountIn),
                new TxnBuilderTypes.TransactionArgumentU64(minOutAB),
                new TxnBuilderTypes.TransactionArgumentU64(minOutBC),
                new TxnBuilderTypes.TransactionArgumentU64(minOutCA),
            ]
        );

        const payload = new TxnBuilderTypes.TransactionPayloadScript(script);
        const rawTransaction = new TxnBuilderTypes.RawTransaction(
            new TxnBuilderTypes.AccountAddress(HexString.ensure(process.env.SENDER_ADDRESS).toUint8Array()),
            sequenceNumber,
            payload,
            5000n,
            100000n,
            BigInt(Math.floor(Date.now() / 1000) + 300),
            new TxnBuilderTypes.ChainId(8)
        );

        const serializer = new BCS.Serializer();
        rawTransaction.serialize(serializer);
        const serializedRawTx = serializer.getBytes();

        onLog('{yellow-fg}A submeter transação...{/}');
        const txResult = await client.sendTxUsingSerializedRawTransaction(
            account,
            serializedRawTx,
            { enableWaitForTransaction: true, enableTransactionSimulation: true }
        );

        onLog('{green-fg}✅ Transação submetida!{/}');
        return { txHash: txResult.txHash, success: true };
    } catch (err) {
        logError('executeArbitrage', err);
        onLog(`{red-fg}❌ Erro: ${err.message}{/}`);
        return null;
    } finally {
        // 🔊 Restaura o console.log original
        console.log = originalLog;
    }
}

module.exports = { executeArbitrage };