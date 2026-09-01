import { describe, expect, it, vi } from 'vitest';

import { ensureLocalLedgerContext } from './ensure-local-context';

describe('ensureLocalLedgerContext', () => {
  it('creates a local household container and member without creating an account', async () => {
    const repository = {
      getActiveHousehold: vi.fn(async () => null),
      getActiveMember: vi.fn(async () => null),
      saveHousehold: vi.fn(async () => undefined),
      saveMember: vi.fn(async () => undefined),
    };
    const ids = ['household-1', 'member-1'];

    const result = await ensureLocalLedgerContext(repository, {
      baseCurrency: 'GEL', createId: () => ids.shift()!, now: () => '2026-09-01T00:00:00.000Z',
    });

    expect(result.household.baseCurrency).toBe('GEL');
    expect(result.member.householdId).toBe('household-1');
    expect(repository.saveHousehold).toHaveBeenCalledOnce();
    expect(repository.saveMember).toHaveBeenCalledOnce();
    expect(Object.keys(repository)).not.toContain('saveAccount');
  });

  it('reuses an existing context without mutating it', async () => {
    const household = { id: 'household-1' };
    const member = { id: 'member-1' };
    const repository = {
      getActiveHousehold: vi.fn(async () => household),
      getActiveMember: vi.fn(async () => member),
      saveHousehold: vi.fn(async () => undefined),
      saveMember: vi.fn(async () => undefined),
    };

    const result = await ensureLocalLedgerContext(repository as never, {
      baseCurrency: 'USD', createId: () => 'unused', now: () => 'unused',
    });

    expect(result).toEqual({ household, member });
    expect(repository.saveHousehold).not.toHaveBeenCalled();
    expect(repository.saveMember).not.toHaveBeenCalled();
  });
});
