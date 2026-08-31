import type { MoneyCurrencyCode } from '../../domain/money/currencies';
import type { Money } from '../../domain/money/money';

export type AuditFields = Readonly<{
  id: string;
  createdAt: string;
  updatedAt: string;
  createdByMemberId: string | null;
  updatedByMemberId: string | null;
  revision: number;
  deletedAt: string | null;
}>;

export type Household = AuditFields & Readonly<{
  name: string;
  baseCurrency: MoneyCurrencyCode;
}>;

export type HouseholdMember = AuditFields & Readonly<{
  householdId: string;
  userId: string | null;
  displayName: string;
  role: 'owner' | 'member';
  membershipStatus: 'invited' | 'active' | 'left' | 'removed';
}>;

export type Account = AuditFields & Readonly<{
  householdId: string;
  ownershipScope: 'personal' | 'shared';
  ownerMemberId: string | null;
  name: string;
  accountType: 'cash' | 'debit_card' | 'credit_card' | 'current' | 'savings' | 'deposit' | 'investment' | 'debt' | 'e_wallet' | 'custom';
  openingBalance: Money;
  isArchived: boolean;
}>;

export type BalanceScope =
  | Readonly<{ kind: 'household'; householdId: string }>
  | Readonly<{ kind: 'personal'; householdId: string; memberId: string }>;

export interface LedgerRepository {
  saveHousehold(household: Household): Promise<void>;
  saveMember(member: HouseholdMember): Promise<void>;
  saveAccount(account: Account): Promise<void>;
  listAccounts(householdId: string): Promise<Account[]>;
  getBalances(scope: BalanceScope): Promise<Money[]>;
}
