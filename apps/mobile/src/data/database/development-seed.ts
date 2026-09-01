import type { SQLiteDatabase } from 'expo-sqlite';

type SeedDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'withExclusiveTransactionAsync'>;

export type DevelopmentSeedResult = 'created' | 'disabled' | 'database-not-empty';

/**
 * Creates anonymous development fixtures only after an explicit opt-in.
 * This function is intentionally not called during normal app startup.
 */
export async function seedDevelopmentData(
  db: SeedDatabase,
  options: Readonly<{ explicitlyEnabled: boolean }>,
): Promise<DevelopmentSeedResult> {
  if (!options.explicitlyEnabled) return 'disabled';

  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM households WHERE deleted_at IS NULL',
  );
  if ((row?.count ?? 0) > 0) return 'database-not-empty';

  const timestamp = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO households (
        id, name, base_currency_code, created_at, updated_at,
        created_by_member_id, updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, 1, NULL)`,
      '20000000-0000-4000-8000-000000000001', 'Demo household', 'USD', timestamp, timestamp,
    );
    await transaction.runAsync(
      `INSERT INTO household_members (
        id, household_id, user_id, display_name, role, membership_status,
        created_at, updated_at, created_by_member_id, updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, NULL, ?, 'owner', 'active', ?, ?, NULL, NULL, 1, NULL)`,
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      'Demo member', timestamp, timestamp,
    );
    await transaction.runAsync(
      `INSERT INTO accounts (
        id, household_id, ownership_scope, owner_member_id, name, account_type,
        currency_code, opening_balance_minor, primary_currency_code, is_archived, created_at, updated_at,
        created_by_member_id, updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, 'personal', ?, ?, 'current', 'USD', 0, 'USD', 0, ?, ?, ?, ?, 1, NULL)`,
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'Demo account', timestamp, timestamp,
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
    );
    await transaction.runAsync(
      `INSERT INTO account_currency_balances (
        account_id, currency_code, opening_balance_minor, created_at, updated_at, revision
      ) VALUES (?, 'USD', 0, ?, ?, 1)`,
      '20000000-0000-4000-8000-000000000003', timestamp, timestamp,
    );
  });
  return 'created';
}
