import type { ScannedToken, TokenSecurityAudit } from './tradingEngine';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const QUOTE_LAMPORTS = 100_000_000; // 0.1 SOL
const PRO_QUOTE = 'https://api.jup.ag/swap/v1/quote';

export const JUPITER_WATCHLIST: Array<{
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
}> = [
  { symbol: 'SOL', name: 'Solana', mint: SOL_MINT, decimals: 9 },
  { symbol: 'USDC', name: 'USD Coin', mint: USDC_MINT, decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  { symbol: 'JUP', name: 'Jupiter', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  { symbol: 'RAY', name: 'Raydium', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
  { symbol: 'PYTH', name: 'Pyth Network', mint: 'HZ1JovNiVvgrPSzZCodtJBWKSH5NpogihL3Xwz8DXnoH', decimals: 6 },
];

export interface JupiterQuoteLike {
  outAmount?: string;
  priceImpactPct?: string;
  routePlan?: Array<{ swapInfo?: { label?: string } }>;
}

export interface MarketSnapshot {
  ok: boolean;
  source: string;
  latencyMs: number;
  solPriceUsd: number | null;
  error?: string;
  code?: string;
  tokens: Array<Omit<ScannedToken, 'checklist' | 'ema9' | 'ema21' | 'iccPhase' | 'iccSignalStrength'>>;
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

export function solUsdFromUsdcOut(outAmount: string, solInLamports = QUOTE_LAMPORTS): number {
  const usdc = Number(outAmount) / 1_000_000;
  const solIn = solInLamports / 1_000_000_000;
  if (!Number.isFinite(usdc) || usdc <= 0 || solIn <= 0) return 0;
  return +(usdc / solIn).toFixed(4);
}

export function tokenUsdFromSolQuote(
  tokenOutAmount: string,
  tokenDecimals: number,
  solUsd: number,
  solInLamports = QUOTE_LAMPORTS
): number {
  const tokens = Number(tokenOutAmount) / 10 ** tokenDecimals;
  const solIn = solInLamports / 1_000_000_000;
  if (!Number.isFinite(tokens) || tokens <= 0 || solUsd <= 0 || solIn <= 0) return 0;
  return +((solIn * solUsd) / tokens).toFixed(8);
}

async function fetchQuote(
  outputMint: string,
  apiKey: string
): Promise<JupiterQuoteLike> {
  const query = `inputMint=${SOL_MINT}&outputMint=${outputMint}&amount=${QUOTE_LAMPORTS}&slippageBps=50`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-api-key': apiKey,
  };
  const res = await fetch(`${PRO_QUOTE}?${query}`, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Jupiter quote HTTP ${res.status}`);
  return (await res.json()) as JupiterQuoteLike;
}

export async function fetchUserMarketSnapshot(headers: Record<string, string>): Promise<MarketSnapshot> {
  const started = Date.now();
  try {
    const res = await fetch('/api/market/snapshot', {
      headers: { ...headers, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return {
        ok: false,
        source: 'UNAVAILABLE',
        latencyMs: Date.now() - started,
        solPriceUsd: null,
        tokens: [],
        error: 'Market API did not return JSON. The production website may not be connected to the Express backend.',
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        source: 'UNAVAILABLE',
        latencyMs: Date.now() - started,
        solPriceUsd: null,
        tokens: [],
        error: typeof json.error === 'string' ? json.error : `Market API HTTP ${res.status}`,
        code: json.code,
      } as MarketSnapshot & { code?: string };
    }
    return { ...json, latencyMs: json.latencyMs ?? Date.now() - started } as MarketSnapshot;
  } catch (error) {
    return {
      ok: false,
      source: 'UNAVAILABLE',
      latencyMs: Date.now() - started,
      solPriceUsd: null,
      tokens: [],
      error: error instanceof Error ? error.message : 'Market API unavailable',
    };
  }
}

export async function loadMarketSnapshot(options?: {
  apiKey?: string;
  goPlusAppKey?: string;
  goPlusAppSecret?: string;
  preferBackend?: boolean;
}): Promise<MarketSnapshot> {
  const started = Date.now();
  if (!options?.apiKey) {
    return {
      ok: false,
      source: 'UNAVAILABLE',
      latencyMs: Date.now() - started,
      solPriceUsd: null,
      tokens: [],
      error: 'Jupiter API key required. Each user must add their own key in API Setup.',
    };
  }

  try {
    const solQuote = await fetchQuote(USDC_MINT, options.apiKey);
    if (!solQuote.outAmount) throw new Error('Jupiter did not return a SOL/USDC outAmount');
    const solPriceUsd = solUsdFromUsdcOut(solQuote.outAmount);
    if (solPriceUsd <= 0) throw new Error('Jupiter SOL/USDC quote produced an invalid price');

    let goplus: { ok: boolean; json: any } = { ok: false, json: null };
    if (options.goPlusAppKey) {
      try {
        const res = await fetch(
          `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${JUPITER_WATCHLIST.map((t) => t.mint).join(',')}`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: options.goPlusAppKey,
              'X-API-KEY': options.goPlusAppKey,
            },
            signal: AbortSignal.timeout(8000),
          }
        );
        goplus = { ok: res.ok, json: await res.json().catch(() => null) };
      } catch {
        goplus = { ok: false, json: null };
      }
    }

    const tokens: MarketSnapshot['tokens'] = [];
    for (const item of JUPITER_WATCHLIST) {
      let priceUsd = solPriceUsd;
      if (item.mint !== SOL_MINT) {
        if (item.mint === USDC_MINT) {
          priceUsd = 1;
        } else {
          try {
            const quote = await fetchQuote(item.mint, options.apiKey);
            if (!quote.outAmount) continue;
            priceUsd = tokenUsdFromSolQuote(quote.outAmount, item.decimals, solPriceUsd);
            if (priceUsd <= 0) continue;
          } catch {
            continue;
          }
        }
      }

      const gp = goplus.json?.result?.[item.mint];
      const security: TokenSecurityAudit = gp
        ? {
            honeypot: String(gp.is_honeypot) === '1',
            mintDisabled: String(gp.mintable?.status ?? gp.mint_authority) === '0',
            freezeDisabled: String(gp.freezable?.status ?? gp.freeze_authority) === '0',
            lpBurnedPercent: Number(gp.lp_holder_count) >= 0 ? 0 : 0,
            top10HoldersPercent: Number(gp.holder_count) > 0 ? 0 : 0,
            buyTax: Number(gp.buy_tax) || 0,
            sellTax: Number(gp.sell_tax) || 0,
            score: String(gp.is_honeypot) === '1' ? 20 : 70,
            warningFlags: ['GoPlus fields mapped conservatively; missing volume/liquidity is treated as failed ICC checks.'],
          }
        : unknownSecurity(
            options.goPlusAppKey
              ? 'GoPlus did not return security data for this mint'
              : 'Add your GoPlus App Key in API Setup to score token security'
          );

      tokens.push({
        id: `jup_${item.symbol}`,
        symbol: item.symbol,
        name: item.name,
        mint: item.mint,
        priceUsd,
        change5m: 0,
        change1h: 0,
        change24h: 0,
        marketCap: 0,
        liquidity: 0,
        volume24h: 0,
        bondingCurvePercent: 0,
        ageMinutes: 0,
        candles1m: [],
        security,
        sparkline: [priceUsd],
      });
    }

    if (tokens.length === 0) {
      throw new Error('Jupiter returned no usable token quotes');
    }

    return {
      ok: true,
      source: 'Jupiter Swap API (your API key)',
      latencyMs: Date.now() - started,
      solPriceUsd,
      tokens,
    };
  } catch (error) {
    return {
      ok: false,
      source: 'UNAVAILABLE',
      latencyMs: Date.now() - started,
      solPriceUsd: null,
      tokens: [],
      error: error instanceof Error ? error.message : 'Jupiter market data unavailable',
    };
  }
}

export async function probeJupiterQuote(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  return {
    ok: false,
    latencyMs: 0,
    error: 'Jupiter quotes use each customer API key from API Setup. There is no shared application key.',
  };
}
