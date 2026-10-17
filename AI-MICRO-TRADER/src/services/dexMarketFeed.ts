import type { ScannedToken, TokenSecurityAudit } from './tradingEngine';
import { SOL_MINT, USDC_MINT, type MarketSnapshot } from './jupiterMarket';

export const DEX_FEED_LIMIT = 25;
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const EXCLUDED_MINTS = new Set([
  SOL_MINT,
  USDC_MINT,
  USDT_MINT,
  'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB',
]);

const EXCLUDED_SYMBOLS = new Set([
  'SOL',
  'WSOL',
  'USDC',
  'USDT',
  'USD1',
  'PYUSD',
  'CASH',
  'DAI',
]);

export type DexFeedToken = Omit<ScannedToken, 'checklist' | 'ema9' | 'ema21' | 'iccPhase' | 'iccSignalStrength'>;

export interface GeckoPoolLike {
  attributes?: {
    name?: string;
    address?: string;
    base_token_price_usd?: string;
    quote_token_price_usd?: string;
    fdv_usd?: string;
    market_cap_usd?: string | null;
    pool_created_at?: string;
    reserve_in_usd?: string;
    price_change_percentage?: Record<string, string>;
    volume_usd?: Record<string, string>;
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
    quote_token?: { data?: { id?: string } };
  };
}

export interface GeckoTokenLike {
  id?: string;
  attributes?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
}

export interface DexScreenerPairLike {
  chainId?: string;
  pairAddress?: string;
  url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h24?: number };
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mintFromGeckoId(id?: string): string {
  if (!id) return '';
  return id.startsWith('solana_') ? id.slice('solana_'.length) : id;
}

function unknownSecurity(reason: string): TokenSecurityAudit {
  return {
    honeypot: false,
    mintDisabled: false,
    freezeDisabled: false,
    lpBurnedPercent: 0,
    top10HoldersPercent: 100,
    buyTax: 0,
    sellTax: 0,
    score: 0,
    warningFlags: [reason],
  };
}

function sparklineFromLive(price: number, change5m: number, change1h: number, change24h: number): number[] {
  const p24 = change24h <= -99 ? price * 0.2 : price / (1 + change24h / 100);
  const p1h = change1h <= -99 ? price * 0.5 : price / (1 + change1h / 100);
  const p5 = change5m <= -99 ? price * 0.8 : price / (1 + change5m / 100);
  return [Math.max(0, p24), Math.max(0, p1h), Math.max(0, p5), price];
}

function ageMinutesFromIso(iso?: string, epochMs?: number): number {
  const ms = epochMs && epochMs > 0 ? epochMs : iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(0, Math.round((Date.now() - ms) / 60000));
}

export function isExcludedMemeCandidate(symbol: string, mint: string): boolean {
  const sym = symbol.trim().toUpperCase();
  return !mint || EXCLUDED_MINTS.has(mint) || EXCLUDED_SYMBOLS.has(sym);
}

export function mapGeckoPoolToToken(
  pool: GeckoPoolLike,
  included: Map<string, GeckoTokenLike>
): DexFeedToken | null {
  const baseId = pool.relationships?.base_token?.data?.id || '';
  const includedToken = included.get(baseId);
  const mint = includedToken?.attributes?.address || mintFromGeckoId(baseId);
  const poolName = pool.attributes?.name || '';
  const symbol = (includedToken?.attributes?.symbol || poolName.split('/')[0] || '').trim();
  const name = (includedToken?.attributes?.name || symbol).trim();
  if (isExcludedMemeCandidate(symbol, mint)) return null;

  const priceUsd = asNumber(pool.attributes?.base_token_price_usd);
  if (priceUsd <= 0) return null;

  const change5m = asNumber(pool.attributes?.price_change_percentage?.m5);
  const change1h = asNumber(pool.attributes?.price_change_percentage?.h1);
  const change24h = asNumber(pool.attributes?.price_change_percentage?.h24);
  const liquidity = asNumber(pool.attributes?.reserve_in_usd);
  const volume24h = asNumber(pool.attributes?.volume_usd?.h24);
  const marketCap = asNumber(pool.attributes?.market_cap_usd) || asNumber(pool.attributes?.fdv_usd);

  return {
    id: `dex_${mint}`,
    symbol,
    name,
    mint,
    priceUsd,
    change5m,
    change1h,
    change24h,
    marketCap,
    liquidity,
    volume24h,
    bondingCurvePercent: 0,
    ageMinutes: ageMinutesFromIso(pool.attributes?.pool_created_at),
    candles1m: [],
    security: unknownSecurity('Live DEX listing. Add a GoPlus key in API Setup to score mint/freeze/honeypot.'),
    sparkline: sparklineFromLive(priceUsd, change5m, change1h, change24h),
  };
}

export function mergeDexScreenerPair(token: DexFeedToken, pair: DexScreenerPairLike): DexFeedToken {
  const priceUsd = asNumber(pair.priceUsd) || token.priceUsd;
  const change5m = pair.priceChange?.m5 ?? token.change5m;
  const change1h = pair.priceChange?.h1 ?? token.change1h;
  const change24h = pair.priceChange?.h24 ?? token.change24h;
  return {
    ...token,
    symbol: pair.baseToken?.symbol || token.symbol,
    name: pair.baseToken?.name || token.name,
    priceUsd,
    change5m,
    change1h,
    change24h,
    marketCap: asNumber(pair.marketCap) || asNumber(pair.fdv) || token.marketCap,
    liquidity: asNumber(pair.liquidity?.usd) || token.liquidity,
    volume24h: asNumber(pair.volume?.h24) || token.volume24h,
    ageMinutes: ageMinutesFromIso(undefined, pair.pairCreatedAt) || token.ageMinutes,
    sparkline: sparklineFromLive(priceUsd, change5m, change1h, change24h),
  };
}

export function rankUniqueMemeTokens(tokens: DexFeedToken[], limit = DEX_FEED_LIMIT): DexFeedToken[] {
  const best = new Map<string, DexFeedToken>();
  for (const token of tokens) {
    const prev = best.get(token.mint);
    if (!prev || token.volume24h > prev.volume24h) best.set(token.mint, token);
  }
  return [...best.values()]
    .sort((a, b) => b.volume24h - a.volume24h || b.liquidity - a.liquidity)
    .slice(0, limit);
}

function solPriceFromGecko(pools: GeckoPoolLike[]): number | null {
  for (const pool of pools) {
    const quoteMint = mintFromGeckoId(pool.relationships?.quote_token?.data?.id);
    if (quoteMint === SOL_MINT) {
      const px = asNumber(pool.attributes?.quote_token_price_usd);
      if (px > 0) return px;
    }
  }
  return null;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function includedTokenMap(included: GeckoTokenLike[] | undefined): Map<string, GeckoTokenLike> {
  const map = new Map<string, GeckoTokenLike>();
  for (const item of included || []) {
    if (item.id) map.set(item.id, item);
  }
  return map;
}

async function loadGeckoSolanaPools(): Promise<{ pools: GeckoPoolLike[]; included: Map<string, GeckoTokenLike>; solPriceUsd: number | null }> {
  const urls = [
    'https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token,quote_token&page=1',
    'https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token,quote_token&page=2',
  ];
  const pages = await Promise.all(urls.map((url) => fetchJson(url).catch(() => null)));
  const pools: GeckoPoolLike[] = [];
  const included = new Map<string, GeckoTokenLike>();
  for (const page of pages) {
    if (!page || !Array.isArray(page.data)) continue;
    pools.push(...page.data);
    for (const [id, token] of includedTokenMap(page.included)) included.set(id, token);
  }
  return { pools, included, solPriceUsd: solPriceFromGecko(pools) };
}

async function enrichWithDexScreener(tokens: DexFeedToken[]): Promise<DexFeedToken[]> {
  if (tokens.length === 0) return tokens;
  const batches: string[][] = [];
  const mints = tokens.map((t) => t.mint);
  for (let i = 0; i < mints.length; i += 20) batches.push(mints.slice(i, i + 20));

  const pairsByMint = new Map<string, DexScreenerPairLike>();
  for (const batch of batches) {
    try {
      const json = await fetchJson(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`);
      const pairs: DexScreenerPairLike[] = Array.isArray(json) ? json : json?.pairs || [];
      for (const pair of pairs) {
        if (pair.chainId && pair.chainId !== 'solana') continue;
        const mint = pair.baseToken?.address;
        if (!mint) continue;
        const prev = pairsByMint.get(mint);
        const liq = asNumber(pair.liquidity?.usd);
        if (!prev || liq > asNumber(prev.liquidity?.usd)) pairsByMint.set(mint, pair);
      }
    } catch {
      // DexScreener is enrichment; GeckoTerminal prices still stand.
    }
  }

  return tokens.map((token) => {
    const pair = pairsByMint.get(token.mint);
    return pair ? mergeDexScreenerPair(token, pair) : token;
  });
}

export async function loadDexMemeSnapshot(): Promise<MarketSnapshot> {
  const started = Date.now();
  try {
    const { pools, included, solPriceUsd } = await loadGeckoSolanaPools();
    const mapped = pools
      .map((pool) => mapGeckoPoolToToken(pool, included))
      .filter((token): token is DexFeedToken => Boolean(token));
    const ranked = rankUniqueMemeTokens(await enrichWithDexScreener(mapped), DEX_FEED_LIMIT);
    if (ranked.length === 0) {
      throw new Error('No Solana meme pools returned from the public DEX feed');
    }
    const usedDex = ranked.some((t) => t.volume24h > 0);
    return {
      ok: true,
      source: usedDex
        ? 'DexScreener + GeckoTerminal (Solana mainnet, no API key)'
        : 'GeckoTerminal Solana trending pools (no API key)',
      latencyMs: Date.now() - started,
      solPriceUsd,
      tokens: ranked,
    };
  } catch (error) {
    return {
      ok: false,
      source: 'UNAVAILABLE',
      latencyMs: Date.now() - started,
      solPriceUsd: null,
      tokens: [],
      error: error instanceof Error ? error.message : 'Live DEX meme feed unavailable',
    };
  }
}

export async function fetchPublicDexMemeSnapshot(): Promise<MarketSnapshot> {
  const started = Date.now();
  try {
    const res = await fetch('/api/market/dex-feed', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json().catch(() => null);
    if (json && typeof json === 'object' && json.ok && Array.isArray(json.tokens) && json.tokens.length > 0) {
      return { ...json, latencyMs: json.latencyMs ?? Date.now() - started } as MarketSnapshot;
    }
  } catch {
    // Static hosting (Firebase) has no Express /api — fall through to public DEX APIs.
  }
  return loadDexMemeSnapshot();
}
