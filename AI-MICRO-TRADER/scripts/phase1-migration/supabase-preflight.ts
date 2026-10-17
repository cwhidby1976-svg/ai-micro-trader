import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireSupabase } from '../../src/server/supabase';

async function main() {
  const local = JSON.parse(
    readFileSync(resolve('data/licensing_db.json'), 'utf8')
  );

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

  let issues = 0;

  console.log('\n===== SUPABASE READ-ONLY PREFLIGHT =====');

  for (const [source, table] of mappings) {
    const records = Array.isArray(local[source]) ? local[source] : [];

    const { count, error } = await requireSupabase()
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (error || count === null) {
      console.log(`${table}: CHECK FAILED`);
      issues++;
      continue;
    }

    console.log(`${table}: local=${records.length}, remote=${count}`);

    // Check ID conflicts without printing actual IDs.
    const ids = records
      .map((record: any) =>
        source === 'userApiKeys' ? record.ownerId : record.id
      )
      .filter((id: unknown): id is string =>
        typeof id === 'string' && id.length > 0
      );

    if (ids.length !== records.length ||
        new Set(ids).size !== ids.length) {
      console.log(`  LOCAL ID VALIDATION FAILED`);
      issues++;
      continue;
    }

    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);

      const { data, error: lookupError } = await requireSupabase()
        .from(table)
        .select('id')
        .in('id', batch);

      if (lookupError) {
        console.log('  ID LOOKUP FAILED');
        issues++;
        break;
      }

      if (data && data.length > 0) {
        console.log(`  EXISTING ID CONFLICTS: ${data.length}`);
        issues++;
      }
    }
  }

  const { count: stateCount, error: stateError } = await requireSupabase()
    .from('amt_server_state')
    .select('id', { count: 'exact', head: true });

  if (stateError || stateCount === null) {
    console.log('amt_server_state: CHECK FAILED');
    issues++;
  } else {
    console.log(`amt_server_state: remote=${stateCount}`);
    if (stateCount > 0) {
      console.log('  EXISTING SERVER STATE REQUIRES REVIEW');
      issues++;
    }
  }

  console.log(`\nPreflight issues: ${issues}`);
  console.log('Database writes performed: 0');
  console.log(
    issues === 0
      ? 'READ-ONLY PREFLIGHT PASSED'
      : 'PREFLIGHT REQUIRES REVIEW'
  );

  if (issues > 0) process.exitCode = 1;
}

main().catch(() => {
  console.error('PREFLIGHT FAILED - check configuration or connectivity');
  process.exitCode = 1;
});
