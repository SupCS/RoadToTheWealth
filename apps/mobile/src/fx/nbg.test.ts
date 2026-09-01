import { describe, expect, it, vi } from 'vitest';

import { getNbgRates } from './nbg';

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
});
