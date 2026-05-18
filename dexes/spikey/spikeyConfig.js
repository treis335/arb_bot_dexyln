const fs = require('fs');
const path = require('path');

function loadSpikeyPools() {
    try {
        const filePath = path.join(__dirname, '..', '..', 'spikeyPools.json');
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

const SPIKEY_CONFIG = {
    routerAddress: '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083',
    moduleName: 'amm_router',
    pools: loadSpikeyPools(),
};

module.exports = { SPIKEY_CONFIG };