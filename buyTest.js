require('dotenv').config();
const { SupraClient, HexString, SupraAccount, BCS, TxnBuilderTypes } = require('supra-l1-sdk');

const RPC_URL = 'https://rpc-mainnet.supra.com';
const MODULE_ADDRESS = '0xdc694898dff98a1b0447e0992d0413e123ea80da1021d464a4fbaf0265870d8';
const SUPRA_TYPE = '0x1::supra_coin::SupraCoin';
const DEXUSDC_TYPE = '0x8f7d16ade319b0fce368ca6cdb98589c4527ce7f5b51e544a9e68e719934458b::hyper_coin::DexlynUSDC';
const CURVE_TYPE = '0xdc694898dff98a1b0447e0992d0413e123ea80da1021d464a4fbaf0265870d8::curves::Uncorrelated';

(async () => {
    console.log('🔧 Bot de Compra na Dexlyn\n');
    
    const senderAddress = process.env.SENDER_ADDRESS;
    const privateKeyHex = process.env.PRIVATE_KEY;
    
    if (!senderAddress || !privateKeyHex) {
        console.error('❌ Configura SENDER_ADDRESS e PRIVATE_KEY no .env');
        process.exit(1);
    }

    const client = await SupraClient.init(RPC_URL);
    const account = new SupraAccount(HexString.ensure(privateKeyHex).toUint8Array());

    console.log(`📍 Endereço: ${account.address()}`);

    const supraRaw = await client.getAccountSupraCoinBalance(new HexString(senderAddress));
    const supraBalance = Number(supraRaw) / 1e8;
    console.log(`   Saldo: ${supraBalance.toFixed(6)} SUPRA`);

    if (supraBalance < 0.5) {
        console.error('❌ Precisas de pelo menos 0.5 SUPRA para testar.');
        process.exit(1);
    }

    const amountIn = 0.5 * 1e8;
    const viewResult = await client.invokeViewMethod(
        `${MODULE_ADDRESS}::router::get_amount_out`,
        [SUPRA_TYPE, DEXUSDC_TYPE, CURVE_TYPE],
        [amountIn.toString()]
    );
    const expectedOut = BigInt(viewResult.result?.[0] ?? viewResult.result ?? viewResult);
    const minOut = expectedOut * 99n / 100n;
    console.log(`   Output esperado: ${(Number(expectedOut) / 1e6).toFixed(6)} dexUSDC`);
    console.log(`   Mínimo aceitável: ${(Number(minOut) / 1e6).toFixed(6)} dexUSDC`);

    console.log('\n🔨 Construindo transação...');
    
    const sequenceNumber = (await client.getAccountInfo(new HexString(senderAddress))).sequence_number;

    const functionArgs = [
        BCS.bcsSerializeUint64(BigInt(Math.floor(amountIn))),
        BCS.bcsSerializeUint64(minOut),
    ];
    
    const functionTypeArgs = [
        new TxnBuilderTypes.TypeTagParser(SUPRA_TYPE).parseTypeTag(),
        new TxnBuilderTypes.TypeTagParser(DEXUSDC_TYPE).parseTypeTag(),
        new TxnBuilderTypes.TypeTagParser(CURVE_TYPE).parseTypeTag(),
    ];

    const rawTx = await client.createRawTxObject(
        new HexString(senderAddress),
        BigInt(sequenceNumber),
        MODULE_ADDRESS,
        'scripts',
        'swap',
        functionTypeArgs,
        functionArgs,
        {
            maxGasAmount: BigInt(5000),
            gasUnitPrice: BigInt(100000),
            expirationTime: Math.floor(Date.now() / 1000) + 300
        }
    );

    // Serializar o rawTx antes de enviar (exatamente como no bot funcional)
    const serializer = new BCS.Serializer();
    rawTx.serialize(serializer);
    const serializedRawTx = serializer.getBytes();

    console.log('✍️  Assinando e submetendo...');
    const txResult = await client.sendTxUsingSerializedRawTransaction(
        account,
        serializedRawTx,
        { enableWaitForTransaction: true, enableTransactionSimulation: true }
    );

    console.log(`\n✅ Transação submetida: ${txResult.txHash}`);
    console.log(`   Explorer: https://suprascan.io/tx/${txResult.txHash}`);
})();