import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHistoricalRateOnOrBefore, getLatestRates } from './frankfurter';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

describe('Frankfurter rates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
  });

  it('uses the most recent published rate before a weekend date', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [
        { base: 'USD', quote: 'EUR', date: '2026-08-28', rate: 0.85 },
        { base: 'USD', quote: 'EUR', date: '2026-08-27', rate: 0.84 },
      ],
    })));

    const result = await getHistoricalRateOnOrBefore('USD', 'EUR', '2026-08-30');
    expect(result.date).toBe('2026-08-28');
  });

  it('returns a daily cached latest result without a network request', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
      fetchedAt: new Date().toISOString(),
      rates: [{ base: 'USD', quote: 'EUR', date: '2026-09-01', rate: 0.85 }],
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getLatestRates('USD', ['EUR']);
    expect(result.rates).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to NBG when Frankfurter is unreachable', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Frankfurter DNS failure'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          date: '2026-09-01T00:00:00.000Z',
          currencies: [{ code: 'USD', quantity: 1, rate: 2.6 }, { code: 'EUR', quantity: 1, rate: 3.04 }],
        }],
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getLatestRates('GEL', ['USD', 'EUR']);
    expect(result.rates).toHaveLength(2);
    expect(result.rates.every((rate) => rate.provider === 'nbg')).toBe(true);
    expect(result.frankfurterError).toBe('Frankfurter DNS failure');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports separate diagnostics when both providers fail', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce({ ok: false, status: 503 }));

    await expect(getLatestRates('GEL', ['USD'])).rejects.toMatchObject({
      frankfurterError: 'Network request failed',
      fallbackError: 'NBG FX request failed with 503',
    });
  });

  it('does not trust an incomplete daily cache', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
      fetchedAt: new Date().toISOString(),
      rates: [],
    }));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [{ base: 'GEL', quote: 'USD', date: '2026-09-01', rate: 0.38 }],
    })));

    const result = await getLatestRates('GEL', ['USD']);
    expect(result.rates).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports a missing historical rate when offline and uncached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(getHistoricalRateOnOrBefore('USD', 'EUR', '2026-08-30')).rejects.toThrow('offline');
  });
});
