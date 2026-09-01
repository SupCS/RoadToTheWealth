import type { SQLiteDatabase } from 'expo-sqlite';

import type { MoneyCurrencyCode } from '../domain/money/currencies';

export type FxRateSnapshot = Readonly<{
  base: MoneyCurrencyCode;
  quote: MoneyCurrencyCode;
  requestedDate: string;
  effectiveDate: string;
  rateDecimal: string;
  provider: string;
  fetchedAt: string;
}>;

type FxRateRow = {
  base_currency_code: MoneyCurrencyCode;
  quote_currency_code: MoneyCurrencyCode;
  requested_date: string;
  effective_date: string;
  rate_decimal: string;
  provider: string;
  fetched_at: string;
};

export class SQLiteFxRateCache {
  constructor(private readonly db: SQLiteDatabase) {}

  async get(base: MoneyCurrencyCode, quote: MoneyCurrencyCode, requestedDate: string, provider: string): Promise<FxRateSnapshot | null> {
    const row = await this.db.getFirstAsync<FxRateRow>(`
      SELECT base_currency_code, quote_currency_code, requested_date, effective_date,
             rate_decimal, provider, fetched_at
      FROM fx_rate_cache
      WHERE base_currency_code = ? AND quote_currency_code = ?
        AND requested_date = ? AND provider = ?
    `, base, quote, requestedDate, provider);
    return row ? fromRow(row) : null;
  }

  async put(snapshot: FxRateSnapshot): Promise<void> {
    await this.db.runAsync(`
      INSERT INTO fx_rate_cache (
        base_currency_code, quote_currency_code, requested_date, effective_date,
        rate_decimal, provider, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(base_currency_code, quote_currency_code, requested_date, provider) DO NOTHING
    `, snapshot.base, snapshot.quote, snapshot.requestedDate, snapshot.effectiveDate,
    snapshot.rateDecimal, snapshot.provider, snapshot.fetchedAt);
  }
}

function fromRow(row: FxRateRow): FxRateSnapshot {
  return {
    base: row.base_currency_code,
    quote: row.quote_currency_code,
    requestedDate: row.requested_date,
    effectiveDate: row.effective_date,
    rateDecimal: row.rate_decimal,
    provider: row.provider,
    fetchedAt: row.fetched_at,
  };
}
