import assert from 'assert';
import { DISCLAIMER_SECTIONS, isPublicDisclaimerPath } from '../components/RiskDisclaimer';

async function run() {
  console.log('▶ Public risk disclaimer route');
  assert.strictEqual(isPublicDisclaimerPath('/disclaimer'), true);
  assert.strictEqual(isPublicDisclaimerPath('/disclaimer/'), true);
  assert.strictEqual(isPublicDisclaimerPath('/', '#disclaimer'), true);
  assert.strictEqual(isPublicDisclaimerPath('/'), false);
  assert.strictEqual(isPublicDisclaimerPath('/dashboard'), false);
  assert.strictEqual(DISCLAIMER_SECTIONS.length, 12, 'All 12 disclaimer sections must be published');
  const titles = DISCLAIMER_SECTIONS.map((s) => s.title).join(' ');
  assert(titles.includes('No Financial or Investment Advice'));
  assert(titles.includes('No Guaranteed Earnings'));
  assert(titles.includes('Paper Trading'));
  assert(DISCLAIMER_SECTIONS.some((s) => s.emphasis?.includes('cannot afford to lose')));
  console.log('  ✔ /disclaimer is public and contains the full 12-section disclosure');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
