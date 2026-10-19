// Quasar AI Bot — web answers (server-side). NO API keys: free public RSS
// feeds (CoinDesk, Economic Times Markets, CoinTelegraph) + DuckDuckGo
// Instant Answer API + live Kraken prices. DEMO ONLY — not financial advice.
//
// GET /api/assistant?q=<question>&mode=news|search
// - mode=news (or auto-detected): market headlines + live price pulse.
// - otherwise: general-knowledge answer from DuckDuckGo abstract.
// The bot NEVER invents headlines: if no feed loads, it says so.

import { krakenGet } from '../_lib';

export const dynamic = 'force-dynamic';

type Headline = { title: string; url: string; source: string; when: string };

const FEEDS: { url: string; source: string }[] = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
  { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph' },
  { url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', source: 'Economic Times' },
];

const CACHE = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 5 * 60 * 1000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data as T);
  return fn().then((d) => {
    CACHE.set(key, { at: Date.now(), data: d });
    return d;
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml: string, source: string): Headline[] {
  const items: Headline[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && items.length < 12) {
    const body = m[1];
    const title = decodeEntities((/<title>([\s\S]*?)<\/title>/i.exec(body) ?? [])[1] ?? '');
    const url = decodeEntities((/<link>([\s\S]*?)<\/link>/i.exec(body) ?? [])[1] ?? '');
    const pub = decodeEntities((/<pubDate>([\s\S]*?)<\/pubDate>/i.exec(body) ?? [])[1] ?? '');
    if (title) items.push({ title, url, source, when: pub });
  }
  return items;
}

async function fetchFeed(f: { url: string; source: string }): Promise<Headline[]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(f.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'QuasarDemo/1.0 (paper trading demo)', Accept: 'application/rss+xml, application/xml, text/xml' },
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return [];
    return parseRss(await res.text(), f.source);
  } catch {
    return [];
  }
}

type TickerRow = { c: [string, string]; o: string; h: [string, string]; l: [string, string] };

async function marketPulse(): Promise<string> {
  try {
    const env = await krakenGet<Record<string, TickerRow>>('/Ticker', {
      pair: 'XBTUSD,ETHUSD,SOLUSD,XRPUSD,DOGEUSD',
    });
    if (env.error.length || !env.result) return '';
    const names: Record<string, string> = {
      XXBTZUSD: 'BTC', XETHZUSD: 'ETH', SOLUSD: 'SOL', XXRPZUSD: 'XRP', XDGUSD: 'DOGE',
    };
    const lines: string[] = [];
    for (const [key, row] of Object.entries(env.result)) {
      const name = names[key];
      if (!name || !row?.c?.[0] || !row?.o) continue;
      const price = parseFloat(row.c[0]);
      const open = parseFloat(row.o);
      const chg = open > 0 ? ((price - open) / open) * 100 : 0;
      lines.push(`• **${name}:** $${price.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% 24h)`);
    }
    if (!lines.length) return '';
    return `**Live market pulse (Kraken, demo data):**\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

async function newsAnswer(q: string): Promise<{ answer: string; sources: { title: string; url: string }[] }> {
  const all = (
    await Promise.all(FEEDS.map((f) => cached(`feed:${f.source}`, () => fetchFeed(f))))
  ).flat();
  if (!all.length) {
    return {
      answer: `I couldn't reach the news feeds just now (CoinDesk / CoinTelegraph / Economic Times may be slow or blocked).\n\nTry again in a moment, or ask me to **analyze a symbol** — that uses live market data instead.\n\n_Demo only — not financial advice._`,
      sources: [],
    };
  }
  // Prefer headlines matching words in the question (e.g. "BTC", "NSE").
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['what', 'news', 'market', 'today', 'happening', 'going', 'about', 'tell'].includes(w));
  const scored = all.map((h) => ({
    h,
    score: words.reduce((s, w) => s + (h.title.toLowerCase().includes(w) ? 1 : 0), 0),
  }));
  scored.sort((a, b) => b.score - a.score || 0);
  const top = scored.slice(0, 6).map((s) => s.h);
  const pulse = await marketPulse();
  const lines = [
    `**What's going on in the market** (latest headlines):`,
    ``,
    ...top.map((h) => `• ${h.title} _(${h.source})_`),
    ``,
    pulse,
    ``,
    `_Headlines from CoinDesk, CoinTelegraph and Economic Times (public RSS). Demo only — headlines are information, not trading advice._`,
  ];
  return {
    answer: lines.filter((l) => l !== '').join('\n'),
    sources: top.filter((h) => h.url).map((h) => ({ title: h.title, url: h.url })),
  };
}

type Ddg = {
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  RelatedTopics?: { Text?: string; FirstURL?: string }[];
};

/** Wikipedia fallback — reliable for general-knowledge questions (CC BY-SA, attributed). */
async function wikiAnswer(q: string): Promise<{ answer: string; sources: { title: string; url: string }[] } | null> {
  try {
    const topic = q
      .replace(/^(what is|what's|what are|define|explain|tell me about|who is|how does|how do|what does)\s+/i, '')
      .replace(/[?.!]+$/g, '')
      .trim();
    if (!topic) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const sr = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&origin=*&srlimit=1`,
      { signal: ctrl.signal, headers: { 'User-Agent': 'QuasarDemo/1.0' }, cache: 'no-store' }
    );
    const sj = await sr.json();
    const title = sj?.query?.search?.[0]?.title as string | undefined;
    if (!title) { clearTimeout(t); return null; }
    const sum = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      signal: ctrl.signal, headers: { 'User-Agent': 'QuasarDemo/1.0' }, cache: 'no-store',
    });
    clearTimeout(t);
    const j = await sum.json();
    const extract = (j.extract as string | undefined)?.trim();
    if (!extract) return null;
    const pageUrl = (j.content_urls?.desktop?.page as string | undefined) ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
    return {
      answer: `${extract}\n\n_Source: Wikipedia — ${pageUrl} (CC BY-SA). Demo only — not financial advice._`,
      sources: [{ title, url: pageUrl }],
    };
  } catch {
    return null;
  }
}

async function searchAnswer(q: string): Promise<{ answer: string; sources: { title: string; url: string }[] }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'QuasarDemo/1.0' }, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) throw new Error('search unavailable');
    const j = (await res.json()) as Ddg;
    const abstract = (j.AbstractText ?? '').trim();
    const related = (j.RelatedTopics ?? []).filter((r) => r.Text).slice(0, 3);
    if (!abstract && !related.length) {
      // DuckDuckGo had no short summary — try Wikipedia before giving up.
      const wiki = await wikiAnswer(q);
      if (wiki) return wiki;
      return {
        answer: `I searched the web for **"${q}"** but found no short summary.\n\nTry asking about the market instead — e.g. **"What's happening in the market?"** or **"Analyze QSR"**.\n\n_Demo only — not financial advice._`,
        sources: [],
      };
    }
    const lines = [
      abstract ? abstract : `Here's what the web says about **"${q}"**:`,
      ``,
      ...related.map((r) => `• ${r.Text}`),
      ``,
      `_Source: ${j.AbstractSource || 'DuckDuckGo'}${j.AbstractURL ? ` — ${j.AbstractURL}` : ''}. Demo only — not financial advice._`,
    ];
    return {
      answer: lines.filter((l) => l !== '').join('\n'),
      sources: [
        ...(j.AbstractURL ? [{ title: j.AbstractSource || 'Source', url: j.AbstractURL }] : []),
        ...related.filter((r) => r.FirstURL).map((r) => ({ title: r.Text ?? 'Related', url: r.FirstURL as string })),
      ],
    };
  } catch {
    return {
      answer: `I couldn't reach web search just now.\n\nTry again in a moment, or ask me something from the platform — **"My profit?"**, **"Analyze QSR"**, or **"What's happening in the market?"**.\n\n_Demo only — not financial advice._`,
      sources: [],
    };
  }
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') ?? '').trim();
  if (!q) return Response.json({ ok: false, error: 'Empty question.' }, { status: 400 });
  const mode = sp.get('mode');
  const isNews = mode === 'news' || /(news|headlines|what'?s (happening|going on)|market (today|now|update)|aaj|bazaar)/i.test(q);
  const out = isNews ? await newsAnswer(q) : await searchAnswer(q);
  return Response.json({ ok: true, mode: isNews ? 'news' : 'search', ...out });
}
