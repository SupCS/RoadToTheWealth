import { useCallback, useEffect, useState } from 'react';

import { getLatestRates, getRateHistory, type FxRate } from '@/src/fx/frankfurter';
import type { CurrencyCode } from '@/src/settings/settings-context';

type LatestState = {
  error: boolean;
  fetchedAt: string | null;
  loading: boolean;
  rates: FxRate[];
};

export function useLatestRates(base: CurrencyCode, quotes: CurrencyCode[]) {
  const [state, setState] = useState<LatestState>({ error: false, fetchedAt: null, loading: true, rates: [] });
  const quoteKey = quotes.join(',');

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, error: false, loading: current.rates.length === 0 }));
    try {
      const result = await getLatestRates(base, quotes);
      setState({ error: false, fetchedAt: result.fetchedAt, loading: false, rates: result.rates });
    } catch {
      setState((current) => ({ ...current, error: true, loading: false }));
    }
  }, [base, quoteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void refresh(); }, [refresh]);
  return { ...state, refresh };
}

export function useRateHistory(base: CurrencyCode, quote: CurrencyCode) {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const toDate = new Date();
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 30);
    const to = toDate.toISOString().slice(0, 10);
    const from = fromDate.toISOString().slice(0, 10);

    setLoading(true);
    setError(false);
    void getRateHistory(base, quote, from, to)
      .then((result) => setRates(result))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [base, quote]);

  return { error, loading, rates };
}
