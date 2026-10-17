import assert from 'assert';
import {
  isExcludedMemeCandidate,
  mapGeckoPoolToToken,
  mergeDexScreenerPair,
  rankUniqueMemeTokens,
  type GeckoPoolLike,
  type GeckoTokenLike,
} from '../services/dexMarketFeed';
import { SOL_MINT } from '../services/jupiterMarket';

async function run() {
  console.log('▶ Dex meme feed mapping');

  assert.strictEqual(isExcludedMemeCandidate('SOL', SOL_MINT), true);
  assert.strictEqual(isExcludedMemeCandidate('USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), true);
  assert.strictEqual(isExcludedMemeCandidate('FTR', 'DFMt2FyLpB6ekPNAzVErLXgpSnJ9CRf1VnxBAkTLpump'), false);

  const included = new Map<string, GeckoTokenLike>([
    [
      'solana_DFMt2FyLpB6ekPNAzVErLXgpSnJ9CRf1VnxBAkTLpump',
      {
        id: 'solana_DFMt2FyLpB6ekPNAzVErLXgpSnJ9CRf1VnxBAkTLpump',
        attributes: {
          address: 'DFMt2FyLpB6ekPNAzVErLXgpSnJ9CRf1VnxBAkTLpump',
          name: 'FTR',
          symbol: 'FTR',
        },
      },
    ],
  ]);

  const pool: GeckoPoolLike = {
    attributes: {
      name: 'FTR / SOL',
      base_token_price_usd: '0.00374',
      reserve_in_usd: '242210',
      market_cap_usd: '3740831',
      pool_created_at: new Date(Date.now() - 90 * 60000).toISOString(),
      price_change_percentage: { m5: '-3.9', h1: '-3.4', h24: '-35.4' },
      volume_usd: { h24: '13184380' },
    },
    relationships: {
      base_token: { data: { id: 'solana_DFMt2FyLpB6ekPNAzVErLXgpSnJ9CRf1VnxBAkTLpump' } },
      quote_token: { data: { id: `solana_${SOL_MINT}` } },
    },
  };

  const token = mapGeckoPoolToToken(pool, included);
  assert(token, 'Trending SOL-quoted meme pool must map to a scanner token');
  assert.strictEqual(token!.symbol, 'FTR');
  assert(token!.priceUsd > 0.003 && token!.priceUsd < 0.004);
  assert.strictEqual(token!.volume24h, 13184380);
  assert.strictEqual(token!.liquidity, 242210);
  assert(token!.mint.endsWith('pump'));

  const solPool: GeckoPoolLike = {
    attributes: {
      name: 'SOL / USDC',
      base_token_price_usd: '104.3',
      volume_usd: { h24: '999999999' },
    },
    relationships: {
      base_token: { data: { id: `solana_${SOL_MINT}` } },
    },
  };
  assert.strictEqual(mapGeckoPoolToToken(solPool, new Map()), null, 'Wrapped SOL must not appear as a meme coin');

  const enriched = mergeDexScreenerPair(token!, {
    chainId: 'solana',
    baseToken: { address: token!.mint, name: 'FTR', symbol: 'FTR' },
    priceUsd: '0.00381',
    liquidity: { usd: 250000 },
    volume: { h24: 14000000 },
    priceChange: { m5: 1.2, h1: -2, h24: -30 },
    marketCap: 3800000,
  });
  assert.strictEqual(enriched.priceUsd, 0.00381);
  assert.strictEqual(enriched.volume24h, 14000000);

  const ranked = rankUniqueMemeTokens(
    [
      { ...token!, volume24h: 100, mint: 'mintA' },
      { ...token!, volume24h: 500, mint: 'mintA' },
      { ...token!, symbol: 'LOOM', mint: 'mintB', volume24h: 200 },
    ],
    25
  );
  assert.strictEqual(ranked.length, 2);
  assert.strictEqual(ranked[0].mint, 'mintA');
  assert.strictEqual(ranked[0].volume24h, 500);
  console.log('  ✔ Live DEX mapping ranks unique Solana meme mints by 24h volume');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
