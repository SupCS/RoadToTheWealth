import type { SQLiteDatabase } from 'expo-sqlite';

import type { MoneyCurrencyCode } from '@/src/domain/money/currencies';
import { getHistoricalRateOnOrBefore } from '@/src/fx/frankfurter';
import { SQLiteFxRateCache, type FxRateSnapshot } from '@/src/fx/fx-rate-cache';

const PROVIDER = 'frankfurter';

export async function resolveHistoricalRate(
  db: SQLiteDatabase,
  base: MoneyCurrencyCode,
  quote: MoneyCurrencyCode,
  requestedDate: string,
): Promise<FxRateSnapshot> {
  const cache = new SQLiteFxRateCache(db);
  const cached = await cache.get(base, quote, requestedDate, PROVIDER);
  if (cached) return cached;

  const rate = await getHistoricalRateOnOrBefore(base, quote, requestedDate);
  const snapshot: FxRateSnapshot = {
    base,
    quote,
    requestedDate,
    effectiveDate: rate.date,
    rateDecimal: rate.rate.toString(),
    provider: PROVIDER,
    fetchedAt: new Date().toISOString(),
  };
  await cache.put(snapshot);
  return snapshot;
}
