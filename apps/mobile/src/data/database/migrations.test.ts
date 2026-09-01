import { describe, expect, it, vi } from 'vitest';

import { DATABASE_VERSION, migrateDatabase } from './migrations';

function createDatabase(version = 0) {
  let userVersion = version;
  const appliedVersions: number[] = [];
  const executedSql: string[] = [];

  const transaction = {
    execAsync: vi.fn(async (sql: string) => {
      executedSql.push(sql);
      const match = sql.match(/PRAGMA user_version = (\d+)/);
      if (match) userVersion = Number(match[1]);
    }),
    runAsync: vi.fn(async (_sql: string, migrationVersion: number) => {
      appliedVersions.push(migrationVersion);
      return { changes: 1, lastInsertRowId: migrationVersion };
    }),
  };

  const database = {
    execAsync: vi.fn(async () => undefined),
    getFirstAsync: vi.fn(async () => ({ user_version: userVersion })),
    withExclusiveTransactionAsync: vi.fn(async (task: (tx: typeof transaction) => Promise<void>) => task(transaction)),
  };

  return { appliedVersions, database, executedSql, getVersion: () => userVersion };
}

describe('migrateDatabase', () => {
  it('applies pending migrations and records the schema version', async () => {
    const state = createDatabase();

    await migrateDatabase(state.database as never);

    expect(state.appliedVersions).toEqual([1, 2, 3, 4]);
    expect(state.getVersion()).toBe(DATABASE_VERSION);
  });

  it('is repeatable when the database is already current', async () => {
    const state = createDatabase(DATABASE_VERSION);

    await migrateDatabase(state.database as never);

    expect(state.appliedVersions).toEqual([]);
    expect(state.database.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('refuses to open a database created by a newer app version', async () => {
    const state = createDatabase(DATABASE_VERSION + 1);

    await expect(migrateDatabase(state.database as never)).rejects.toThrow('newer than supported');
  });

  it('creates the complete offline-ledger schema in migration 2', async () => {
    const state = createDatabase(1);

    await migrateDatabase(state.database as never);

    const schemaSql = state.executedSql.join('\n');
    for (const table of ['households', 'household_members', 'accounts', 'categories', 'transactions', 'transaction_splits']) {
      expect(schemaSql).toContain(`CREATE TABLE ${table}`);
    }
    expect(schemaSql).toContain("ownership_scope IN ('personal', 'shared')");
    expect(schemaSql).toContain('amount_minor INTEGER NOT NULL');
    expect(schemaSql).toContain('revision INTEGER NOT NULL DEFAULT 1');
    expect(schemaSql).toContain('deleted_at TEXT');
    expect(state.appliedVersions).toEqual([2, 3, 4]);
  });

  it('adds localized built-in categories in migration 3', async () => {
    const state = createDatabase(2);
    await migrateDatabase(state.database as never);

    const sql = state.executedSql.join('\n');
    expect(sql).toContain("'Groceries', 'Продукти', 'Продукты'");
    expect(sql).toContain("'Salary', 'Зарплата', 'Зарплата'");
    expect(sql).toContain('categories_system_key_idx');
    expect(state.appliedVersions).toEqual([3, 4]);
  });

  it('adds durable links for atomic two-leg transfers in migration 4', async () => {
    const state = createDatabase(3);
    await migrateDatabase(state.database as never);

    const sql = state.executedSql.join('\n');
    expect(sql).toContain('CREATE TABLE transfer_links');
    expect(sql).toContain('debit_transaction_id TEXT NOT NULL UNIQUE');
    expect(sql).toContain('received_amount_minor INTEGER NOT NULL');
    expect(state.appliedVersions).toEqual([4]);
  });
});
