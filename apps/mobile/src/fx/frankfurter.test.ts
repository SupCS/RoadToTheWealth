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

  it('reports a missing historical rate when offline and uncached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(getHistoricalRateOnOrBefore('USD', 'EUR', '2026-08-30')).rejects.toThrow('offline');
  });
});
