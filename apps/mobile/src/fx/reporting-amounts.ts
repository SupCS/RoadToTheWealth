import type { SQLiteDatabase } from 'expo-sqlite';

import type { Transaction } from '@/src/data/repositories/ledger-repository';
import type { MoneyCurrencyCode } from '@/src/domain/money/currencies';
import { convertMoney, type Money } from '@/src/domain/money/money';
import { resolveHistoricalRate } from '@/src/fx/historical-rate';

export async function deriveReportingAmounts(
  db: SQLiteDatabase,
  transactions: Transaction[],
  reportingCurrency: MoneyCurrencyCode,
): Promise<Record<string, Money>> {
  const entries = await Promise.all(transactions.map(async (transaction): Promise<[string, Money] | null> => {
    if (transaction.originalAmount.currency === reportingCurrency) return [transaction.id, transaction.originalAmount];
    if (transaction.reportingAmount?.currency === reportingCurrency) return [transaction.id, transaction.reportingAmount];
    try {
      const rate = await resolveHistoricalRate(db, transaction.originalAmount.currency, reportingCurrency, transaction.transactionDate);
      return [transaction.id, convertMoney(transaction.originalAmount, reportingCurrency, rate.rateDecimal)];
    } catch {
      return null;
    }
  }));
  return Object.fromEntries(entries.filter((entry): entry is [string, Money] => entry !== null));
}
