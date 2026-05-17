const { CONFIG } = require('../../config/config');
const { logError } = require('../../utils/logError');
const callView = require('../../utils/callView');

const SPIKEY_ADDRESS = '0x3045d27b5fada1e30897a741fb184e48ef0bff3717aea23918ebc1e5c7153083';

const spikeyEngine = {
    getTokenAddress(tokenSymbol) {
        const tok = CONFIG.tokens[tokenSymbol];
        if (!tok) return null;
        return tok.type.split('::')[0];
    },

    async fetchPairState(tokenA, tokenB) {
        try {
            const addrA = this.getTokenAddress(tokenA);
            const addrB = this.getTokenAddress(tokenB);
            if (!addrA || !addrB) {
                console.log(`[Spikey] Endereço não encontrado para ${tokenA} ou ${tokenB}`);
                return null;
            }

            // Usa caminho completo: módulo::função
            const reserves = await callView(
                SPIKEY_ADDRESS,
                'amm_factory::get_reserves',
                [],
                [addrA, addrB]
            );

            if (!reserves || !Array.isArray(reserves) || reserves.length < 2) {
                console.log(`[Spikey] Par ${tokenA}/${tokenB} não encontrado ou sem reservas.`);
                return null;
            }

            const reserveA = BigInt(reserves[0]);
            const reserveB = BigInt(reserves[1]);

            let swapFee = 30;
            try {
                const feeResult = await callView(SPIKEY_ADDRESS, 'amm_controller::get_swap_fee', [], []);
                if (feeResult !== null && feeResult !== undefined) swapFee = Number(feeResult);
            } catch (_) {}

            const feeScale = 10000;
            const tokA = CONFIG.tokens[tokenA];
            const tokB = CONFIG.tokens[tokenB];

            const amountOut = this.getAmountOut(reserveA, reserveB, BigInt(tokA.decimals), swapFee, feeScale);
            const priceAinB = Number(amountOut) / tokB.decimals;

            console.log(`[Spikey] ${tokenA}/${tokenB}: reserveA=${reserveA}, reserveB=${reserveB}, price=${priceAinB}`);

            return {
                dex: 'SPIKEY',
                tokenA: tokenA,
                tokenB: tokenB,
                curve: 'constant_product',
                pairAddress: `${addrA}_${addrB}`,
                reserveA: Number(reserveA),
                reserveB: Number(reserveB),
                fee: swapFee,
                feeScale: feeScale,
                priceAinB: priceAinB,
                _simulate: (direction, amountIn) => this.simulateTrade(
                    { tokenA, tokenB, reserveA: Number(reserveA), reserveB: Number(reserveB), fee: swapFee, feeScale },
                    direction,
                    amountIn
                )
            };
        } catch (e) {
            logError(`fetchSpikeyPair ${tokenA}/${tokenB}`, e);
            console.log(`[Spikey] Erro: ${e.message}`);
            return null;
        }
    },

    getAmountOut(reserveIn, reserveOut, amountIn, fee, feeScale) {
        if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) return 0n;
        const feeMul = BigInt(feeScale - fee);
        const afterFee = (amountIn * feeMul) / BigInt(feeScale);
        if (afterFee <= 0n) return 0n;
        return (afterFee * reserveOut) / (reserveIn + afterFee);
    },

    simulateTrade(ps, direction, amountIn) {
        const tokA = CONFIG.tokens[ps.tokenA] || { decimals: 1e6 };
        const tokB = CONFIG.tokens[ps.tokenB] || { decimals: 1e6 };
        if (direction === 'AB') {
            const raw = this.getAmountOut(
                BigInt(ps.reserveA), BigInt(ps.reserveB),
                BigInt(Math.floor(amountIn * tokA.decimals)),
                ps.fee, ps.feeScale
            );
            return Number(raw) / tokB.decimals;
        } else {
            const raw = this.getAmountOut(
                BigInt(ps.reserveB), BigInt(ps.reserveA),
                BigInt(Math.floor(amountIn * tokB.decimals)),
                ps.fee, ps.feeScale
            );
            return Number(raw) / tokA.decimals;
        }
    }
};

module.exports = spikeyEngine;