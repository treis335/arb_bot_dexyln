const { SupraClient } = require('supra-l1-sdk');

(async () => {
  try {
    const client = await SupraClient.init('https://rpc-mainnet.supra.com');
    console.log('✅ Cliente inicializado');
    
    // O SDK pode ter métodos diferentes. Vamos listar os disponíveis:
    console.log('Métodos disponíveis:', Object.keys(client).filter(k => typeof client[k] === 'function'));
    
    // Tentar método alternativo para conta
    const account = await client.getAccount(process.env.SENDER_ADDRESS);
    console.log('✅ Conta:', JSON.stringify(account));
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }
})();