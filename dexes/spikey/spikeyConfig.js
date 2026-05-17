// dexes/spikey/spikeyConfig.js
// Pares disponíveis na Spikey DEX (AMM V2 clássica na Supra)
// O engine tentará carregar cada par — os que não existirem devolvem null (sem crash)

const SPIKEY_CONFIG = {
  routerAddress: '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083',
  moduleName: 'amm_router',
  pairs: [
    { tokenA: 'SUPRA',  tokenB: 'DEXUSDC' },
    { tokenA: 'SUPRA',  tokenB: 'LUCKY'   },
    { tokenA: 'SUPRA',  tokenB: 'DAWGZ'   },
    { tokenA: 'SUPRA',  tokenB: 'JOSH'    },
    { tokenA: 'SUPRA',  tokenB: 'SPIKE'   },
    { tokenA: 'SUPRA',  tokenB: 'DXLYN'   },
  ],
};

module.exports = { SPIKEY_CONFIG };