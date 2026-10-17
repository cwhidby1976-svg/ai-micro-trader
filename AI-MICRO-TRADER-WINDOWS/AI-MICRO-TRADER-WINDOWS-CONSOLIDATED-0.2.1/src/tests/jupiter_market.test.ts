import assert from 'assert';
import { loadMarketSnapshot, solUsdFromUsdcOut, tokenUsdFromSolQuote } from '../services/jupiterMarket';

async function run() {
  console.log('▶ Jupiter quote math');

  const solUsd = solUsdFromUsdcOut('10425760', 100_000_000);
  assert(solUsd > 50 && solUsd < 500, 'SOL/USD from a 0.1 SOL → USDC quote must be a plausible live price');
  assert.strictEqual(solUsdFromUsdcOut('0'), 0);
  assert.strictEqual(solUsdFromUsdcOut('abc'), 0);

  const bonkUsd = tokenUsdFromSolQuote('25000000000', 5, 100, 100_000_000);
  assert(bonkUsd > 0, 'Token USD price must be derived from quote outAmount');
  assert.strictEqual(tokenUsdFromSolQuote('0', 6, 100), 0);

  console.log(`  ✔ SOL/USD from fixture quote = ${solUsd}`);
  console.log('  ✔ Invalid quotes do not invent a price');

  const withoutKey = await loadMarketSnapshot({});
  assert.strictEqual(withoutKey.ok, false);
  assert(withoutKey.error?.toLowerCase().includes('key'));
  console.log('  ✔ Market snapshot refuses to run without a user Jupiter key');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
