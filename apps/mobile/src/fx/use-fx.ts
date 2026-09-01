import { useCallback, useEffect, useState } from 'react';

import { FxRatesError, getLatestRates, getRateHistoryResult, type FxRate } from '@/src/fx/frankfurter';
import type { CurrencyCode } from '@/src/settings/settings-context';

type LatestState = {
  error: boolean;
  errorDetail: string | null;
  fetchedAt: string | null;
  frankfurterError: string | null;
  loading: boolean;
  rates: FxRate[];
};

export function useLatestRates(base: CurrencyCode, quotes: CurrencyCode[]) {
  const [state, setState] = useState<LatestState>({ error: false, errorDetail: null, fetchedAt: null, frankfurterError: null, loading: true, rates: [] });
  const quoteKey = quotes.join(',');

  const refresh = useCallback(async () => {
    setState({ error: false, errorDetail: null, fetchedAt: null, frankfurterError: null, loading: true, rates: [] });
    try {
      const result = await getLatestRates(base, quotes);
      setState({ error: false, errorDetail: null, fetchedAt: result.fetchedAt, frankfurterError: result.frankfurterError ?? null, loading: false, rates: result.rates });
    } catch (error) {
      const detail = error instanceof FxRatesError
        ? `Frankfurter: ${error.frankfurterError}; NBG: ${error.fallbackError}`
        : error instanceof Error ? error.message : 'Unknown error';
      setState((current) => ({ ...current, error: true, errorDetail: detail, loading: false }));
    }
  }, [base, quoteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void refresh(); }, [refresh]);
  return { ...state, refresh };
}

export function useRateHistory(base: CurrencyCode, quote: CurrencyCode) {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frankfurterError, setFrankfurterError] = useState<string | null>(null);
  const [source, setSource] = useState<'frankfurter' | 'nbg' | null>(null);

  useEffect(() => {
    const toDate = new Date();
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 30);
    const to = toDate.toISOString().slice(0, 10);
    const from = fromDate.toISOString().slice(0, 10);

    setLoading(true);
    setError(false);
    setFrankfurterError(null);
    setSource(null);
    void getRateHistoryResult(base, quote, from, to)
      .then((result) => {
        setRates(result.rates);
        setFrankfurterError(result.frankfurterError);
        setSource(result.source);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [base, quote]);

  return { error, frankfurterError, loading, rates, source };
}
