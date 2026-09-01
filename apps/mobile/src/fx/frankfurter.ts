import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MoneyCurrencyCode } from '@/src/domain/money/currencies';
import { getNbgRateHistory, getNbgRates } from './nbg';

const API_URL = 'https://api.frankfurter.dev/v2';
const CACHE_PREFIX = 'rttw.fx.v1';
const HISTORY_CACHE_PREFIX = 'rttw.fx.history.v2';
const LATEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type FxRate = {
  base: string;
  date: string;
  quote: string;
  rate: number;
  provider?: 'frankfurter' | 'nbg';
};

type CachedRates = {
  fetchedAt: string;
  frankfurterError?: string | null;
  rates: FxRate[];
  source?: 'frankfurter' | 'nbg';
};

export class FxRatesError extends Error {
  constructor(message: string, readonly frankfurterError: string, readonly fallbackError: string) {
    super(message);
    this.name = 'FxRatesError';
  }
}

function isRate(value: unknown): value is FxRate {
  if (!value || typeof value !== 'object') return false;
  const rate = value as Partial<FxRate>;
  return typeof rate.base === 'string'
    && typeof rate.date === 'string'
    && typeof rate.quote === 'string'
    && typeof rate.rate === 'number'
    && Number.isFinite(rate.rate);
}

async function fetchRates(url: string): Promise<FxRate[]> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`FX request failed with ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Unexpected FX response');
  return payload.filter(isRate);
}

export async function getLatestRates(base: MoneyCurrencyCode, quotes: MoneyCurrencyCode[]) {
  const filtered = [...new Set(quotes.filter((quote) => quote !== base))];
  if (filtered.length === 0) return { fetchedAt: new Date().toISOString(), frankfurterError: null, rates: [], source: 'frankfurter' } satisfies CachedRates;

  const cacheKey = `${CACHE_PREFIX}.latest.${base}.${filtered.slice().sort().join('-')}`;
  const cachedRaw = await AsyncStorage.getItem(cacheKey);
  let cached: CachedRates | null = null;
  if (cachedRaw) {
    try {
      const parsed = JSON.parse(cachedRaw) as CachedRates;
      if (Array.isArray(parsed.rates) && parsed.rates.every(isRate) && hasEveryQuote(parsed.rates, filtered)) cached = parsed;
    } catch {
      // Ignore corrupted cache and try the network.
    }
  }

  if (cached && Date.now() - Date.parse(cached.fetchedAt) < LATEST_MAX_AGE_MS) return cached;

  let frankfurterError: string | null = null;
  try {
    const params = new URLSearchParams({ base, quotes: filtered.join(',') });
    let rates: FxRate[];
    let source: CachedRates['source'] = 'frankfurter';
    try {
      rates = await fetchRates(`${API_URL}/rates?${params.toString()}`);
      if (!hasEveryQuote(rates, filtered)) throw new Error('Incomplete Frankfurter FX response');
    } catch (error) {
      frankfurterError = safeErrorMessage(error);
      source = 'nbg';
      try {
        rates = await getNbgRates(base, filtered);
        if (!hasEveryQuote(rates, filtered)) throw new Error('Incomplete NBG FX response');
      } catch (fallbackError) {
        throw new FxRatesError('All FX providers failed', frankfurterError, safeErrorMessage(fallbackError));
      }
    }
    const result = { fetchedAt: new Date().toISOString(), frankfurterError, rates, source } satisfies CachedRates;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
    return result;
  } catch (error) {
    if (cached) return { ...cached, frankfurterError: frankfurterError ?? safeErrorMessage(error) };
    throw error;
  }
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return message.replace(/https?:\/\/\S+/g, '[url]').replace(/[\r\n]+/g, ' ').slice(0, 160);
}

function hasEveryQuote(rates: FxRate[], quotes: MoneyCurrencyCode[]): boolean {
  return quotes.every((quote) => rates.some((rate) => rate.quote === quote));
}

export async function getHistoricalRateOnOrBefore(base: MoneyCurrencyCode, quote: MoneyCurrencyCode, requestedDate: string): Promise<FxRate> {
  if (base === quote) return { base, quote, date: requestedDate, rate: 1 };
  const requested = new Date(`${requestedDate}T00:00:00Z`);
  if (Number.isNaN(requested.getTime())) throw new Error('Invalid FX date');
  const from = new Date(requested);
  from.setUTCDate(from.getUTCDate() - 10);
  let rates: FxRate[];
  try {
    rates = await getRateHistory(base, quote, from.toISOString().slice(0, 10), requestedDate);
  } catch {
    rates = await getNbgRates(base, [quote], requestedDate);
  }
  const applicable = rates
    .filter((rate) => rate.date <= requestedDate)
    .sort((left, right) => right.date.localeCompare(left.date));
  const result = applicable[0];
  if (!result) throw new Error(`No published FX rate on or before ${requestedDate}`);
  return result;
}

export async function getRateHistory(base: MoneyCurrencyCode, quote: MoneyCurrencyCode, from: string, to: string) {
  return (await getRateHistoryResult(base, quote, from, to)).rates;
}

export type FxHistoryResult = {
  frankfurterError: string | null;
  rates: FxRate[];
  source: 'frankfurter' | 'nbg';
};

export async function getRateHistoryResult(base: MoneyCurrencyCode, quote: MoneyCurrencyCode, from: string, to: string): Promise<FxHistoryResult> {
  const cacheKey = `${HISTORY_CACHE_PREFIX}.${base}.${quote}.${from}.${to}`;
  const cachedRaw = await AsyncStorage.getItem(cacheKey);
  if (cachedRaw) {
    try {
      const parsed: unknown = JSON.parse(cachedRaw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isRate)) {
        const source = parsed.some((rate) => rate.provider === 'nbg') ? 'nbg' : 'frankfurter';
        // Old NBG history entries did not record why Frankfurter failed. Refresh once
        // instead of presenting a placeholder as though it were the real diagnosis.
        if (source === 'frankfurter') return { frankfurterError: null, rates: parsed, source };
      }
      if (isHistoryResult(parsed)) return parsed;
    } catch {
      // Ignore corrupted cache and try the network.
    }
  }

  const params = new URLSearchParams({ base, from, quotes: quote, to });
  let rates: FxRate[];
  let frankfurterError: string | null = null;
  let source: FxHistoryResult['source'] = 'frankfurter';
  try {
    rates = await fetchRates(`${API_URL}/rates?${params.toString()}`);
    if (rates.length === 0) throw new Error('Empty Frankfurter history response');
  } catch (error) {
    frankfurterError = safeErrorMessage(error);
    source = 'nbg';
    rates = await getNbgRateHistory(base, quote, from, to);
    if (rates.length === 0) throw new Error('Empty NBG history response');
  }
  const result = { frankfurterError, rates, source } satisfies FxHistoryResult;
  await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
  return result;
}

function isHistoryResult(value: unknown): value is FxHistoryResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<FxHistoryResult>;
  return (result.source === 'frankfurter' || result.source === 'nbg')
    && (result.frankfurterError === null || typeof result.frankfurterError === 'string')
    && Array.isArray(result.rates) && result.rates.length > 0 && result.rates.every(isRate);
}
