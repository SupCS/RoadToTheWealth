import { describe, expect, it, vi } from 'vitest';

import type { LedgerRepository, Transaction } from '../data/repositories/ledger-repository';
import { money } from '../domain/money/money';

import { fillPendingFxRates } from './pending-fx';

const transaction: Transaction = {
  id: 'transaction-1', householdId: 'household-1', accountId: 'account-1', memberId: 'member-1', categoryId: null,
  transactionType: 'expense', transactionDate: '2026-08-30', postingDate: null, source: 'manual', status: 'fx_pending',
  originalAmount: money(-1000n, 'USD'), reportingAmount: null, fxSnapshot: null, description: null, notes: null,
  createdAt: '2026-08-30T10:00:00.000Z', updatedAt: '2026-08-30T10:00:00.000Z', createdByMemberId: 'member-1',
  updatedByMemberId: 'member-1', revision: 1, deletedAt: null,
};

describe('fillPendingFxRates', () => {
  it('completes an offline transaction without changing its original money', async () => {
    const completePendingFx = vi.fn(async () => true);
    const repository = {
      getActiveHousehold: vi.fn(async () => ({ id: 'household-1', baseCurrency: 'GEL' })),
      listTransactions: vi.fn(async () => [transaction]),
      completePendingFx,
    } as unknown as LedgerRepository;
    const resolve = vi.fn(async () => ({
      base: 'USD', quote: 'GEL', requestedDate: '2026-08-30', effectiveDate: '2026-08-28',
      rateDecimal: '2.7', provider: 'frankfurter', fetchedAt: '2026-09-01T00:00:00.000Z',
    } as const));

    expect(await fillPendingFxRates({} as never, repository, resolve)).toBe(1);
    expect(transaction.originalAmount).toEqual(money(-1000n, 'USD'));
    expect(completePendingFx).toHaveBeenCalledWith(
      'transaction-1', money(-2700n, 'GEL'),
      expect.objectContaining({ effectiveDate: '2026-08-28', rateDecimal: '2.7' }), expect.any(String),
    );
  });

  it('keeps pending writes untouched when the network is still unavailable', async () => {
    const completePendingFx = vi.fn();
    const repository = {
      getActiveHousehold: vi.fn(async () => ({ id: 'household-1', baseCurrency: 'GEL' })),
      listTransactions: vi.fn(async () => [transaction]),
      completePendingFx,
    } as unknown as LedgerRepository;
    const resolve = vi.fn(async () => { throw new Error('offline'); });

    expect(await fillPendingFxRates({} as never, repository, resolve)).toBe(0);
    expect(completePendingFx).not.toHaveBeenCalled();
  });
});
