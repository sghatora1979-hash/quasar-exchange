// Commodities for Quasar demo — paper-trading only. Prices via Yahoo Finance
// futures (daily). Never faked: missing data is skipped.

export type Commodity = {
  symbol: string; // display, e.g. 'GOLD'
  yahoo: string; // e.g. 'GC=F'
  name: string;
  tv: string; // TradingView symbol
  unit: string;
  currency: string;
  decimals: number;
};

export const COMMODITIES: Commodity[] = [
  { symbol: 'GOLD', yahoo: 'GC=F', name: 'Gold', tv: 'TVC:GOLD', unit: 'troy oz', currency: 'USD', decimals: 2 },
  { symbol: 'SILVER', yahoo: 'SI=F', name: 'Silver', tv: 'TVC:SILVER', unit: 'troy oz', currency: 'USD', decimals: 2 },
  { symbol: 'OIL', yahoo: 'CL=F', name: 'Crude Oil (WTI)', tv: 'TVC:USOIL', unit: 'barrel', currency: 'USD', decimals: 2 },
  { symbol: 'NATGAS', yahoo: 'NG=F', name: 'Natural Gas', tv: 'TVC:NATGAS', unit: 'MMBtu', currency: 'USD', decimals: 3 },
  { symbol: 'COPPER', yahoo: 'HG=F', name: 'Copper', tv: 'TVC:COPPER', unit: 'lb', currency: 'USD', decimals: 3 },
];

export const commodityBySymbol = (s: string): Commodity | undefined =>
  COMMODITIES.find((c) => c.symbol === s.toUpperCase());
