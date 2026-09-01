import type { MoneyCurrencyCode } from '../domain/money/currencies';
import type { FxRate } from './frankfurter';

const NBG_API_URL = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/';

type NbgCurrency = { code: string; quantity: number; rate: number };
type NbgDailyRates = { date: string; currencies: NbgCurrency[] };

export async function getNbgRates(base: MoneyCurrencyCode, quotes: MoneyCurrencyCode[], date?: string): Promise<FxRate[]> {
  const url = date ? `${NBG_API_URL}?date=${encodeURIComponent(date)}` : NBG_API_URL;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`NBG FX request failed with ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !isDailyRates(payload[0])) throw new Error('Unexpected NBG FX response');
  const daily = payload[0];
  const perUnitInGel = new Map<MoneyCurrencyCode, number>([['GEL', 1]]);
  for (const item of daily.currencies) {
    if (item.quantity > 0 && item.rate > 0) perUnitInGel.set(item.code as MoneyCurrencyCode, item.rate / item.quantity);
  }
  const baseInGel = perUnitInGel.get(base);
  if (!baseInGel) throw new Error(`NBG does not support ${base}`);
  const effectiveDate = daily.date.slice(0, 10);
  return quotes.flatMap((quote) => {
    if (quote === base) return [];
    const quoteInGel = perUnitInGel.get(quote);
    return quoteInGel ? [{ base, quote, date: effectiveDate, rate: baseInGel / quoteInGel, provider: 'nbg' }] : [];
  });
}

export async function getNbgRateHistory(
  base: MoneyCurrencyCode,
  quote: MoneyCurrencyCode,
  from: string,
  to: string,
): Promise<FxRate[]> {
  const dates = weekdaysBetween(from, to);
  const collected: FxRate[] = [];
  const concurrency = 5;
  for (let index = 0; index < dates.length; index += concurrency) {
    const batch = dates.slice(index, index + concurrency);
    const results = await Promise.all(batch.map((date) => getNbgRates(base, [quote], date)));
    collected.push(...results.flat());
  }
  const byEffectiveDate = new Map(collected.map((rate) => [rate.date, rate]));
  return [...byEffectiveDate.values()]
    .filter((rate) => rate.date >= from && rate.date <= to)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function weekdaysBetween(from: string, to: string): string[] {
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) throw new Error('Invalid NBG history range');
  const dates: string[] = [];
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function isDailyRates(value: unknown): value is NbgDailyRates {
  if (!value || typeof value !== 'object') return false;
  const daily = value as Partial<NbgDailyRates>;
  return typeof daily.date === 'string' && Array.isArray(daily.currencies)
    && daily.currencies.every((item) => Boolean(item) && typeof item.code === 'string'
      && typeof item.quantity === 'number' && typeof item.rate === 'number');
}
