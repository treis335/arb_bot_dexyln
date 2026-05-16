const { SupraClient } = require('supra-l1-sdk');

(async () => {
  try {
    const client = await SupraClient.init('https://rpc-mainnet.supra.com/rpc/v1');
    console.log('✅ Cliente inicializado');
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }
})();