import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'rttw.db';
export const DATABASE_VERSION = 2;

type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync' | 'getFirstAsync' | 'withExclusiveTransactionAsync'>;

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE households (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        base_currency_code TEXT NOT NULL CHECK (length(base_currency_code) = 3),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_member_id TEXT,
        updated_by_member_id TEXT,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        deleted_at TEXT
      );

      CREATE TABLE household_members (
        id TEXT PRIMARY KEY NOT NULL,
        household_id TEXT NOT NULL REFERENCES households(id),
        user_id TEXT,
        display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
        role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
        membership_status TEXT NOT NULL DEFAULT 'active'
          CHECK (membership_status IN ('invited', 'active', 'left', 'removed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_member_id TEXT,
        updated_by_member_id TEXT,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        deleted_at TEXT,
        UNIQUE (household_id, user_id)
      );

      CREATE TABLE accounts (
        id TEXT PRIMARY KEY NOT NULL,
        household_id TEXT NOT NULL REFERENCES households(id),
        ownership_scope TEXT NOT NULL CHECK (ownership_scope IN ('personal', 'shared')),
        owner_member_id TEXT REFERENCES household_members(id),
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        account_type TEXT NOT NULL CHECK (account_type IN (
          'cash', 'debit_card', 'credit_card', 'current', 'savings',
          'deposit', 'investment', 'debt', 'e_wallet', 'custom'
        )),
        currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
        opening_balance_minor INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_member_id TEXT REFERENCES household_members(id),
        updated_by_member_id TEXT REFERENCES household_members(id),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        deleted_at TEXT,
        CHECK (
          (ownership_scope = 'personal' AND owner_member_id IS NOT NULL) OR
          (ownership_scope = 'shared' AND owner_member_id IS NULL)
        )
      );

      CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        household_id TEXT REFERENCES households(id),
        parent_id TEXT REFERENCES categories(id),
        applicability TEXT NOT NULL CHECK (applicability IN ('expense', 'income', 'both')),
        system_key TEXT,
        name_en TEXT NOT NULL CHECK (length(trim(name_en)) > 0),
        name_uk TEXT NOT NULL CHECK (length(trim(name_uk)) > 0),
        name_ru TEXT NOT NULL CHECK (length(trim(name_ru)) > 0),
        icon TEXT,
        color_token TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_member_id TEXT,
        updated_by_member_id TEXT,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        deleted_at TEXT,
        CHECK (household_id IS NOT NULL OR system_key IS NOT NULL)
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY NOT NULL,
        household_id TEXT NOT NULL REFERENCES households(id),
        account_id TEXT NOT NULL REFERENCES accounts(id),
        member_id TEXT REFERENCES household_members(id),
        category_id TEXT REFERENCES categories(id),
        transaction_type TEXT NOT NULL CHECK (transaction_type IN (
          'expense', 'income', 'transfer', 'refund', 'adjustment', 'debt_payment'
        )),
        transaction_date TEXT NOT NULL,
        posting_date TEXT,
        source TEXT NOT NULL CHECK (source IN ('manual', 'import', 'recurring', 'bank_api')),
        status TEXT NOT NULL DEFAULT 'confirmed'
          CHECK (status IN ('planned', 'confirmed', 'fx_pending', 'review')),
        amount_minor INTEGER NOT NULL,
        currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
        reporting_amount_minor INTEGER,
        reporting_currency_code TEXT CHECK (
          reporting_currency_code IS NULL OR length(reporting_currency_code) = 3
        ),
        fx_rate_decimal TEXT,
        fx_provider TEXT,
        fx_requested_date TEXT,
        fx_effective_date TEXT,
        description TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_member_id TEXT REFERENCES household_members(id),
        updated_by_member_id TEXT REFERENCES household_members(id),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        deleted_at TEXT,
        CHECK (
          (reporting_amount_minor IS NULL AND reporting_currency_code IS NULL) OR
          (reporting_amount_minor IS NOT NULL AND reporting_currency_code IS NOT NULL)
        )
      );

      CREATE TABLE transaction_splits (
        id TEXT PRIMARY KEY NOT NULL,
        household_id TEXT NOT NULL REFERENCES households(id),
        transaction_id TEXT NOT NULL REFERENCES transactions(id),
        category_id TEXT NOT NULL REFERENCES categories(id),
        amount_minor INTEGER NOT NULL,
        currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_member_id TEXT REFERENCES household_members(id),
        updated_by_member_id TEXT REFERENCES household_members(id),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        deleted_at TEXT
      );

      CREATE INDEX household_members_household_idx ON household_members(household_id, deleted_at);
      CREATE INDEX accounts_household_idx ON accounts(household_id, deleted_at, is_archived);
      CREATE INDEX accounts_owner_idx ON accounts(household_id, owner_member_id, deleted_at);
      CREATE INDEX categories_household_idx ON categories(household_id, deleted_at, is_archived);
      CREATE INDEX transactions_account_date_idx ON transactions(account_id, transaction_date, deleted_at);
      CREATE INDEX transactions_household_date_idx ON transactions(household_id, transaction_date, deleted_at);
      CREATE INDEX transaction_splits_transaction_idx ON transaction_splits(transaction_id, deleted_at);
    `,
  },
] as const;

export async function migrateDatabase(db: MigrationDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(`Database version ${currentVersion} is newer than supported version ${DATABASE_VERSION}.`);
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        migration.version,
        new Date().toISOString(),
      );
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    currentVersion = migration.version;
  }
}
