import type { SQLiteDatabase } from 'expo-sqlite';

import type { LedgerRepository } from '../data/repositories/ledger-repository';
import { convertMoney } from '../domain/money/money';
import { resolveHistoricalRate } from './historical-rate';

export async function fillPendingFxRates(
  db: SQLiteDatabase,
  repository: LedgerRepository,
  resolve = resolveHistoricalRate,
): Promise<number> {
  const household = await repository.getActiveHousehold();
  if (!household) return 0;
  const pending = (await repository.listTransactions(household.id))
    .filter((transaction) => transaction.status === 'fx_pending' && !transaction.fxSnapshot);
  let completed = 0;

  for (const transaction of pending) {
    try {
      const rate = await resolve(db, transaction.originalAmount.currency, household.baseCurrency, transaction.transactionDate);
      const reportingAmount = convertMoney(transaction.originalAmount, household.baseCurrency, rate.rateDecimal);
      const updated = await repository.completePendingFx(transaction.id, reportingAmount, {
        rateDecimal: rate.rateDecimal,
        provider: rate.provider,
        requestedDate: rate.requestedDate,
        effectiveDate: rate.effectiveDate,
      }, new Date().toISOString());
      if (updated) completed += 1;
    } catch {
      // One unavailable pair must not block other pending transactions or app startup.
    }
  }
  return completed;
}
