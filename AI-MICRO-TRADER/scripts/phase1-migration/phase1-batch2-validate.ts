/**
 * AI Micro Trader — Phase 1 / Batch 2 migration readiness validator.
 * READ ONLY: reads local licensing JSON; does not connect to Supabase,
 * write any files, or print sensitive record values.
 * Run from project root: npx --no-install tsx .\scripts\phase1-migration\phase1-batch2-validate.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Row = Record<string, unknown>;
type Store = Record<string, unknown>;
const groups = ['adminUsers', 'members', 'licenses', 'orders', 'discountCodes', 'discountRedemptions', 'auditLogs', 'userApiKeys'] as const;
const errors: string[] = [];
const warnings: string[] = [];
const goodString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const goodDate = (v: unknown): boolean => goodString(v) && Number.isFinite(Date.parse(v));
const safeArray = (v: unknown, name: string): Row[] => {
  if (!Array.isArray(v)) { errors.push(`${name}: missing or invalid collection`); return []; }
  if (v.some(x => !x || typeof x !== 'object' || Array.isArray(x))) {
    errors.push(`${name}: invalid record object`); return v.filter(x => x && typeof x === 'object' && !Array.isArray(x));
  }
  return v as Row[];
};
let db: Store;
try {
  const parsed: unknown = JSON.parse(readFileSync(resolve('data/licensing_db.json'), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid root');
  db = parsed as Store;
} catch {
  console.error('BLOCKED: Could not read valid data/licensing_db.json from project root. No changes made.');
  process.exit(1);
}
const data = Object.fromEntries(groups.map(g => [g, safeArray(db[g], g)])) as Record<typeof groups[number], Row[]>;
const ids = new Map<string, Set<string>>();
for (const group of groups) {
  const seen = new Set<string>();
  for (const row of data[group]) {
    const id = group === 'userApiKeys' ? row.ownerId : row.id;
    if (!goodString(id)) { errors.push(`${group}: record has no stable ID`); continue; }
    if (seen.has(id)) errors.push(`${group}: duplicate ID`);
    seen.add(id);
  }
  ids.set(group, seen);
}
function uniqueNormalized(group: typeof groups[number], field: string): void {
  const seen = new Set<string>();
  for (const row of data[group]) {
    const value = row[field];
    if (!goodString(value)) { errors.push(`${group}: missing ${field}`); continue; }
    const norm = value.trim().toLowerCase();
    if (seen.has(norm)) errors.push(`${group}: duplicate ${field} (case-insensitive)`);
    seen.add(norm);
  }
}
uniqueNormalized('adminUsers', 'username');
uniqueNormalized('members', 'email');
uniqueNormalized('discountCodes', 'code');
for (const group of ['adminUsers', 'members'] as const) {
  for (const row of data[group]) {
    if (!goodString(row.passwordHash) || !goodString(row.salt)) errors.push(`${group}: missing password hash or salt`);
    if (!goodDate(row.createdAt)) errors.push(`${group}: invalid createdAt`);
  }
}
const memberIds = ids.get('members')!;
const licenseIds = ids.get('licenses')!;
const licenseAssignments = new Map<string, string>();
for (const member of data.members) {
  if (member.licenseId == null || member.licenseId === '') continue;
  if (!goodString(member.licenseId) || !licenseIds.has(member.licenseId)) {
    errors.push('members: license reference not found'); continue;
  }
  if (licenseAssignments.has(member.licenseId)) errors.push('licenses: assigned to multiple members');
  else licenseAssignments.set(member.licenseId, String(member.id));
}
for (const license of data.licenses) {
  if (!goodDate(license.createdAt)) errors.push('licenses: invalid createdAt');
  if (!goodString(license.codeHash) || !goodString(license.codePrefix)) errors.push('licenses: missing code hash/prefix');
  if (!Array.isArray(license.devices)) errors.push('licenses: invalid devices list');
}
for (const order of data.orders) {
  if (!goodDate(order.createdAt)) errors.push('orders: invalid createdAt');
  if (order.memberId != null && (!goodString(order.memberId) || !memberIds.has(order.memberId))) errors.push('orders: missing referenced member');
  if (!goodString(order.status)) errors.push('orders: missing status');
}
const discountIds = ids.get('discountCodes')!;
for (const discount of data.discountCodes) {
  if (!goodDate(discount.createdAt)) errors.push('discountCodes: invalid createdAt');
  const pct = discount.percentage, max = discount.maxUses, used = discount.usedCount;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 1 || pct > 50 ||
      typeof max !== 'number' || !Number.isInteger(max) || max <= 0 ||
      typeof used !== 'number' || !Number.isInteger(used) || used < 0 || used > max ||
      typeof discount.active !== 'boolean') errors.push('discountCodes: invalid constrained fields');
}
for (const redemption of data.discountRedemptions) {
  if (!goodDate(redemption.redeemedAt)) errors.push('discountRedemptions: invalid redeemedAt');
  if (!goodString(redemption.discountCodeId) || !discountIds.has(redemption.discountCodeId)) errors.push('discountRedemptions: unknown discount code');
  if (!goodString(redemption.memberId) || !memberIds.has(redemption.memberId)) errors.push('discountRedemptions: unknown member');
  if (!goodString(redemption.orderId) || !ids.get('orders')!.has(redemption.orderId)) errors.push('discountRedemptions: unknown order');
}
for (const log of data.auditLogs) if (!goodDate(log.timestamp)) errors.push('auditLogs: invalid timestamp');
let unmatchedOwners = 0;
let unmatchedWithEncryptedCredentials = 0;
for (const key of data.userApiKeys) {
  if (!goodDate(key.updatedAt)) errors.push('userApiKeys: missing valid updatedAt (avoid invented migration timestamps)');
  if (!memberIds.has(String(key.ownerId)) && !ids.get('adminUsers')!.has(String(key.ownerId))) {
    unmatchedOwners++;
    if (Object.keys(key).some(k => k.endsWith('Encrypted') && goodString(key[k]))) unmatchedWithEncryptedCredentials++;
  }
}
if (!goodString(db.serverSecret)) errors.push('server state: missing original signing/encryption secret');
if (!db.config || typeof db.config !== 'object' || Array.isArray(db.config)) errors.push('server state: invalid configuration');
if (db.version != null && (typeof db.version !== 'number' || !Number.isInteger(db.version) || db.version < 1)) errors.push('server state: invalid version');
if (unmatchedOwners) warnings.push(`${unmatchedOwners} API credential owners do not match existing admin/member IDs; preserve as-is (${unmatchedWithEncryptedCredentials} have encrypted fields).`);
console.log('\n===== PHASE 1 / BATCH 2 — READ-ONLY VALIDATION =====');
for (const group of groups) console.log(`${group}: ${data[group].length}`);
console.log(`Total source records: ${groups.reduce((n,g) => n + data[g].length, 0)}`);
console.log(`Server state records planned: 1`);
console.log(`Customer-license relationships: ${licenseAssignments.size}`);
console.log(`Validation errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);
for (const msg of errors) console.log(`ERROR: ${msg}`);
for (const msg of warnings) console.log(`WARNING: ${msg}`);
console.log('Supabase connections: 0');
console.log('Database writes: 0');
console.log(errors.length ? 'BLOCKED — resolve errors before migration' : 'LOCAL VALIDATION PASSED — NOT AUTHORIZATION TO MIGRATE');
if (errors.length) process.exitCode = 1;
