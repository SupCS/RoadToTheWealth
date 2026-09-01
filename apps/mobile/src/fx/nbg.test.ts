import { describe, expect, it, vi } from 'vitest';

import { getNbgRateHistory, getNbgRates } from './nbg';

describe('NBG fallback rates', () => {
  it('normalizes quoted quantities and cross-converts through GEL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [{
        date: '2026-08-28T00:00:00.000Z',
        currencies: [
          { code: 'USD', quantity: 1, rate: 2.6 },
          { code: 'UAH', quantity: 10, rate: 0.6 },
        ],
      }],
    })));

    const [gelToUsd] = await getNbgRates('GEL', ['USD']);
    const [usdToUah] = await getNbgRates('USD', ['UAH'], '2026-08-30');
    expect(gelToUsd?.rate).toBeCloseTo(1 / 2.6);
    expect(usdToUah?.rate).toBeCloseTo(2.6 / 0.06);
    expect(usdToUah).toMatchObject({ date: '2026-08-28', provider: 'nbg' });
  });

  it('builds a weekday history and removes repeated holiday dates', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestedDate = new URL(url).searchParams.get('date');
      const effectiveDate = requestedDate === '2026-08-31' ? '2026-08-28' : requestedDate;
      return {
        ok: true,
        json: async () => [{
          date: `${effectiveDate}T00:00:00.000Z`,
          currencies: [{ code: 'USD', quantity: 1, rate: requestedDate === '2026-09-01' ? 2.61 : 2.6 }],
        }],
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getNbgRateHistory('GEL', 'USD', '2026-08-28', '2026-09-01');
    expect(result.map((rate) => rate.date)).toEqual(['2026-08-28', '2026-09-01']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
