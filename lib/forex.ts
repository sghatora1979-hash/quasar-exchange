// World forex pairs for Quasar demo — all quoted vs USD (XXXUSD convention).
// Prices come from the /api/forex route (Frankfurter/ECB daily reference rates):
//   price(XXXUSD) = 1 / rate(XXX)   e.g. EURUSD = 1 / rate.EUR

export type ForexPair = {
  symbol: string; // base code, e.g. 'EUR'
  pair: string; // e.g. 'EURUSD'
  name: string; // 'Euro / US Dollar'
  tv: string; // TradingView symbol, e.g. 'OANDA:EURUSD'
  decimals: number;
};

export const FOREX_PAIRS: ForexPair[] = [
  { symbol: 'EUR', pair: 'EURUSD', name: 'Euro / US Dollar', tv: 'OANDA:EURUSD', decimals: 5 },
  { symbol: 'GBP', pair: 'GBPUSD', name: 'British Pound / US Dollar', tv: 'OANDA:GBPUSD', decimals: 5 },
  { symbol: 'JPY', pair: 'JPYUSD', name: 'Japanese Yen / US Dollar', tv: 'OANDA:JPYUSD', decimals: 6 },
  { symbol: 'INR', pair: 'INRUSD', name: 'Indian Rupee / US Dollar', tv: 'OANDA:INRUSD', decimals: 6 },
  { symbol: 'CAD', pair: 'CADUSD', name: 'Canadian Dollar / US Dollar', tv: 'OANDA:CADUSD', decimals: 5 },
  { symbol: 'AUD', pair: 'AUDUSD', name: 'Australian Dollar / US Dollar', tv: 'OANDA:AUDUSD', decimals: 5 },
  { symbol: 'CHF', pair: 'CHFUSD', name: 'Swiss Franc / US Dollar', tv: 'OANDA:CHFUSD', decimals: 5 },
  { symbol: 'CNY', pair: 'CNYUSD', name: 'Chinese Yuan / US Dollar', tv: 'OANDA:CNYUSD', decimals: 5 },
  { symbol: 'SGD', pair: 'SGDUSD', name: 'Singapore Dollar / US Dollar', tv: 'OANDA:SGDUSD', decimals: 5 },
  { symbol: 'HKD', pair: 'HKDUSD', name: 'Hong Kong Dollar / US Dollar', tv: 'OANDA:HKDUSD', decimals: 5 },
  { symbol: 'NZD', pair: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', tv: 'OANDA:NZDUSD', decimals: 5 },
  { symbol: 'MXN', pair: 'MXNUSD', name: 'Mexican Peso / US Dollar', tv: 'OANDA:MXNUSD', decimals: 5 },
  { symbol: 'BRL', pair: 'BRLUSD', name: 'Brazilian Real / US Dollar', tv: 'OANDA:BRLUSD', decimals: 5 },
  { symbol: 'ZAR', pair: 'ZARUSD', name: 'South African Rand / US Dollar', tv: 'OANDA:ZARUSD', decimals: 5 },
  { symbol: 'KRW', pair: 'KRWUSD', name: 'South Korean Won / US Dollar', tv: 'OANDA:KRWUSD', decimals: 6 },
  { symbol: 'SEK', pair: 'SEKUSD', name: 'Swedish Krona / US Dollar', tv: 'OANDA:SEKUSD', decimals: 5 },
  { symbol: 'NOK', pair: 'NOKUSD', name: 'Norwegian Krone / US Dollar', tv: 'OANDA:NOKUSD', decimals: 5 },
  { symbol: 'DKK', pair: 'DKKUSD', name: 'Danish Krone / US Dollar', tv: 'OANDA:DKKUSD', decimals: 5 },
  { symbol: 'PLN', pair: 'PLNUSD', name: 'Polish Zloty / US Dollar', tv: 'OANDA:PLNUSD', decimals: 5 },
  { symbol: 'ILS', pair: 'ILSUSD', name: 'Israeli Shekel / US Dollar', tv: 'OANDA:ILSUSD', decimals: 5 },
  { symbol: 'HUF', pair: 'HUFUSD', name: 'Hungarian Forint / US Dollar', tv: 'OANDA:HUFUSD', decimals: 6 },
  { symbol: 'RON', pair: 'RONUSD', name: 'Romanian Leu / US Dollar', tv: 'OANDA:RONUSD', decimals: 5 },
  { symbol: 'THB', pair: 'THBUSD', name: 'Thai Baht / US Dollar', tv: 'OANDA:THBUSD', decimals: 5 },
  { symbol: 'MYR', pair: 'MYRUSD', name: 'Malaysian Ringgit / US Dollar', tv: 'OANDA:MYRUSD', decimals: 5 },
  { symbol: 'IDR', pair: 'IDRUSD', name: 'Indonesian Rupiah / US Dollar', tv: 'OANDA:IDRUSD', decimals: 7 },
  { symbol: 'PHP', pair: 'PHPUSD', name: 'Philippine Peso / US Dollar', tv: 'OANDA:PHPUSD', decimals: 6 },
  { symbol: 'TRY', pair: 'TRYUSD', name: 'Turkish Lira / US Dollar', tv: 'OANDA:TRYUSD', decimals: 5 },
  { symbol: 'CZK', pair: 'CZKUSD', name: 'Czech Koruna / US Dollar', tv: 'OANDA:CZKUSD', decimals: 5 },
];

export const forexBySymbol = (s: string): ForexPair | undefined =>
  FOREX_PAIRS.find((p) => p.symbol === s.toUpperCase());

export const forexByPair = (pair: string): ForexPair | undefined =>
  FOREX_PAIRS.find((p) => p.pair === pair.toUpperCase());

/** Convert Frankfurter USD-base rates to XXXUSD prices. */
export function forexPrices(rates: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of FOREX_PAIRS) {
    const r = rates[p.symbol];
    if (r && r > 0) out[p.symbol] = 1 / r;
  }
  return out;
}
