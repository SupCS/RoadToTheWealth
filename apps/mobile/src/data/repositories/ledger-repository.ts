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

export type AccountSummary = Readonly<{
  account: Account;
  currentBalance: Money;
}>;

export type Category = AuditFields & Readonly<{
  householdId: string | null;
  parentId: string | null;
  applicability: 'expense' | 'income' | 'both';
  systemKey: string | null;
  names: Readonly<{ en: string; uk: string; ru: string }>;
  icon: string | null;
  colorToken: string | null;
  isArchived: boolean;
}>;

export type Transaction = AuditFields & Readonly<{
  householdId: string;
  accountId: string;
  memberId: string | null;
  categoryId: string | null;
  transactionType: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment' | 'debt_payment';
  transactionDate: string;
  postingDate: string | null;
  source: 'manual' | 'import' | 'recurring' | 'bank_api';
  status: 'planned' | 'confirmed' | 'fx_pending' | 'review';
  originalAmount: Money;
  reportingAmount: Money | null;
  fxSnapshot: Readonly<{
    rateDecimal: string;
    provider: string;
    requestedDate: string;
    effectiveDate: string;
  }> | null;
  description: string | null;
  notes: string | null;
}>;

export type TransactionSplit = AuditFields & Readonly<{
  householdId: string;
  transactionId: string;
  categoryId: string;
  amount: Money;
}>;

export interface LedgerRepository {
  saveHousehold(household: Household): Promise<void>;
  getActiveHousehold(): Promise<Household | null>;
  saveMember(member: HouseholdMember): Promise<void>;
  saveAccount(account: Account): Promise<void>;
  listAccounts(householdId: string): Promise<Account[]>;
  listAccountSummaries(householdId: string): Promise<AccountSummary[]>;
  getBalances(scope: BalanceScope): Promise<Money[]>;
  saveCategory(category: Category): Promise<void>;
  listCategories(householdId: string): Promise<Category[]>;
  saveTransaction(transaction: Transaction, splits: TransactionSplit[]): Promise<void>;
}
