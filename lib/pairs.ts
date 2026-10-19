// Curated market list for Quasar demo. `kraken` uses Kraken's alt pair names
// (XBT for BTC). `tv` is the TradingView symbol suffix on KRAKEN.

export type PairInfo = {
  symbol: string; // display base, e.g. BTC
  name: string; // full name
  kraken: string; // Kraken alt pair, e.g. XBTUSD
  tv: string; // TradingView symbol base, e.g. BTC
  decimals: number; // price display precision
  native?: boolean; // true for Quasar's own demo token (simulated price, no Kraken data)
};

// ---------------------------------------------------------------------------
// QSR — Quasar's native coin (DEMO listing).
// Quasar Core is Quasar's own independent blockchain (educational P2P network). QSR is the best coin.
// No Solana mint. No real market value — exchange price is simulated.
// ---------------------------------------------------------------------------
/** Quasar Core network — independent chain, no Solana mint. */
export const QSR_MINT_ADDRESS = 'QUASAR-CORE (no Solana mint)';
/** QSR total supply (500B), per the Quasar-coin prototype. */
export const QSR_TOTAL_SUPPLY = 500_000_000_000;
/** Simulated demo starting price for QSR/USD. */
export const QSR_START_PRICE_USD = 0.0001;

/** Deterministic 0..1 hash of an integer — keeps the demo price stable across server instances. */
function hash01(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967295;
}

/**
 * Simulated DEMO price for QSR/USD — a gentle deterministic random walk around
 * $0.0001. NOT a market price: QSR is not listed anywhere yet. Deterministic in
 * `at` so every API route/server instance agrees on the price.
 */
export function qsrSimPrice(at: number = Date.now()): number {
  const t = at / 1000;
  const wave = Math.sin(t / 900) * 0.04 + Math.sin(t / 97) * 0.015;
  const bucket = Math.floor(t / 30);
  const noise = (hash01(bucket) - 0.5) * 0.03;
  const p = QSR_START_PRICE_USD * (1 + wave + noise);
  return Math.min(0.0005, Math.max(0.00005, p));
}

/** Synthetic demo order book for QSR (no real order book exists yet). */
export function qsrSimBook(price: number): { asks: { price: number; vol: number }[]; bids: { price: number; vol: number }[] } {
  const asks: { price: number; vol: number }[] = [];
  const bids: { price: number; vol: number }[] = [];
  for (let i = 1; i <= 20; i++) {
    const step = price * 0.001 * i;
    asks.push({ price: price + step, vol: 50000 + hash01(i * 7) * 200000 });
    bids.push({ price: price - step, vol: 50000 + hash01(i * 13) * 200000 });
  }
  return { asks, bids };
}

/** Synthetic 24h sparkline for QSR (demo only). */
export function qsrSimSpark(at: number = Date.now()): number[] {
  const out: number[] = [];
  for (let i = 23; i >= 0; i--) out.push(qsrSimPrice(at - i * 3600_000));
  return out;
}

export const PAIRS: PairInfo[] = [
  { symbol: 'QSR', name: 'Quasar Coin (Native)', kraken: 'QSRUSD', tv: 'QSR', decimals: 6, native: true },
  { symbol: 'ETH', name: 'Ethereum', kraken: 'ETHUSD', tv: 'ETH', decimals: 2 },
  { symbol: 'SOL', name: 'Solana', kraken: 'SOLUSD', tv: 'SOL', decimals: 2 },
  { symbol: 'XRP', name: 'XRP', kraken: 'XRPUSD', tv: 'XRP', decimals: 4 },
  { symbol: 'DOGE', name: 'Dogecoin', kraken: 'DOGEUSD', tv: 'DOGE', decimals: 5 },
  { symbol: 'ADA', name: 'Cardano', kraken: 'ADAUSD', tv: 'ADA', decimals: 4 },
  { symbol: 'AVAX', name: 'Avalanche', kraken: 'AVAXUSD', tv: 'AVAX', decimals: 2 },
  { symbol: 'LINK', name: 'Chainlink', kraken: 'LINKUSD', tv: 'LINK', decimals: 2 },
  { symbol: 'DOT', name: 'Polkadot', kraken: 'DOTUSD', tv: 'DOT', decimals: 3 },
  { symbol: 'LTC', name: 'Litecoin', kraken: 'LTCUSD', tv: 'LTC', decimals: 2 },
  { symbol: 'ATOM', name: 'Cosmos', kraken: 'ATOMUSD', tv: 'ATOM', decimals: 3 },
  { symbol: 'NEAR', name: 'Near Protocol', kraken: 'NEARUSD', tv: 'NEAR', decimals: 3 },
  { symbol: 'ARB', name: 'Arbitrum', kraken: 'ARBUSD', tv: 'ARB', decimals: 4 },
  { symbol: 'OP', name: 'Optimism', kraken: 'OPUSD', tv: 'OP', decimals: 4 },
  { symbol: 'INJ', name: 'Injective', kraken: 'INJUSD', tv: 'INJ', decimals: 2 },
  { symbol: 'SUI', name: 'Sui', kraken: 'SUIUSD', tv: 'SUI', decimals: 4 },
  { symbol: 'APT', name: 'Aptos', kraken: 'APTUSD', tv: 'APT', decimals: 3 },
  { symbol: 'POL', name: 'Polygon', kraken: 'POLUSD', tv: 'POL', decimals: 4 },
  { symbol: 'AAVE', name: 'Aave', kraken: 'AAVEUSD', tv: 'AAVE', decimals: 2 },
  { symbol: 'UNI', name: 'Uniswap', kraken: 'UNIUSD', tv: 'UNI', decimals: 3 },
  // ---- Expanded to top 100 (verified USD spot pairs on Kraken) ----
  { symbol: 'TAO', name: 'Bittensor', kraken: 'TAOUSD', tv: 'TAO', decimals: 1 },
  { symbol: 'YFI', name: 'yearn.finance', kraken: 'YFIUSD', tv: 'YFI', decimals: 1 },
  { symbol: 'ETC', name: 'Ethereum Classic', kraken: 'ETCUSD', tv: 'ETC', decimals: 2 },
  { symbol: 'ZEC', name: 'Zcash', kraken: 'ZECUSD', tv: 'ZEC', decimals: 2 },
  { symbol: 'DASH', name: 'Dash', kraken: 'DASHUSD', tv: 'DASH', decimals: 2 },
  { symbol: 'KSM', name: 'Kusama', kraken: 'KSMUSD', tv: 'KSM', decimals: 2 },
  { symbol: 'COMP', name: 'Compound', kraken: 'COMPUSD', tv: 'COMP', decimals: 2 },
  { symbol: 'NMR', name: 'Numeraire', kraken: 'NMRUSD', tv: 'NMR', decimals: 2 },
  { symbol: 'RENDER', name: 'Render', kraken: 'RENDERUSD', tv: 'RENDER', decimals: 2 },
  { symbol: 'PENDLE', name: 'Pendle', kraken: 'PENDLEUSD', tv: 'PENDLE', decimals: 2 },
  { symbol: 'RPL', name: 'Rocket Pool', kraken: 'RPLUSD', tv: 'RPL', decimals: 2 },
  { symbol: 'FIL', name: 'Filecoin', kraken: 'FILUSD', tv: 'FIL', decimals: 3 },
  { symbol: 'SNX', name: 'Synthetix', kraken: 'SNXUSD', tv: 'SNX', decimals: 3 },
  { symbol: 'AXS', name: 'Axie Infinity', kraken: 'AXSUSD', tv: 'AXS', decimals: 3 },
  { symbol: 'XTZ', name: 'Tezos', kraken: 'XTZUSD', tv: 'XTZ', decimals: 3 },
  { symbol: 'WIF', name: 'dogwifhat', kraken: 'WIFUSD', tv: 'WIF', decimals: 3 },
  { symbol: 'LDO', name: 'Lido DAO', kraken: 'LDOUSD', tv: 'LDO', decimals: 3 },
  { symbol: 'CRV', name: 'Curve DAO', kraken: 'CRVUSD', tv: 'CRV', decimals: 3 },
  { symbol: 'SUSHI', name: 'SushiSwap', kraken: 'SUSHIUSD', tv: 'SUSHI', decimals: 3 },
  { symbol: 'ZRX', name: '0x', kraken: 'ZRXUSD', tv: 'ZRX', decimals: 3 },
  { symbol: 'OMG', name: 'OMG Network', kraken: 'OMGUSD', tv: 'OMG', decimals: 3 },
  { symbol: 'BAL', name: 'Balancer', kraken: 'BALUSD', tv: 'BAL', decimals: 3 },
  { symbol: 'KNC', name: 'Kyber Network', kraken: 'KNCUSD', tv: 'KNC', decimals: 3 },
  { symbol: 'BAND', name: 'Band Protocol', kraken: 'BANDUSD', tv: 'BAND', decimals: 3 },
  { symbol: 'STORJ', name: 'Storj', kraken: 'STORJUSD', tv: 'STORJ', decimals: 3 },
  { symbol: 'OCEAN', name: 'Ocean Protocol', kraken: 'OCEANUSD', tv: 'OCEAN', decimals: 3 },
  { symbol: 'FET', name: 'Fetch.ai', kraken: 'FETUSD', tv: 'FET', decimals: 3 },
  { symbol: 'UMA', name: 'UMA', kraken: 'UMAUSD', tv: 'UMA', decimals: 3 },
  { symbol: 'API3', name: 'API3', kraken: 'API3USD', tv: 'API3', decimals: 3 },
  { symbol: 'FLOW', name: 'Flow', kraken: 'FLOWUSD', tv: 'FLOW', decimals: 3 },
  { symbol: 'KAVA', name: 'Kava', kraken: 'KAVAUSD', tv: 'KAVA', decimals: 3 },
  { symbol: 'MINA', name: 'Mina Protocol', kraken: 'MINAUSD', tv: 'MINA', decimals: 3 },
  { symbol: 'QTUM', name: 'Qtum', kraken: 'QTUMUSD', tv: 'QTUM', decimals: 3 },
  { symbol: 'TIA', name: 'Celestia', kraken: 'TIAUSD', tv: 'TIA', decimals: 3 },
  { symbol: 'AKT', name: 'Akash Network', kraken: 'AKTUSD', tv: 'AKT', decimals: 3 },
  { symbol: 'ENA', name: 'Ethena', kraken: 'ENAUSD', tv: 'ENA', decimals: 3 },
  { symbol: 'ONDO', name: 'Ondo Finance', kraken: 'ONDOUSD', tv: 'ONDO', decimals: 3 },
  { symbol: 'TON', name: 'Toncoin', kraken: 'TONUSD', tv: 'TON', decimals: 3 },
  { symbol: 'ARKM', name: 'Arkham', kraken: 'ARKMUSD', tv: 'ARKM', decimals: 3 },
  { symbol: 'AERO', name: 'Aerodrome Finance', kraken: 'AEROUSD', tv: 'AERO', decimals: 3 },
  { symbol: 'RAY', name: 'Raydium', kraken: 'RAYUSD', tv: 'RAY', decimals: 3 },
  { symbol: 'ORCA', name: 'Orca', kraken: 'ORCAUSD', tv: 'ORCA', decimals: 3 },
  { symbol: 'JTO', name: 'Jito', kraken: 'JTOUSD', tv: 'JTO', decimals: 3 },
  { symbol: 'ETHFI', name: 'Ether.fi', kraken: 'ETHFIUSD', tv: 'ETHFI', decimals: 3 },
  { symbol: 'EIGEN', name: 'EigenLayer', kraken: 'EIGENUSD', tv: 'EIGEN', decimals: 3 },
  { symbol: 'XLM', name: 'Stellar', kraken: 'XLMUSD', tv: 'XLM', decimals: 4 },
  { symbol: 'TRX', name: 'TRON', kraken: 'TRXUSD', tv: 'TRX', decimals: 4 },
  { symbol: 'HBAR', name: 'Hedera', kraken: 'HBARUSD', tv: 'HBAR', decimals: 4 },
  { symbol: 'ALGO', name: 'Algorand', kraken: 'ALGOUSD', tv: 'ALGO', decimals: 4 },
  { symbol: 'SAND', name: 'The Sandbox', kraken: 'SANDUSD', tv: 'SAND', decimals: 4 },
  { symbol: 'MANA', name: 'Decentraland', kraken: 'MANAUSD', tv: 'MANA', decimals: 4 },
  { symbol: 'CHZ', name: 'Chiliz', kraken: 'CHZUSD', tv: 'CHZ', decimals: 4 },
  { symbol: 'ENJ', name: 'Enjin Coin', kraken: 'ENJUSD', tv: 'ENJ', decimals: 4 },
  { symbol: 'BAT', name: 'Basic Attention Token', kraken: 'BATUSD', tv: 'BAT', decimals: 4 },
  { symbol: 'GRT', name: 'The Graph', kraken: 'GRTUSD', tv: 'GRT', decimals: 4 },
  { symbol: 'LRC', name: 'Loopring', kraken: 'LRCUSD', tv: 'LRC', decimals: 4 },
  { symbol: 'BLUR', name: 'Blur', kraken: 'BLURUSD', tv: 'BLUR', decimals: 4 },
  { symbol: 'PYTH', name: 'Pyth Network', kraken: 'PYTHUSD', tv: 'PYTH', decimals: 4 },
  { symbol: 'STRK', name: 'Starknet', kraken: 'STRKUSD', tv: 'STRK', decimals: 4 },
  { symbol: 'POPCAT', name: 'Popcat', kraken: 'POPCATUSD', tv: 'POPCAT', decimals: 4 },
  { symbol: 'ANKR', name: 'Ankr', kraken: 'ANKRUSD', tv: 'ANKR', decimals: 4 },
  { symbol: 'SEI', name: 'Sei', kraken: 'SEIUSD', tv: 'SEI', decimals: 4 },
  { symbol: 'USDT', name: 'Tether', kraken: 'USDTUSD', tv: 'USDT', decimals: 4 },
  { symbol: 'USDC', name: 'USD Coin', kraken: 'USDCUSD', tv: 'USDC', decimals: 4 },
  { symbol: 'DAI', name: 'Dai', kraken: 'DAIUSD', tv: 'DAI', decimals: 4 },
  { symbol: '1INCH', name: '1inch', kraken: '1INCHUSD', tv: '1INCH', decimals: 4 },
  { symbol: 'JUP', name: 'Jupiter', kraken: 'JUPUSD', tv: 'JUP', decimals: 3 },
  { symbol: 'IMX', name: 'Immutable X', kraken: 'IMXUSD', tv: 'IMX', decimals: 3 },
  { symbol: 'APE', name: 'ApeCoin', kraken: 'APEUSD', tv: 'APE', decimals: 3 },
  { symbol: 'VET', name: 'VeChain', kraken: 'VETUSD', tv: 'VET', decimals: 5 },
  { symbol: 'JASMY', name: 'JasmyCoin', kraken: 'JASMYUSD', tv: 'JASMY', decimals: 5 },
  { symbol: 'GALA', name: 'Gala', kraken: 'GALAUSD', tv: 'GALA', decimals: 5 },
  { symbol: 'SC', name: 'Siacoin', kraken: 'SCUSD', tv: 'SC', decimals: 5 },
  { symbol: 'MEW', name: 'cat in a dogs world', kraken: 'MEWUSD', tv: 'MEW', decimals: 5 },
  { symbol: 'NOT', name: 'Notcoin', kraken: 'NOTUSD', tv: 'NOT', decimals: 5 },
  { symbol: 'BONK', name: 'Bonk', kraken: 'BONKUSD', tv: 'BONK', decimals: 6 },
  { symbol: 'FLOKI', name: 'FLOKI', kraken: 'FLOKIUSD', tv: 'FLOKI', decimals: 6 },
  { symbol: 'PEPE', name: 'Pepe', kraken: 'PEPEUSD', tv: 'PEPE', decimals: 7 },
  { symbol: 'SHIB', name: 'Shiba Inu', kraken: 'SHIBUSD', tv: 'SHIB', decimals: 7 },
  // ---------------- v5: expanded — top Kraken USD pairs by 24h volume ----------------
  { symbol: 'QNT', name: 'QNT', kraken: 'QNTUSD', tv: 'QNT', decimals: 2 },
  { symbol: 'HYPE', name: 'HYPE', kraken: 'HYPEUSD', tv: 'HYPE', decimals: 3 },
  { symbol: 'PUMP', name: 'PUMP', kraken: 'PUMPUSD', tv: 'PUMP', decimals: 6 },
  { symbol: 'WLD', name: 'WLD', kraken: 'WLDUSD', tv: 'WLD', decimals: 5 },
  { symbol: 'ICP', name: 'ICP', kraken: 'ICPUSD', tv: 'ICP', decimals: 3 },
  { symbol: 'S', name: 'S', kraken: 'SUSD', tv: 'S', decimals: 5 },
  { symbol: 'ZEUS', name: 'ZEUS', kraken: 'ZEUSUSD', tv: 'ZEUS', decimals: 5 },
  { symbol: 'XMR', name: 'XMR', kraken: 'XXMRZUSD', tv: 'XMR', decimals: 2 },
  { symbol: 'ZRO', name: 'ZRO', kraken: 'ZROUSD', tv: 'ZRO', decimals: 3 },
  { symbol: 'NIGHT', name: 'NIGHT', kraken: 'NIGHTUSD', tv: 'NIGHT', decimals: 5 },
  { symbol: 'USELESS', name: 'USELESS', kraken: 'USELESSUSD', tv: 'USELESS', decimals: 5 },
  { symbol: 'GNOT', name: 'GNOT', kraken: 'GNOTUSD', tv: 'GNOT', decimals: 5 },
  { symbol: 'VVV', name: 'VVV', kraken: 'VVVUSD', tv: 'VVV', decimals: 3 },
  { symbol: 'CC', name: 'CC', kraken: 'CCUSD', tv: 'CC', decimals: 5 },
  { symbol: 'GRASS', name: 'GRASS', kraken: 'GRASSUSD', tv: 'GRASS', decimals: 5 },
  { symbol: 'W', name: 'W', kraken: 'WUSD', tv: 'W', decimals: 5 },
  { symbol: 'US', name: 'US', kraken: 'USUSD', tv: 'US', decimals: 5 },
  { symbol: 'PENGU', name: 'PENGU', kraken: 'PENGUUSD', tv: 'PENGU', decimals: 6 },
  { symbol: 'CHIP', name: 'CHIP', kraken: 'CHIPUSD', tv: 'CHIP', decimals: 5 },
  { symbol: 'DRV', name: 'DRV', kraken: 'DRVUSD', tv: 'DRV', decimals: 5 },
  { symbol: 'FARTCOIN', name: 'FARTCOIN', kraken: 'FARTCOINUSD', tv: 'FARTCOIN', decimals: 5 },
  { symbol: 'KAS', name: 'KAS', kraken: 'KASUSD', tv: 'KAS', decimals: 5 },
  { symbol: 'PAXG', name: 'PAXG', kraken: 'PAXGUSD', tv: 'PAXG', decimals: 2 },
  { symbol: 'XCN', name: 'XCN', kraken: 'XCNUSD', tv: 'XCN', decimals: 6 },
  { symbol: 'PLUME', name: 'PLUME', kraken: 'PLUMEUSD', tv: 'PLUME', decimals: 5 },
  { symbol: 'BNB', name: 'BNB', kraken: 'BNBUSD', tv: 'BNB', decimals: 2 },
  { symbol: 'USDG', name: 'USDG', kraken: 'USDGUSD', tv: 'USDG', decimals: 3 },
  { symbol: 'NIL', name: 'NIL', kraken: 'NILUSD', tv: 'NIL', decimals: 5 },
  { symbol: 'AUD', name: 'AUD', kraken: 'AUDUSD', tv: 'AUD', decimals: 5 },
  { symbol: 'VIRTUAL', name: 'VIRTUAL', kraken: 'VIRTUALUSD', tv: 'VIRTUAL', decimals: 5 },
  { symbol: 'MEGA', name: 'MEGA', kraken: 'MEGAUSD', tv: 'MEGA', decimals: 5 },
  { symbol: 'LIGHTER', name: 'LIGHTER', kraken: 'LIGHTERUSD', tv: 'LIGHTER', decimals: 3 },
  { symbol: 'SYRUP', name: 'SYRUP', kraken: 'SYRUPUSD', tv: 'SYRUP', decimals: 5 },
  { symbol: 'EURC', name: 'EURC', kraken: 'EURCUSD', tv: 'EURC', decimals: 3 },
  { symbol: 'APR', name: 'APR', kraken: 'APRUSD', tv: 'APR', decimals: 5 },
  { symbol: 'STX', name: 'STX', kraken: 'STXUSD', tv: 'STX', decimals: 5 },
  { symbol: 'MON', name: 'MON', kraken: 'MONUSD', tv: 'MON', decimals: 5 },
  { symbol: 'XDP', name: 'XDP', kraken: 'XDPUSD', tv: 'XDP', decimals: 5 },
  { symbol: 'SKY', name: 'SKY', kraken: 'SKYUSD', tv: 'SKY', decimals: 5 },
  { symbol: 'SPX', name: 'SPX', kraken: 'SPXUSD', tv: 'SPX', decimals: 5 },
  { symbol: 'RLC', name: 'RLC', kraken: 'RLCUSD', tv: 'RLC', decimals: 3 },
  { symbol: 'XDC', name: 'XDC', kraken: 'XDCUSD', tv: 'XDC', decimals: 5 },
  { symbol: 'CAP', name: 'CAP', kraken: 'CAPUSD', tv: 'CAP', decimals: 5 },
  { symbol: 'MORPHO', name: 'MORPHO', kraken: 'MORPHOUSD', tv: 'MORPHO', decimals: 3 },
  { symbol: 'SHX', name: 'SHX', kraken: 'SHXUSD', tv: 'SHX', decimals: 6 },
  { symbol: 'SENT', name: 'SENT', kraken: 'SENTUSD', tv: 'SENT', decimals: 5 },
  { symbol: 'ZK', name: 'ZK', kraken: 'ZKUSD', tv: 'ZK', decimals: 5 },
  { symbol: 'CFX', name: 'CFX', kraken: 'CFXUSD', tv: 'CFX', decimals: 5 },
  { symbol: 'XAUT', name: 'XAUT', kraken: 'XAUTUSD', tv: 'XAUT', decimals: 2 },
  { symbol: 'XPL', name: 'XPL', kraken: 'XPLUSD', tv: 'XPL', decimals: 5 },
  { symbol: 'ASTER', name: 'ASTER', kraken: 'ASTERUSD', tv: 'ASTER', decimals: 5 },
  { symbol: 'TRUMP', name: 'TRUMP', kraken: 'TRUMPUSD', tv: 'TRUMP', decimals: 3 },
  { symbol: 'KNTQ', name: 'KNTQ', kraken: 'KNTQUSD', tv: 'KNTQ', decimals: 5 },
  { symbol: 'ELIZAOS', name: 'ELIZAOS', kraken: 'ELIZAOSUSD', tv: 'ELIZAOS', decimals: 6 },
  { symbol: 'LUNA', name: 'LUNA', kraken: 'LUNAUSD', tv: 'LUNA', decimals: 6 },
  { symbol: 'AKE', name: 'AKE', kraken: 'AKEUSD', tv: 'AKE', decimals: 5 },
  { symbol: 'ZBCN', name: 'ZBCN', kraken: 'ZBCNUSD', tv: 'ZBCN', decimals: 6 },
  { symbol: 'DCR', name: 'DCR', kraken: 'DCRUSD', tv: 'DCR', decimals: 3 },
  { symbol: 'PHA', name: 'PHA', kraken: 'PHAUSD', tv: 'PHA', decimals: 5 },
  { symbol: 'RARI', name: 'RARI', kraken: 'RARIUSD', tv: 'RARI', decimals: 5 },
  { symbol: 'AIOZ', name: 'AIOZ', kraken: 'AIOZUSD', tv: 'AIOZ', decimals: 5 },
  { symbol: 'PNT', name: 'PNT', kraken: 'PNTUSD', tv: 'PNT', decimals: 5 },
  { symbol: 'DOS', name: 'DOS', kraken: 'DOSUSD', tv: 'DOS', decimals: 5 },
  { symbol: 'KTA', name: 'KTA', kraken: 'KTAUSD', tv: 'KTA', decimals: 5 },
  { symbol: 'SYN', name: 'SYN', kraken: 'SYNUSD', tv: 'SYN', decimals: 5 },
  { symbol: 'CAKE', name: 'CAKE', kraken: 'CAKEUSD', tv: 'CAKE', decimals: 3 },
  { symbol: 'DYM', name: 'DYM', kraken: 'DYMUSD', tv: 'DYM', decimals: 5 },
  { symbol: 'WAL', name: 'WAL', kraken: 'WALUSD', tv: 'WAL', decimals: 5 },
  { symbol: 'CPOOL', name: 'CPOOL', kraken: 'CPOOLUSD', tv: 'CPOOL', decimals: 5 },
  { symbol: 'TRAC', name: 'TRAC', kraken: 'TRACUSD', tv: 'TRAC', decimals: 5 },
  { symbol: 'FLR', name: 'FLR', kraken: 'FLRUSD', tv: 'FLR', decimals: 6 },
  { symbol: 'CFG', name: 'CFG', kraken: 'CFGUSD', tv: 'CFG', decimals: 5 },
  { symbol: 'OOB', name: 'OOB', kraken: 'OOBUSD', tv: 'OOB', decimals: 6 },
  { symbol: 'VELO', name: 'VELO', kraken: 'VELOUSD', tv: 'VELO', decimals: 6 },
  { symbol: 'TREAD', name: 'TREAD', kraken: 'TREADUSD', tv: 'TREAD', decimals: 3 },
  { symbol: 'ZAMA', name: 'ZAMA', kraken: 'ZAMAUSD', tv: 'ZAMA', decimals: 5 },
  { symbol: 'ICNT', name: 'ICNT', kraken: 'ICNTUSD', tv: 'ICNT', decimals: 5 },
  { symbol: 'CT', name: 'CT', kraken: 'CTUSD', tv: 'CT', decimals: 5 },
  { symbol: 'MOODENG', name: 'MOODENG', kraken: 'MOODENGUSD', tv: 'MOODENG', decimals: 5 },
  { symbol: 'AZTEC', name: 'AZTEC', kraken: 'AZTECUSD', tv: 'AZTEC', decimals: 5 },
  { symbol: 'ACT', name: 'ACT', kraken: 'ACTUSD', tv: 'ACT', decimals: 5 },
  { symbol: 'NPC', name: 'NPC', kraken: 'NPCUSD', tv: 'NPC', decimals: 5 },
  { symbol: 'BILL', name: 'BILL', kraken: 'BILLUSD', tv: 'BILL', decimals: 6 },
  { symbol: 'ENS', name: 'ENS', kraken: 'ENSUSD', tv: 'ENS', decimals: 3 },
  { symbol: 'PEAQ', name: 'PEAQ', kraken: 'PEAQUSD', tv: 'PEAQ', decimals: 5 },
  { symbol: 'DOG', name: 'DOG', kraken: 'DOGUSD', tv: 'DOG', decimals: 6 },
  { symbol: 'BABY', name: 'BABY', kraken: 'BABYUSD', tv: 'BABY', decimals: 5 },
  { symbol: 'ZRC', name: 'ZRC', kraken: 'ZRCUSD', tv: 'ZRC', decimals: 6 },
  { symbol: 'MET', name: 'MET', kraken: 'METUSD', tv: 'MET', decimals: 5 },
  { symbol: 'PONS', name: 'PONS', kraken: 'PONSUSD', tv: 'PONS', decimals: 5 },
  { symbol: 'WLFI', name: 'WLFI', kraken: 'WLFIUSD', tv: 'WLFI', decimals: 5 },
  { symbol: 'A', name: 'A', kraken: 'AUSD', tv: 'A', decimals: 5 },
  { symbol: 'HNT', name: 'HNT', kraken: 'HNTUSD', tv: 'HNT', decimals: 5 },
  { symbol: 'ACH', name: 'ACH', kraken: 'ACHUSD', tv: 'ACH', decimals: 6 },
  { symbol: 'METIS', name: 'METIS', kraken: 'METISUSD', tv: 'METIS', decimals: 3 },
  { symbol: 'MUBARAK', name: 'MUBARAK', kraken: 'MUBARAKUSD', tv: 'MUBARAK', decimals: 5 },
  { symbol: 'BLUE', name: 'BLUE', kraken: 'BLUEUSD', tv: 'BLUE', decimals: 5 },
  { symbol: 'SN75', name: 'SN75', kraken: 'SN75USD', tv: 'SN75', decimals: 3 },
  { symbol: 'CVX', name: 'CVX', kraken: 'CVXUSD', tv: 'CVX', decimals: 3 },
  { symbol: 'MOVR', name: 'MOVR', kraken: 'MOVRUSD', tv: 'MOVR', decimals: 3 },
  { symbol: 'TEL', name: 'TEL', kraken: 'TELUSD', tv: 'TEL', decimals: 6 },
  { symbol: 'Q', name: 'Q', kraken: 'QUSD', tv: 'Q', decimals: 5 },
  { symbol: 'ATH', name: 'ATH', kraken: 'ATHUSD', tv: 'ATH', decimals: 6 },
  { symbol: 'BEAM', name: 'BEAM', kraken: 'BEAMUSD', tv: 'BEAM', decimals: 6 },
  { symbol: 'AVNT', name: 'AVNT', kraken: 'AVNTUSD', tv: 'AVNT', decimals: 5 },
  { symbol: 'NOS', name: 'NOS', kraken: 'NOSUSD', tv: 'NOS', decimals: 5 },
  { symbol: 'FOLD', name: 'FOLD', kraken: 'FOLDUSD', tv: 'FOLD', decimals: 5 },
  { symbol: 'SUPER', name: 'SUPER', kraken: 'SUPERUSD', tv: 'SUPER', decimals: 5 },
  { symbol: 'ALEO', name: 'ALEO', kraken: 'ALEOUSD', tv: 'ALEO', decimals: 5 },
  { symbol: 'ARX', name: 'ARX', kraken: 'ARXUSD', tv: 'ARX', decimals: 5 },
  { symbol: 'AR', name: 'AR', kraken: 'ARUSD', tv: 'AR', decimals: 3 },
  { symbol: 'FLUX', name: 'FLUX', kraken: 'FLUXUSD', tv: 'FLUX', decimals: 5 },
  { symbol: 'MNT', name: 'MNT', kraken: 'MNTUSD', tv: 'MNT', decimals: 5 },
  { symbol: 'PROMPT', name: 'PROMPT', kraken: 'PROMPTUSD', tv: 'PROMPT', decimals: 5 },
  { symbol: 'ALCX', name: 'ALCX', kraken: 'ALCXUSD', tv: 'ALCX', decimals: 3 },
  { symbol: 'OGN', name: 'OGN', kraken: 'OGNUSD', tv: 'OGN', decimals: 5 },
  { symbol: 'HONEY', name: 'HONEY', kraken: 'HONEYUSD', tv: 'HONEY', decimals: 6 },
  { symbol: 'GLMR', name: 'GLMR', kraken: 'GLMRUSD', tv: 'GLMR', decimals: 5 },
  { symbol: 'IP', name: 'IP', kraken: 'IPUSD', tv: 'IP', decimals: 5 },
  { symbol: 'CCD', name: 'CCD', kraken: 'CCDUSD', tv: 'CCD', decimals: 6 },
  { symbol: 'UAI', name: 'UAI', kraken: 'UAIUSD', tv: 'UAI', decimals: 5 },
  { symbol: 'WBT', name: 'WBT', kraken: 'WBTUSD', tv: 'WBT', decimals: 3 },
  { symbol: 'CRO', name: 'CRO', kraken: 'CROUSD', tv: 'CRO', decimals: 5 },
  { symbol: 'EGLD', name: 'EGLD', kraken: 'EGLDUSD', tv: 'EGLD', decimals: 3 },
  { symbol: 'ZORA', name: 'ZORA', kraken: 'ZORAUSD', tv: 'ZORA', decimals: 6 },
  { symbol: 'LOFI', name: 'LOFI', kraken: 'LOFIUSD', tv: 'LOFI', decimals: 6 },
  { symbol: 'AVL', name: 'AVL', kraken: 'AVLUSD', tv: 'AVL', decimals: 5 },
  { symbol: 'CTSI', name: 'CTSI', kraken: 'CTSIUSD', tv: 'CTSI', decimals: 5 },
  { symbol: 'LCX', name: 'LCX', kraken: 'LCXUSD', tv: 'LCX', decimals: 5 },
  { symbol: 'AI', name: 'AI', kraken: 'AIUSD', tv: 'AI', decimals: 5 },
  { symbol: 'ARPA', name: 'ARPA', kraken: 'ARPAUSD', tv: 'ARPA', decimals: 5 },
  { symbol: 'VTHO', name: 'VTHO', kraken: 'VTHOUSD', tv: 'VTHO', decimals: 6 },
  { symbol: 'STBL', name: 'STBL', kraken: 'STBLUSD', tv: 'STBL', decimals: 5 },
  { symbol: 'COTI', name: 'COTI', kraken: 'COTIUSD', tv: 'COTI', decimals: 5 },
  { symbol: 'GTC', name: 'GTC', kraken: 'GTCUSD', tv: 'GTC', decimals: 5 },
  { symbol: 'IDEX', name: 'IDEX', kraken: 'IDEXUSD', tv: 'IDEX', decimals: 6 },
  { symbol: 'LSK', name: 'LSK', kraken: 'LSKUSD', tv: 'LSK', decimals: 5 },
  { symbol: 'SN51', name: 'SN51', kraken: 'SN51USD', tv: 'SN51', decimals: 3 },
  { symbol: '2Z', name: '2Z', kraken: '2ZUSD', tv: '2Z', decimals: 5 },
  { symbol: 'BRL1', name: 'BRL1', kraken: 'BRL1USD', tv: 'BRL1', decimals: 5 },
  { symbol: 'SKR', name: 'SKR', kraken: 'SKRUSD', tv: 'SKR', decimals: 5 },
  { symbol: 'MELANIA', name: 'MELANIA', kraken: 'MELANIAUSD', tv: 'MELANIA', decimals: 5 },
  { symbol: '0G', name: '0G', kraken: '0GUSD', tv: '0G', decimals: 5 },
  { symbol: 'AUSD', name: 'AUSD', kraken: 'AUSDUSD', tv: 'AUSD', decimals: 3 },
  { symbol: 'AIN', name: 'AIN', kraken: 'AINUSD', tv: 'AIN', decimals: 5 },
  { symbol: 'KMNO', name: 'KMNO', kraken: 'KMNOUSD', tv: 'KMNO', decimals: 5 },
  { symbol: 'VSN', name: 'VSN', kraken: 'VSNUSD', tv: 'VSN', decimals: 5 },
  { symbol: 'CARV', name: 'CARV', kraken: 'CARVUSD', tv: 'CARV', decimals: 5 },
  { symbol: 'PI', name: 'PI', kraken: 'PIUSD', tv: 'PI', decimals: 5 },
  { symbol: 'NOCK', name: 'NOCK', kraken: 'NOCKUSD', tv: 'NOCK', decimals: 5 },
  { symbol: 'ALIGN', name: 'ALIGN', kraken: 'ALIGNUSD', tv: 'ALIGN', decimals: 6 },
  { symbol: 'SOLV', name: 'SOLV', kraken: 'SOLVUSD', tv: 'SOLV', decimals: 6 },
  { symbol: 'PROS', name: 'PROS', kraken: 'PROSUSD', tv: 'PROS', decimals: 5 },
  { symbol: 'RIVER', name: 'RIVER', kraken: 'RIVERUSD', tv: 'RIVER', decimals: 3 },
  { symbol: 'ENSO', name: 'ENSO', kraken: 'ENSOUSD', tv: 'ENSO', decimals: 5 },
  { symbol: 'FUN', name: 'FUN', kraken: 'FUNUSD', tv: 'FUN', decimals: 5 },
  { symbol: 'GMT', name: 'GMT', kraken: 'GMTUSD', tv: 'GMT', decimals: 6 },
  { symbol: 'SWEAT', name: 'SWEAT', kraken: 'SWEATUSD', tv: 'SWEAT', decimals: 6 },
  { symbol: 'VELVET', name: 'VELVET', kraken: 'VELVETUSD', tv: 'VELVET', decimals: 5 },
  { symbol: 'DENT', name: 'DENT', kraken: 'DENTUSD', tv: 'DENT', decimals: 6 },
  { symbol: 'FIGHT', name: 'FIGHT', kraken: 'FIGHTUSD', tv: 'FIGHT', decimals: 6 },
  { symbol: 'WCT', name: 'WCT', kraken: 'WCTUSD', tv: 'WCT', decimals: 5 },
  { symbol: 'SN8', name: 'SN8', kraken: 'SN8USD', tv: 'SN8', decimals: 3 },
  { symbol: 'RUNE', name: 'RUNE', kraken: 'RUNEUSD', tv: 'RUNE', decimals: 5 },
  { symbol: 'RE', name: 'RE', kraken: 'REUSD', tv: 'RE', decimals: 5 },
  { symbol: 'ROBO', name: 'ROBO', kraken: 'ROBOUSD', tv: 'ROBO', decimals: 6 },
];

export const pairBySymbol = (s: string): PairInfo | undefined =>
  PAIRS.find((p) => p.symbol === s.toUpperCase());

export const pairByKraken = (k: string): PairInfo | undefined =>
  PAIRS.find((p) => p.kraken === k.toUpperCase());
