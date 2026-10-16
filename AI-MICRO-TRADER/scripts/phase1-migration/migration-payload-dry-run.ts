import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type RecordData = Record<string, any>;

const local: RecordData = JSON.parse(
  readFileSync(resolve('data/licensing_db.json'), 'utf8')
);

const issues: string[] = [];

const mappings = [
  ['adminUsers', 'amt_admin_users'],
  ['members', 'amt_members'],
  ['licenses', 'amt_licenses'],
  ['orders', 'amt_orders'],
  ['discountCodes', 'amt_discount_codes'],
  ['discountRedemptions', 'amt_discount_redemptions'],
  ['auditLogs', 'amt_audit_logs'],
  ['userApiKeys', 'amt_user_api_keys'],
] as const;

const rows = new Map<string, RecordData[]>();

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDate(value: unknown): boolean {
  return typeof value === 'string' &&
    Number.isFinite(Date.parse(value));
}

function requiredDate(
  value: unknown,
  context: string
): string | undefined {
  if (!validDate(value)) {
    issues.push(`${context}: invalid required date`);
    return undefined;
  }
  return value as string;
}

for (const [source, table] of mappings) {
  const records = local[source];

  if (!Array.isArray(records)) {
    issues.push(`${source}: source collection is not an array`);
    rows.set(table, []);
    continue;
  }

  const seen = new Set<string>();
  const result: RecordData[] = [];

  for (const record of records) {
    const id = source === 'userApiKeys'
      ? record?.ownerId
      : record?.id;

    if (!validId(id)) {
      issues.push(`${source}: missing ID`);
      continue;
    }

    if (seen.has(id)) {
      issues.push(`${source}: duplicate ID`);
      continue;
    }

    seen.add(id);

    const row: RecordData = {
      id,
      data: { ...record },
    };

    if (source === 'adminUsers') {
      row.username = record.username;
      row.created_at = requiredDate(record.createdAt, source);
      if (!validId(record.username) ||
          !validId(record.passwordHash) ||
          !validId(record.salt)) {
        issues.push('Administrator required fields invalid');
      }
    }

    if (source === 'members') {
      row.email = record.email;
      row.created_at = requiredDate(record.createdAt, source);
      if (!validId(record.email) ||
          !validId(record.passwordHash) ||
          !validId(record.salt)) {
        issues.push('Customer required fields invalid');
      }
    }

    if (source === 'licenses') {
      row.member_id = null;
      row.created_at = requiredDate(record.createdAt, source);
      if (!validId(record.codeHash) ||
          !validId(record.codePrefix)) {
        issues.push('License required fields invalid');
      }
    }

    if (source === 'orders') {
      row.member_id = record.memberId ?? null;
      row.status = record.status ?? null;
      row.created_at = requiredDate(record.createdAt, source);
    }

    if (source === 'discountCodes') {
      row.code = record.code;
      row.percentage = record.percentage;
      row.max_uses = record.maxUses;
      row.used_count = record.usedCount;
      row.active = record.active;
      row.created_at = requiredDate(record.createdAt, source);

      if (!validId(record.code) ||
          typeof record.percentage !== 'number' ||
          record.percentage < 1 ||
          record.percentage > 50 ||
          !Number.isInteger(record.maxUses) ||
          record.maxUses <= 0 ||
          !Number.isInteger(record.usedCount) ||
          record.usedCount < 0 ||
          record.usedCount > record.maxUses ||
          typeof record.active !== 'boolean') {
        issues.push('Discount code violates database constraints');
      }
    }

    if (source === 'discountRedemptions') {
      row.discount_code_id = record.discountCodeId;
      row.member_id = record.memberId;
      row.order_id = record.orderId;
      row.redeemed_at = requiredDate(record.redeemedAt, source);
    }

    if (source === 'auditLogs') {
      row.created_at = requiredDate(record.timestamp, source);
    }

    if (source === 'userApiKeys') {
      row.created_at = validDate(record.updatedAt)
        ? record.updatedAt
        : new Date().toISOString();
    }

    result.push(row);
  }

  rows.set(table, result);
}

const licenses = rows.get('amt_licenses') ?? [];
const licenseMap = new Map(licenses.map(row => [row.id, row]));
const assigned = new Map<string, string>();

for (const member of local.members ?? []) {
  if (!member.licenseId) continue;

  const license = licenseMap.get(member.licenseId);
  if (!license) {
    issues.push('Customer references missing license');
    continue;
  }

  if (assigned.has(member.licenseId)) {
    issues.push('License assigned to multiple customers');
    continue;
  }

  assigned.set(member.licenseId, member.id);
  license.member_id = member.id;
}

if (!validId(local.serverSecret)) {
  issues.push('Original signing secret missing');
}

if (!local.config ||
    typeof local.config !== 'object' ||
    Array.isArray(local.config)) {
  issues.push('Server configuration invalid');
}

const stateRow = {
  id: 1,
  version: local.version ?? 2,
  server_secret: local.serverSecret,
  config: local.config,
};

if (!Number.isInteger(stateRow.version) ||
    stateRow.version < 1) {
  issues.push('Server state version invalid');
}

console.log('\n===== MIGRATION PAYLOAD DRY RUN =====');

let total = 0;
for (const [source, table] of mappings) {
  const count = rows.get(table)?.length ?? 0;
  total += count;
  console.log(`${source} -> ${table}: ${count}`);
}

console.log(`Server state rows prepared: 1`);
console.log(`License relationships mapped: ${assigned.size}`);
console.log(`Total source records prepared: ${total}`);
console.log(`Validation issues: ${issues.length}`);
console.log('Database writes performed: 0');

for (const issue of issues) {
  console.log(`ISSUE: ${issue}`);
}

console.log(
  issues.length === 0 && total === 70
    ? 'MIGRATION PAYLOAD DRY RUN PASSED'
    : 'MIGRATION PAYLOAD REQUIRES REVIEW'
);

if (issues.length > 0 || total !== 70) {
  process.exitCode = 1;
}
