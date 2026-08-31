import { describe, expect, it, vi } from 'vitest';

import { money } from '../../domain/money/money';

import { SQLiteLedgerRepository } from './sqlite-ledger-repository';

function createDatabase(rows: unknown[] = []) {
  return {
    getAllAsync: vi.fn(async (..._args: unknown[]) => rows),
    runAsync: vi.fn(async (..._args: unknown[]) => ({ changes: 1, lastInsertRowId: 0 })),
  };
}

describe('SQLiteLedgerRepository', () => {
  it('binds minor units as a decimal string without converting through number', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);

    await repository.saveAccount({
      id: 'account-1', householdId: 'household-1', ownershipScope: 'personal',
      ownerMemberId: 'member-1', name: 'Savings', accountType: 'savings',
      openingBalance: money(9_007_199_254_740_993n, 'USD'), isArchived: false,
      createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
      createdByMemberId: 'member-1', updatedByMemberId: 'member-1', revision: 1, deletedAt: null,
    });

    expect(db.runAsync.mock.calls[0]).toContain('9007199254740993');
  });

  it('keeps household and personal balance queries as distinct scopes', async () => {
    const db = createDatabase([{ amount_minor: '1250', currency_code: 'USD' }]);
    const repository = new SQLiteLedgerRepository(db as never);

    const household = await repository.getBalances({ kind: 'household', householdId: 'household-1' });
    await repository.getBalances({ kind: 'personal', householdId: 'household-1', memberId: 'member-1' });

    expect(household[0]?.amountMinor).toBe(1250n);
    expect(db.getAllAsync.mock.calls[0]?.[0]).not.toContain("a.ownership_scope = 'personal'");
    expect(db.getAllAsync.mock.calls[1]?.[0]).toContain("a.ownership_scope = 'personal'");
    expect(db.getAllAsync.mock.calls[1]?.[1]).toEqual(['household-1', 'member-1']);
  });
});
