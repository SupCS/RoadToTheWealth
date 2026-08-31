import { describe, expect, it, vi } from 'vitest';

import { seedDevelopmentData } from './development-seed';

function createDatabase(householdCount: number) {
  const transaction = {
    runAsync: vi.fn(async (..._args: unknown[]) => ({ changes: 1, lastInsertRowId: 0 })),
  };
  return {
    getFirstAsync: vi.fn(async (..._args: unknown[]) => ({ count: householdCount })),
    transaction,
    withExclusiveTransactionAsync: vi.fn(async (task: (db: typeof transaction) => Promise<void>) => task(transaction)),
  };
}

describe('seedDevelopmentData', () => {
  it('does nothing without explicit opt-in', async () => {
    const db = createDatabase(0);
    expect(await seedDevelopmentData(db as never, { explicitlyEnabled: false })).toBe('disabled');
    expect(db.getFirstAsync).not.toHaveBeenCalled();
  });

  it('does not mix fixtures into a non-empty database', async () => {
    const db = createDatabase(1);
    expect(await seedDevelopmentData(db as never, { explicitlyEnabled: true })).toBe('database-not-empty');
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('creates anonymous fixtures atomically in an empty database', async () => {
    const db = createDatabase(0);
    expect(await seedDevelopmentData(db as never, { explicitlyEnabled: true })).toBe('created');
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledOnce();
    expect(db.transaction.runAsync).toHaveBeenCalledTimes(3);
  });
});
