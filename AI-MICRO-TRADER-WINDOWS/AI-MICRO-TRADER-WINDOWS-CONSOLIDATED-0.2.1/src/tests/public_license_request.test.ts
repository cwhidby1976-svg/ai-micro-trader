import assert from 'assert';
import { decidePublicLicenseRequest } from '../server/publicLicenseRequest';

console.log('▶ Public license request policy');

const trial = decidePublicLicenseRequest('Trial');
assert.strictEqual(trial.allowed, true);
if (trial.allowed) assert.strictEqual(trial.plan, 'Trial');

const omitted = decidePublicLicenseRequest(undefined);
assert.strictEqual(omitted.allowed, true);

const annual = decidePublicLicenseRequest('Annual');
assert.strictEqual(annual.allowed, false);
if (!annual.allowed) {
  assert.strictEqual(annual.status, 403);
  assert(annual.error.includes('Paid access keys'));
}

const lifetime = decidePublicLicenseRequest('Lifetime');
assert.strictEqual(lifetime.allowed, false);

console.log('  ✔ Trial allowed; Annual and Lifetime rejected without payment');
