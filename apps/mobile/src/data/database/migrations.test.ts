import { describe, expect, it, vi } from 'vitest';

import { DATABASE_VERSION, migrateDatabase } from './migrations';

function createDatabase(version = 0) {
  let userVersion = version;
  const appliedVersions: number[] = [];

  const transaction = {
    execAsync: vi.fn(async (sql: string) => {
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

  return { appliedVersions, database, getVersion: () => userVersion };
}

describe('migrateDatabase', () => {
  it('applies pending migrations and records the schema version', async () => {
    const state = createDatabase();

    await migrateDatabase(state.database as never);

    expect(state.appliedVersions).toEqual([1]);
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
});
