const CONFIG = {
  rpc: 'https://rpc-mainnet.supra.com',
  pollingMs: 2500,
  emaAlpha:    0.35,
  tickHistory: 12,
  minProfitPct: 0.10,
  optimalSearch: { min: 10, max: 10000, iterations: 30 },
  scoreWeights: { profit: 0.60, liquidity: 0.25, trend: 0.15 },
  arbLogMax: 8,
  viewTimeout:   15000,
  viewRetries:   2,
  maxConcurrent: 3,

  // ═══ Automação ═══
  autoExecute: {
    enabled: true,            // Inicia ligado – desliga com a tecla 'a'
    minProfitPct: 0.35,       // Lucro mínimo para auto-execução (%)
    minScore: 25,             // Score mínimo (0-100)
    gasReserveSUPRA: 0.09,    // Reserva de SUPRA para gas
    cooldownMs: 5000,         // Tempo mínimo entre execuções automáticas
    maxConsecutiveFails: 3,   // Pausa automático após N falhas seguidas
  },

  // ═══ Pools V3 (liquidez concentrada) ═══
  v3Pools: {
    moduleAddress: '0xc3a610069fa7545cf14e266e849954bf385aca957bb489b1dc069a4baa29b502',
    pools: [
      // SUPRA-dexUSDC V3 0.3% ($80k TVL)
      { address: '0x2d5d69aec278855e633baa332d2d32a486967fc40cd1ff59c4eaf3da66fbc917', tokenA: 'SUPRA', tokenB: 'DEXUSDC' },
      // SUPRA-DXLYN V3 0.3% ($20k TVL)
      { address: '0x1ff31a624ce0310e3067d695bbdba64c1f0821082e615bfce8d6a9eaca44f4', tokenA: 'SUPRA', tokenB: 'DXLYN' },
      // SUPRA-STC V3 0.01% ($292 TVL)
      { address: '0x186b999b60a3c88bc3e2b4c1c537519e046f5330a91f024839b2c39e6b391e78', tokenA: 'SUPRA', tokenB: 'STC' },
    ],
  },

  dexes: {
    DEXLYN: {
      moduleAddress: '0xdc694898dff98a1b0447e0992d0413e123ea80da1021d464a4fbaf0265870d8',
      curveTypes: {
        uncorrelated: 'curves::Uncorrelated',
        stable:       'curves::Stable',
      },
      pairs: [
        ['SUPRA',    'DEXUSDC',   'uncorrelated'],
        ['LUCKY',    'SUPRA',     'uncorrelated'],
        ['DAWGZ',    'SUPRA',     'uncorrelated'],
        ['ROBBIE',   'SUPRA',     'uncorrelated'],
        ['JOSH',     'SUPRA',     'uncorrelated'],
        ['SPIKE',    'SUPRA',     'uncorrelated'],
        ['LEO',      'SUPRA',     'uncorrelated'],
        ['MUMMY',    'SUPRA',     'uncorrelated'],
        ['MCB',      'SUPRA',     'uncorrelated'],
        ['PECKY',    'SUPRA',     'uncorrelated'],
        ['CASH',     'SUPRA',     'uncorrelated'],
        ['REPANDA',  'SUPRA',     'uncorrelated'],
        ['LOWCAPS',  'SUPRA',     'uncorrelated'],
        ['BABYJOSH', 'SUPRA',     'uncorrelated'],
        ['TSUPRA',   'SUPRA',     'uncorrelated'],
        ['WABBIT',   'SUPRA',     'uncorrelated'],
        ['NANA',     'SUPRA',     'uncorrelated'],
        ['LUCKY',    'DEXUSDC',   'uncorrelated'],
        ['DAWGZ',    'DEXUSDC',   'uncorrelated'],
        ['CASH',     'DEXUSDC',   'uncorrelated'],
        ['JOSH',     'DEXUSDC',   'uncorrelated'],
        ['OG',       'SUPRA',     'uncorrelated'],
        ['SBC',      'SUPRA',     'uncorrelated'],
        ['MUMMY',    'DEXUSDC',   'uncorrelated'],
        ['SUPDOG',   'SUPRA',     'uncorrelated'],
        ['PUMP',     'SUPRA',     'uncorrelated'],
        ['SHILLBILL','SUPRA',     'uncorrelated'],
        ['FLP',      'SUPRA',     'uncorrelated'],
        ['SUPD',     'SUPRA',     'uncorrelated'],
        ['PECKY',    'DEXUSDC',   'uncorrelated'],
        ['SPIKE',    'DEXUSDC',   'uncorrelated'],
        ['MCB',      'JOSH',      'uncorrelated'],
        ['LOWCAPS',  'DEXUSDC',   'uncorrelated'],
        ['DXLYN',    'DEXUSDC',   'uncorrelated'],
        ['DXLYN',    'SUPRA',     'uncorrelated'],
      ],
    },
  },

  tokens: {
    SUPRA:    { type: '0x1::supra_coin::SupraCoin',                                                                                                          decimals: 1e8, symbol: 'SUPRA'    },
    DEXUSDC:  { type: '0x8f7d16ade319b0fce368ca6cdb98589c4527ce7f5b51e544a9e68e719934458b::hyper_coin::DexlynUSDC',                                          decimals: 1e6, symbol: 'dexUSDC'  },
    LUCKY:    { type: '0x4205c82380bff5708cd7c59e0043a45890a457a6cdb60c9191d818958fd7ac26::LUCKY::LUCKY',                                                     decimals: 1e6, symbol: 'LUCKY'    },
    DAWGZ:    { type: '0xb8e94e7204d8eeb565a653d262ae6f7434a3a452e2aaf624810b33dfa3b64d09::DAWGZ::DAWGZ',                                                     decimals: 1e6, symbol: 'DAWGZ'    },
    ROBBIE:   { type: '0x635f53147391781c93bf3e1c68dcea5e2f7234ec371b0f241d150465606a9007::ROBBIE::ROBBIE',                                                   decimals: 1e6, symbol: 'ROBBIE'   },
    JOSH:     { type: '0x4742d10cab62d51473bb9b4752046705d40f056abcaa59bcb266078c5945b864::JOSH::JOSH',                                                      decimals: 1e6, symbol: 'JOSH'     },
    SPIKE:    { type: '0x0fec116479f1fd3cb9732cc768e6061b0e45b178a610b9bc23c2143a6493e794::memecoins::SPIKE',                                                decimals: 1e3, symbol: 'SPIKE'    },
    LEO:      { type: '0x83e6ebf0e08121734b117daf65677c77185e151114364f7c53bc2366f2c64a12::LEO::LEO',                                                        decimals: 1e6, symbol: 'LEO'      },
    MUMMY:    { type: '0x729982d3ad6130276c6972880810b7ddabe6d7fb59b5029fa5bed5674ae75a70::MUMMY::MUMMY',                                                     decimals: 1e6, symbol: 'MUMMY'    },
    MCB:      { type: '0xae282bd0c040c959be1ed067b525fadb38b02a4cfe6fbb27abd9a7e737aaa471::memecoinburners::MCB',                                             decimals: 1e6, symbol: 'MCB'      },
    PECKY:    { type: '0xe54b95920ef1cf9483705a32eab8526f270bc2f936dfb4112fd6ef971509d85d::Coin::Pecky',                                                     decimals: 1e6, symbol: 'PECKY'    },
    CASH:     { type: '0x9176f70f125199a3e3d5549ce795a8e906eed75901d535ded623802f15ae3637::cdp_multi::CASH',                                                 decimals: 1e8, symbol: 'CASH'     },
    REPANDA:  { type: '0x901922a0e51b3397eb605be57653bf06c532adc617958dbf142783f6bdb1f535::RPD::RPD',                                                        decimals: 1e6, symbol: 'REPANDA'  },
    LOWCAPS:  { type: '0x35e70dea5a275dda4bdba9c5903d489891a10712dfbfa2bf04cc009f77026b94::lowCapGems::LOWCAPS',                                             decimals: 1e6, symbol: 'LOWCAPS'  },
    BABYJOSH: { type: '0x4742d10cab62d51473bb9b4752046705d40f056abcaa59bcb266078c5945b864::BABYJOSH::BABYJOSH',                                               decimals: 1e6, symbol: 'BABYJOSH' },
    TSUPRA:   { type: '0x32008172b80cf1d9ed5804eddac608f0c25ac211d90e7aeff44c1993bcf0b863::TSUPRA::TSUPRA',                                                   decimals: 1e6, symbol: 'tSUPRA'   },
    WABBIT:   { type: '0x1cb8ecc17fd3415505c248567290c083b36e595d067d2122643128e81ae46d43::WABBIT::WABBIT',                                                   decimals: 1e6, symbol: 'WABBIT'   },
    NANA:     { type: '0x6253eb8c732079a4eba6fe8a194461b5051d087ad9d35ddf4a8c087e8f7a1d4e::NANA::NANA',                                                      decimals: 1e6, symbol: 'NANA'     },
    DXLYN:    { type: '0x8f7d16ade319b0fce368ca6cdb98589c4527ce7f5b51e544a9e68e719934458b::hyper_coin::DXLYN',                                               decimals: 1e6, symbol: 'DXLYN'    },
    OG:       { type: '0xd0f37da5c7a0104d8cb161e1ac1e101f90b702c18081b76b62f20137bf40fd0b::OG::OG',                                                          decimals: 1e6, symbol: 'OG'       },
    SBC:      { type: '0xe75d56b0c61d3d82bfaff803af2aacbbf42618c1ec2226ad10ba81e408f1ac8b::SBC::SBC',                                                        decimals: 1e6, symbol: 'SBC'      },
    SUPDOG:   { type: '0x2f2514cbada3f20f092cbf6aa19ccba08c952002c1d05692154286d55682cdd1::SUPDOG::SUPDOG',                                                   decimals: 1e6, symbol: 'SUPDOG'   },
    SHILLBILL:{ type: '0x030e804570703471b2d1c347250989d31ece73e695f2efff1d19f0daab99e1ca::SHILLBILL::SHILLBILL',                                             decimals: 1e6, symbol: 'SHILLBIL' },
    PUMP:     { type: '0xc2896ec7a6ad3ac8a50626db9b832a142647ff065af6b30a089f64627c0c4a2b::pump_coin::PUMP',                                                  decimals: 1e6, symbol: 'PUMP'     },
    FLP:      { type: '0x159790ba3f3ca3b038d9234498ea14390ddcbab13ec96ca17c7396f77da8bf82::FLP::FLP',                                                        decimals: 1e6, symbol: 'FLP'      },
    SUPD:     { type: '0x16aae30a40726dec7737b738ff8c586623d52f861c0ed997994b0498b9a7cacd::SUPD::SUPD',                                                      decimals: 1e6, symbol: 'SUPD'     },
    // 🆕 Novo token STC (SHITCOIN)
    STC:      { type: '0xaccc77c23159a80af1fff5aaee9c29d07915836b26a1fd8c0e1bed149f24cabc::stc::STC',                                                         decimals: 1e6, symbol: 'STC'      },
  },
};

module.exports = { CONFIG };