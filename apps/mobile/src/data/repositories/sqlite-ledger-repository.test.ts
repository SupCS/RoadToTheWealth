import { describe, expect, it, vi } from 'vitest';

import { money } from '../../domain/money/money';

import { SQLiteLedgerRepository } from './sqlite-ledger-repository';

function createDatabase(rows: unknown[] = []) {
  const transactionDb = {
    runAsync: vi.fn(async (..._args: unknown[]) => ({ changes: 1, lastInsertRowId: 0 })),
  };
  return {
    getAllAsync: vi.fn(async (..._args: unknown[]) => rows),
    runAsync: vi.fn(async (..._args: unknown[]) => ({ changes: 1, lastInsertRowId: 0 })),
    transactionDb,
    withExclusiveTransactionAsync: vi.fn(async (task: (db: typeof transactionDb) => Promise<void>) => task(transactionDb)),
  };
}

const audit = {
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  createdByMemberId: 'member-1', updatedByMemberId: 'member-1', revision: 1, deletedAt: null,
} as const;

describe('SQLiteLedgerRepository', () => {
  it('binds minor units as a decimal string without converting through number', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);

    await repository.saveAccount({
      id: 'account-1', householdId: 'household-1', ownershipScope: 'personal',
      ownerMemberId: 'member-1', name: 'Savings', accountType: 'savings',
      primaryCurrency: 'USD', openingBalances: [money(9_007_199_254_740_993n, 'USD')], isArchived: false,
      ...audit,
    });

    expect(db.transactionDb.runAsync.mock.calls.flat()).toContain('9007199254740993');
  });

  it('keeps household and personal balance queries as distinct scopes', async () => {
    const db = createDatabase([{ amount_minor: '1250', currency_code: 'USD' }]);
    const repository = new SQLiteLedgerRepository(db as never);

    const household = await repository.getBalances({ kind: 'household', householdId: 'household-1' });
    await repository.getBalances({ kind: 'personal', householdId: 'household-1', memberId: 'member-1' });

    expect(household[0]?.amountMinor).toBe(1250n);
    expect(db.getAllAsync.mock.calls[0]?.[0]).not.toContain("a.ownership_scope = 'personal'");
    expect(db.getAllAsync.mock.calls[1]?.[0]).toContain("a.ownership_scope = 'personal'");
    expect(db.getAllAsync.mock.calls[1]?.[1]).toEqual(['household-1', 'member-1', 'household-1', 'member-1']);
  });

  it('stores multiple opening currency balances for one account', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);

    await repository.saveAccount({
      id: 'account-1', householdId: 'household-1', ownershipScope: 'personal',
      ownerMemberId: 'member-1', name: 'Wallet', accountType: 'current',
      primaryCurrency: 'USD', openingBalances: [money(1000n, 'USD'), money(2500n, 'GEL')], isArchived: false,
      ...audit,
    });

    expect(db.transactionDb.runAsync).toHaveBeenCalledTimes(4);
    expect(db.transactionDb.runAsync.mock.calls.flat()).toContain('USD');
    expect(db.transactionDb.runAsync.mock.calls.flat()).toContain('GEL');
  });

  it('rejects duplicate currency balances before writing an account', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);

    await expect(repository.saveAccount({
      id: 'account-1', householdId: 'household-1', ownershipScope: 'personal',
      ownerMemberId: 'member-1', name: 'Wallet', accountType: 'current',
      primaryCurrency: 'USD', openingBalances: [money(1000n, 'USD'), money(2000n, 'USD')], isArchived: false,
      ...audit,
    })).rejects.toThrow('unique');
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('maps account summaries without losing current balance precision', async () => {
    const db = createDatabase();
    const accountRow = {
      id: 'account-1', household_id: 'household-1', ownership_scope: 'shared', owner_member_id: null,
      name: 'Reserve', account_type: 'savings', opening_balance_minor: '0', currency_code: 'USD',
      is_archived: 0, ...{
        created_at: audit.createdAt, updated_at: audit.updatedAt, created_by_member_id: null,
        updated_by_member_id: null, revision: 1, deleted_at: null,
      },
    };
    db.getAllAsync
      .mockResolvedValueOnce([accountRow])
      .mockResolvedValueOnce([{ account_id: 'account-1', amount_minor: '0', currency_code: 'USD' }])
      .mockResolvedValueOnce([{ account_id: 'account-1', amount_minor: '9007199254740993', currency_code: 'USD' }]);
    const repository = new SQLiteLedgerRepository(db as never);

    const summaries = await repository.listAccountSummaries('household-1');

    expect(summaries[0]?.currentBalances[0]?.amountMinor).toBe(9_007_199_254_740_993n);
  });

  it('writes a transaction and its splits in one exclusive transaction', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);
    const transaction = {
      id: 'transaction-1', householdId: 'household-1', accountId: 'account-1', memberId: 'member-1',
      categoryId: null, transactionType: 'expense', transactionDate: '2026-09-01', postingDate: null,
      source: 'manual', status: 'confirmed', originalAmount: money(-1000n, 'USD'), reportingAmount: null,
      fxSnapshot: null, description: null, notes: null, ...audit,
    } as const;
    const splits = [
      { id: 'split-1', householdId: 'household-1', transactionId: 'transaction-1', categoryId: 'food', amount: money(-600n, 'USD'), ...audit },
      { id: 'split-2', householdId: 'household-1', transactionId: 'transaction-1', categoryId: 'transport', amount: money(-400n, 'USD'), ...audit },
    ];

    await repository.saveTransaction(transaction, splits);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledOnce();
    expect(db.transactionDb.runAsync).toHaveBeenCalledTimes(3);
  });

  it('rejects mismatched splits before starting a database transaction', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);
    const transaction = {
      id: 'transaction-1', householdId: 'household-1', accountId: 'account-1', memberId: null,
      categoryId: null, transactionType: 'expense', transactionDate: '2026-09-01', postingDate: null,
      source: 'manual', status: 'confirmed', originalAmount: money(-1000n, 'USD'), reportingAmount: null,
      fxSnapshot: null, description: null, notes: null, ...audit,
    } as const;
    const splits = [
      { id: 'split-1', householdId: 'household-1', transactionId: 'transaction-1', categoryId: 'food', amount: money(-999n, 'USD'), ...audit },
    ];

    await expect(repository.saveTransaction(transaction, splits)).rejects.toThrow('sum exactly');
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['expense', 1000n],
    ['income', -1000n],
    ['income', 0n],
  ] as const)('rejects an invalid sign for a %s transaction', async (transactionType, amountMinor) => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);

    await expect(repository.saveTransaction({
      id: 'transaction-1', householdId: 'household-1', accountId: 'account-1', memberId: 'member-1',
      categoryId: null, transactionType, transactionDate: '2026-09-01', postingDate: null,
      source: 'manual', status: 'confirmed', originalAmount: money(amountMinor, 'USD'), reportingAmount: money(amountMinor, 'USD'),
      fxSnapshot: null, description: null, notes: null, ...audit,
    }, [])).rejects.toThrow(transactionType === 'expense' ? 'negative' : 'positive');
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('writes two matching transfer legs and their link atomically', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);
    const debit = {
      id: 'debit-1', householdId: 'household-1', accountId: 'account-1', memberId: 'member-1',
      categoryId: null, transactionType: 'transfer', transactionDate: '2026-09-01', postingDate: null,
      source: 'manual', status: 'confirmed', originalAmount: money(-2500n, 'USD'), reportingAmount: null,
      fxSnapshot: null, description: null, notes: null, ...audit,
    } as const;
    const credit = { ...debit, id: 'credit-1', accountId: 'account-2', originalAmount: money(2500n, 'USD') } as const;

    await repository.saveTransfer(debit, credit, {
      id: 'transfer-1', householdId: 'household-1', debitTransactionId: debit.id,
      creditTransactionId: credit.id, sentAmount: money(2500n, 'USD'), receivedAmount: money(2500n, 'USD'), ...audit,
    });

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledOnce();
    expect(db.transactionDb.runAsync).toHaveBeenCalledTimes(3);
  });

  it('rejects a transfer that changes currency before writing anything', async () => {
    const db = createDatabase();
    const repository = new SQLiteLedgerRepository(db as never);
    const debit = {
      id: 'debit-1', householdId: 'household-1', accountId: 'account-1', memberId: 'member-1',
      categoryId: null, transactionType: 'transfer', transactionDate: '2026-09-01', postingDate: null,
      source: 'manual', status: 'confirmed', originalAmount: money(-2500n, 'USD'), reportingAmount: null,
      fxSnapshot: null, description: null, notes: null, ...audit,
    } as const;
    const credit = { ...debit, id: 'credit-1', accountId: 'account-2', originalAmount: money(2300n, 'EUR') } as const;

    await expect(repository.saveTransfer(debit, credit, {
      id: 'transfer-1', householdId: 'household-1', debitTransactionId: debit.id,
      creditTransactionId: credit.id, sentAmount: money(2500n, 'USD'), receivedAmount: money(2300n, 'EUR'), ...audit,
    })).rejects.toThrow('preserve amount and currency');
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});
