import type { MoneyCurrencyCode } from '../money/currencies';
import type { Household, HouseholdMember, LedgerRepository } from '../../data/repositories/ledger-repository';

type ContextRepository = Pick<LedgerRepository, 'getActiveHousehold' | 'getActiveMember' | 'saveHousehold' | 'saveMember'>;

export async function ensureLocalLedgerContext(
  repository: ContextRepository,
  options: Readonly<{
    baseCurrency: MoneyCurrencyCode;
    createId: () => string;
    now: () => string;
  }>,
): Promise<{ household: Household; member: HouseholdMember }> {
  let household = await repository.getActiveHousehold();
  if (!household) {
    const timestamp = options.now();
    const householdId = options.createId();
    household = {
      id: householdId,
      name: 'My household',
      baseCurrency: options.baseCurrency,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByMemberId: null,
      updatedByMemberId: null,
      revision: 1,
      deletedAt: null,
    };
    await repository.saveHousehold(household);
  }

  let member = await repository.getActiveMember(household.id);
  if (!member) {
    const timestamp = options.now();
    const memberId = options.createId();
    member = {
      id: memberId,
      householdId: household.id,
      userId: null,
      displayName: 'Me',
      role: 'owner',
      membershipStatus: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByMemberId: null,
      updatedByMemberId: null,
      revision: 1,
      deletedAt: null,
    };
    await repository.saveMember(member);
  }

  return { household, member };
}
