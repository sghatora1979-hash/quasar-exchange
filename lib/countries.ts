// Country/exchange metadata for the Global Markets selector — DEMO app.
// Market hours are standard local session times (lunch breaks noted);
// holidays are not modeled — the badge is indicative, not trading advice.

export type RegionGroup = 'Americas' | 'Europe' | 'Asia-Pacific' | 'Middle East & Africa';

export type CountryMeta = {
  code: string; flag: string; country: string; exchange: string; currency: string;
  tz: string; open: string; close: string; lunch?: [string, string];
  days: number[]; group: RegionGroup; limited?: boolean;
};

export const REGION_GROUPS: RegionGroup[] = ['Americas', 'Europe', 'Asia-Pacific', 'Middle East & Africa'];

export const COUNTRIES: Record<string, CountryMeta> = {
  in_nse: { code: 'in_nse', flag: '🇮🇳', country: 'India', exchange: 'NSE', currency: 'INR', tz: 'Asia/Kolkata', open: '09:15', close: '15:30', days: [1,2,3,4,5], group: 'Asia-Pacific' },
  in_bse: { code: 'in_bse', flag: '🇮🇳', country: 'India', exchange: 'BSE', currency: 'INR', tz: 'Asia/Kolkata', open: '09:15', close: '15:30', days: [1,2,3,4,5], group: 'Asia-Pacific' },
  us: { code: 'us', flag: '🇺🇸', country: 'United States', exchange: 'NYSE / NASDAQ', currency: 'USD', tz: 'America/New_York', open: '09:30', close: '16:00', days: [1,2,3,4,5], group: 'Americas' },
  ca: { code: 'ca', flag: '🇨🇦', country: 'Canada', exchange: 'TSX', currency: 'CAD', tz: 'America/Toronto', open: '09:30', close: '16:00', days: [1,2,3,4,5], group: 'Americas' },
  sg: { code: 'sg', flag: '🇸🇬', country: 'Singapore', exchange: 'SGX', currency: 'SGD', tz: 'Asia/Singapore', open: '09:00', close: '17:00', lunch: ['12:00','13:00'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  uk: { code: 'uk', flag: '🇬🇧', country: 'United Kingdom', exchange: 'LSE', currency: 'GBp', tz: 'Europe/London', open: '08:00', close: '16:30', days: [1,2,3,4,5], group: 'Europe' },
  de: { code: 'de', flag: '🇩🇪', country: 'Germany', exchange: 'Xetra', currency: 'EUR', tz: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  fr: { code: 'fr', flag: '🇫🇷', country: 'France', exchange: 'Euronext Paris', currency: 'EUR', tz: 'Europe/Paris', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  nl: { code: 'nl', flag: '🇳🇱', country: 'Netherlands', exchange: 'Euronext Amsterdam', currency: 'EUR', tz: 'Europe/Amsterdam', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  ch: { code: 'ch', flag: '🇨🇭', country: 'Switzerland', exchange: 'SIX', currency: 'CHF', tz: 'Europe/Zurich', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  dk: { code: 'dk', flag: '🇩🇰', country: 'Denmark', exchange: 'Nasdaq Copenhagen', currency: 'DKK', tz: 'Europe/Copenhagen', open: '09:00', close: '17:00', days: [1,2,3,4,5], group: 'Europe' },
  ie: { code: 'ie', flag: '🇮🇪', country: 'Ireland', exchange: 'Euronext Dublin', currency: 'EUR', tz: 'Europe/Dublin', open: '08:00', close: '16:30', days: [1,2,3,4,5], group: 'Europe' },
  pt: { code: 'pt', flag: '🇵🇹', country: 'Portugal', exchange: 'Euronext Lisbon', currency: 'EUR', tz: 'Europe/Lisbon', open: '08:00', close: '16:30', days: [1,2,3,4,5], group: 'Europe' },
  be: { code: 'be', flag: '🇧🇪', country: 'Belgium', exchange: 'Euronext Brussels', currency: 'EUR', tz: 'Europe/Brussels', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  jp: { code: 'jp', flag: '🇯🇵', country: 'Japan', exchange: 'TSE', currency: 'JPY', tz: 'Asia/Tokyo', open: '09:00', close: '15:00', lunch: ['11:30','12:30'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  hk: { code: 'hk', flag: '🇭🇰', country: 'Hong Kong', exchange: 'HKEX', currency: 'HKD', tz: 'Asia/Hong_Kong', open: '09:30', close: '16:00', lunch: ['12:00','13:00'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  au: { code: 'au', flag: '🇦🇺', country: 'Australia', exchange: 'ASX', currency: 'AUD', tz: 'Australia/Sydney', open: '10:00', close: '16:00', days: [1,2,3,4,5], group: 'Asia-Pacific' },
  kr: { code: 'kr', flag: '🇰🇷', country: 'South Korea', exchange: 'KRX', currency: 'KRW', tz: 'Asia/Seoul', open: '09:00', close: '15:30', days: [1,2,3,4,5], group: 'Asia-Pacific' },
  tw: { code: 'tw', flag: '🇹🇼', country: 'Taiwan', exchange: 'TWSE', currency: 'TWD', tz: 'Asia/Taipei', open: '09:00', close: '13:30', days: [1,2,3,4,5], group: 'Asia-Pacific' },
  br: { code: 'br', flag: '🇧🇷', country: 'Brazil', exchange: 'B3', currency: 'BRL', tz: 'America/Sao_Paulo', open: '10:00', close: '17:00', days: [1,2,3,4,5], group: 'Americas' },
  za: { code: 'za', flag: '🇿🇦', country: 'South Africa', exchange: 'JSE', currency: 'ZAR', tz: 'Africa/Johannesburg', open: '09:00', close: '17:00', days: [1,2,3,4,5], group: 'Middle East & Africa' },
  nz: { code: 'nz', flag: '🇳🇿', country: 'New Zealand', exchange: 'NZX', currency: 'NZD', tz: 'Pacific/Auckland', open: '10:00', close: '16:45', days: [1,2,3,4,5], group: 'Asia-Pacific' },
  no: { code: 'no', flag: '🇳🇴', country: 'Norway', exchange: 'Oslo Bors', currency: 'NOK', tz: 'Europe/Oslo', open: '09:00', close: '16:30', days: [1,2,3,4,5], group: 'Europe' },
  se: { code: 'se', flag: '🇸🇪', country: 'Sweden', exchange: 'Nasdaq Stockholm', currency: 'SEK', tz: 'Europe/Stockholm', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  es: { code: 'es', flag: '🇪🇸', country: 'Spain', exchange: 'BME', currency: 'EUR', tz: 'Europe/Madrid', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  it: { code: 'it', flag: '🇮🇹', country: 'Italy', exchange: 'Borsa Italiana', currency: 'EUR', tz: 'Europe/Rome', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  at: { code: 'at', flag: '🇦🇹', country: 'Austria', exchange: 'Wiener Borse', currency: 'EUR', tz: 'Europe/Vienna', open: '09:00', close: '17:30', days: [1,2,3,4,5], group: 'Europe' },
  gr: { code: 'gr', flag: '🇬🇷', country: 'Greece', exchange: 'ATHEX', currency: 'EUR', tz: 'Europe/Athens', open: '10:00', close: '17:00', days: [1,2,3,4,5], group: 'Europe' },
  fi: { code: 'fi', flag: '🇫🇮', country: 'Finland', exchange: 'Nasdaq Helsinki', currency: 'EUR', tz: 'Europe/Helsinki', open: '10:00', close: '18:30', days: [1,2,3,4,5], group: 'Europe' },
  pl: { code: 'pl', flag: '🇵🇱', country: 'Poland', exchange: 'GPW', currency: 'PLN', tz: 'Europe/Warsaw', open: '09:00', close: '16:50', days: [1,2,3,4,5], group: 'Europe' },
  cz: { code: 'cz', flag: '🇨🇿', country: 'Czechia', exchange: 'PSE', currency: 'CZK', tz: 'Europe/Prague', open: '09:00', close: '16:20', days: [1,2,3,4,5], group: 'Europe' },
  hu: { code: 'hu', flag: '🇭🇺', country: 'Hungary', exchange: 'BSE Budapest', currency: 'HUF', tz: 'Europe/Budapest', open: '09:00', close: '17:00', days: [1,2,3,4,5], group: 'Europe' },
  ro: { code: 'ro', flag: '🇷🇴', country: 'Romania', exchange: 'BVB', currency: 'RON', tz: 'Europe/Bucharest', open: '10:00', close: '18:00', days: [1,2,3,4,5], group: 'Europe' },
  mx: { code: 'mx', flag: '🇲🇽', country: 'Mexico', exchange: 'BMV', currency: 'MXN', tz: 'America/Mexico_City', open: '08:30', close: '15:00', days: [1,2,3,4,5], group: 'Americas' },
  ar: { code: 'ar', flag: '🇦🇷', country: 'Argentina', exchange: 'BYMA', currency: 'ARS', tz: 'America/Argentina/Buenos_Aires', open: '11:00', close: '17:00', days: [1,2,3,4,5], group: 'Americas' },
  cl: { code: 'cl', flag: '🇨🇱', country: 'Chile', exchange: 'BCS', currency: 'CLP', tz: 'America/Santiago', open: '09:30', close: '16:00', days: [1,2,3,4,5], group: 'Americas' },
  co: { code: 'co', flag: '🇨🇴', country: 'Colombia', exchange: 'BVC', currency: 'COP', tz: 'America/Bogota', open: '09:30', close: '16:00', days: [1,2,3,4,5], group: 'Americas' },
  pe: { code: 'pe', flag: '🇵🇪', country: 'Peru', exchange: 'BVL', currency: 'PEN', tz: 'America/Lima', open: '09:30', close: '15:30', days: [1,2,3,4,5], group: 'Americas' },
  eg: { code: 'eg', flag: '🇪🇬', country: 'Egypt', exchange: 'EGX', currency: 'EGP', tz: 'Africa/Cairo', open: '10:00', close: '14:30', days: [0,1,2,3,4], group: 'Middle East & Africa' },
  th: { code: 'th', flag: '🇹🇭', country: 'Thailand', exchange: 'SET', currency: 'THB', tz: 'Asia/Bangkok', open: '10:00', close: '16:30', lunch: ['12:30','14:30'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  my: { code: 'my', flag: '🇲🇾', country: 'Malaysia', exchange: 'Bursa Malaysia', currency: 'MYR', tz: 'Asia/Kuala_Lumpur', open: '09:00', close: '17:00', lunch: ['12:30','14:30'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  id: { code: 'id', flag: '🇮🇩', country: 'Indonesia', exchange: 'IDX', currency: 'IDR', tz: 'Asia/Jakarta', open: '09:00', close: '15:00', lunch: ['11:30','14:00'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  ph: { code: 'ph', flag: '🇵🇭', country: 'Philippines', exchange: 'PSE', currency: 'PHP', tz: 'Asia/Manila', open: '09:30', close: '15:30', lunch: ['12:00','13:30'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  vn: { code: 'vn', flag: '🇻🇳', country: 'Vietnam', exchange: 'HOSE', currency: 'VND', tz: 'Asia/Ho_Chi_Minh', open: '09:00', close: '15:00', lunch: ['11:30','13:00'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  cn: { code: 'cn', flag: '🇨🇳', country: 'China', exchange: 'SSE / SZSE', currency: 'CNY', tz: 'Asia/Shanghai', open: '09:30', close: '15:00', lunch: ['11:30','13:00'], days: [1,2,3,4,5], group: 'Asia-Pacific' },
  ru: { code: 'ru', flag: '🇷🇺', country: 'Russia', exchange: 'MOEX', currency: 'RUB', tz: 'Europe/Moscow', open: '10:00', close: '18:40', days: [1,2,3,4,5], group: 'Europe', limited: true },
  tr: { code: 'tr', flag: '🇹🇷', country: 'Turkey', exchange: 'BIST', currency: 'TRY', tz: 'Europe/Istanbul', open: '10:00', close: '18:00', lunch: ['13:00','14:00'], days: [1,2,3,4,5], group: 'Europe' },
  il: { code: 'il', flag: '🇮🇱', country: 'Israel', exchange: 'TASE', currency: 'ILS', tz: 'Asia/Jerusalem', open: '10:00', close: '17:25', days: [0,1,2,3,4], group: 'Middle East & Africa' },
  sa: { code: 'sa', flag: '🇸🇦', country: 'Saudi Arabia', exchange: 'Tadawul', currency: 'SAR', tz: 'Asia/Riyadh', open: '10:00', close: '15:00', days: [0,1,2,3,4], group: 'Middle East & Africa', limited: true },
  pk: { code: 'pk', flag: '🇵🇰', country: 'Pakistan', exchange: 'PSX', currency: 'PKR', tz: 'Asia/Karachi', open: '09:30', close: '15:30', days: [1,2,3,4,5], group: 'Asia-Pacific', limited: true },
  ae: { code: 'ae', flag: '🇦🇪', country: 'UAE', exchange: 'DFM / ADX', currency: 'AED', tz: 'Asia/Dubai', open: '10:00', close: '15:00', days: [1,2,3,4,5], group: 'Middle East & Africa', limited: true },
  qa: { code: 'qa', flag: '🇶🇦', country: 'Qatar', exchange: 'QSE', currency: 'QAR', tz: 'Asia/Qatar', open: '10:00', close: '13:10', days: [0,1,2,3,4], group: 'Middle East & Africa', limited: true },
  kw: { code: 'kw', flag: '🇰🇼', country: 'Kuwait', exchange: 'Boursa Kuwait', currency: 'KWD', tz: 'Asia/Kuwait', open: '10:00', close: '13:00', days: [0,1,2,3,4], group: 'Middle East & Africa', limited: true },
  ng: { code: 'ng', flag: '🇳🇬', country: 'Nigeria', exchange: 'NGX', currency: 'NGN', tz: 'Africa/Lagos', open: '09:30', close: '14:30', days: [1,2,3,4,5], group: 'Middle East & Africa', limited: true },
  ke: { code: 'ke', flag: '🇰🇪', country: 'Kenya', exchange: 'NSE Kenya', currency: 'KES', tz: 'Africa/Nairobi', open: '09:00', close: '15:00', days: [1,2,3,4,5], group: 'Middle East & Africa', limited: true },
  bd: { code: 'bd', flag: '🇧🇩', country: 'Bangladesh', exchange: 'DSE', currency: 'BDT', tz: 'Asia/Dhaka', open: '10:00', close: '14:30', days: [0,1,2,3,4], group: 'Asia-Pacific', limited: true },
  lk: { code: 'lk', flag: '🇱🇰', country: 'Sri Lanka', exchange: 'CSE', currency: 'LKR', tz: 'Asia/Colombo', open: '09:30', close: '14:30', days: [1,2,3,4,5], group: 'Asia-Pacific', limited: true },
};

export type MarketStatus = { open: boolean; localTime: string; label: string };

/** Is the exchange in its local session right now? Uses Intl API — no libraries. */
export function marketStatus(code: string): MarketStatus {
  const m = COUNTRIES[code];
  if (!m) return { open: false, localTime: '', label: 'Unknown' };
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: m.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const wd = get('weekday');
    const hm = `${get('hour')}:${get('minute')}`;
    const dayIdx = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(wd);
    const toMin = (s: string) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
    const t = toMin(hm);
    let open = m.days.includes(dayIdx) && t >= toMin(m.open) && t < toMin(m.close);
    if (open && m.lunch && t >= toMin(m.lunch[0]) && t < toMin(m.lunch[1])) open = false;
    return { open, localTime: hm, label: open ? 'Open' : 'Closed' };
  } catch { return { open: false, localTime: '', label: 'Unknown' }; }
}