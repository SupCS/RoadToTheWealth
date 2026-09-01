import type { SQLiteDatabase } from 'expo-sqlite';

import type { MoneyCurrencyCode } from '../../domain/money/currencies';
import { money } from '../../domain/money/money';

import type {
  Account,
  AccountSummary,
  BalanceScope,
  Category,
  Household,
  HouseholdMember,
  LedgerRepository,
  Transaction,
  TransactionSplit,
} from './ledger-repository';

type AccountRow = {
  id: string;
  household_id: string;
  ownership_scope: Account['ownershipScope'];
  owner_member_id: string | null;
  name: string;
  account_type: Account['accountType'];
  opening_balance_minor: string;
  currency_code: MoneyCurrencyCode;
  is_archived: number;
  created_at: string;
  updated_at: string;
  created_by_member_id: string | null;
  updated_by_member_id: string | null;
  revision: number;
  deleted_at: string | null;
};

type BalanceRow = { amount_minor: string; currency_code: MoneyCurrencyCode };

type HouseholdRow = {
  id: string;
  name: string;
  base_currency_code: MoneyCurrencyCode;
  created_at: string;
  updated_at: string;
  created_by_member_id: string | null;
  updated_by_member_id: string | null;
  revision: number;
  deleted_at: string | null;
};

type AccountSummaryRow = AccountRow & { current_balance_minor: string };

type MemberRow = {
  id: string; household_id: string; user_id: string | null; display_name: string;
  role: HouseholdMember['role']; membership_status: HouseholdMember['membershipStatus'];
  created_at: string; updated_at: string; created_by_member_id: string | null;
  updated_by_member_id: string | null; revision: number; deleted_at: string | null;
};

type CategoryRow = {
  id: string;
  household_id: string | null;
  parent_id: string | null;
  applicability: Category['applicability'];
  system_key: string | null;
  name_en: string;
  name_uk: string;
  name_ru: string;
  icon: string | null;
  color_token: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
  created_by_member_id: string | null;
  updated_by_member_id: string | null;
  revision: number;
  deleted_at: string | null;
};

export class SQLiteLedgerRepository implements LedgerRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async saveHousehold(value: Household): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO households (
        id, name, base_currency_code, created_at, updated_at,
        created_by_member_id, updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        base_currency_code = excluded.base_currency_code,
        updated_at = excluded.updated_at,
        updated_by_member_id = excluded.updated_by_member_id,
        revision = excluded.revision,
        deleted_at = excluded.deleted_at
      WHERE excluded.revision > households.revision`,
      value.id, value.name, value.baseCurrency, value.createdAt, value.updatedAt,
      value.createdByMemberId, value.updatedByMemberId, value.revision, value.deletedAt,
    );
  }

  async getActiveHousehold(): Promise<Household | null> {
    const row = await this.db.getFirstAsync<HouseholdRow>(
      `SELECT id, name, base_currency_code, created_at, updated_at,
        created_by_member_id, updated_by_member_id, revision, deleted_at
      FROM households
      WHERE deleted_at IS NULL
      ORDER BY created_at
      LIMIT 1`,
    );
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      baseCurrency: row.base_currency_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByMemberId: row.created_by_member_id,
      updatedByMemberId: row.updated_by_member_id,
      revision: row.revision,
      deletedAt: row.deleted_at,
    };
  }

  async saveMember(value: HouseholdMember): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO household_members (
        id, household_id, user_id, display_name, role, membership_status,
        created_at, updated_at, created_by_member_id, updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        display_name = excluded.display_name,
        role = excluded.role,
        membership_status = excluded.membership_status,
        updated_at = excluded.updated_at,
        updated_by_member_id = excluded.updated_by_member_id,
        revision = excluded.revision,
        deleted_at = excluded.deleted_at
      WHERE excluded.revision > household_members.revision`,
      value.id, value.householdId, value.userId, value.displayName, value.role, value.membershipStatus,
      value.createdAt, value.updatedAt, value.createdByMemberId, value.updatedByMemberId, value.revision, value.deletedAt,
    );
  }

  async getActiveMember(householdId: string): Promise<HouseholdMember | null> {
    const row = await this.db.getFirstAsync<MemberRow>(
      `SELECT id, household_id, user_id, display_name, role, membership_status,
        created_at, updated_at, created_by_member_id, updated_by_member_id, revision, deleted_at
      FROM household_members
      WHERE household_id = ? AND membership_status = 'active' AND deleted_at IS NULL
      ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at
      LIMIT 1`,
      householdId,
    );
    return row ? mapMember(row) : null;
  }

  async saveAccount(value: Account): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO accounts (
        id, household_id, ownership_scope, owner_member_id, name, account_type,
        currency_code, opening_balance_minor, is_archived, created_at, updated_at,
        created_by_member_id, updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ownership_scope = excluded.ownership_scope,
        owner_member_id = excluded.owner_member_id,
        name = excluded.name,
        account_type = excluded.account_type,
        currency_code = excluded.currency_code,
        opening_balance_minor = excluded.opening_balance_minor,
        is_archived = excluded.is_archived,
        updated_at = excluded.updated_at,
        updated_by_member_id = excluded.updated_by_member_id,
        revision = excluded.revision,
        deleted_at = excluded.deleted_at
      WHERE excluded.revision > accounts.revision`,
      value.id, value.householdId, value.ownershipScope, value.ownerMemberId, value.name,
      value.accountType, value.openingBalance.currency, value.openingBalance.amountMinor.toString(),
      value.isArchived ? 1 : 0, value.createdAt, value.updatedAt, value.createdByMemberId,
      value.updatedByMemberId, value.revision, value.deletedAt,
    );
  }

  async getAccount(accountId: string): Promise<Account | null> {
    const row = await this.db.getFirstAsync<AccountRow>(
      `SELECT id, household_id, ownership_scope, owner_member_id, name, account_type,
        CAST(opening_balance_minor AS TEXT) AS opening_balance_minor, currency_code,
        is_archived, created_at, updated_at, created_by_member_id,
        updated_by_member_id, revision, deleted_at
      FROM accounts WHERE id = ? AND deleted_at IS NULL`,
      accountId,
    );
    return row ? mapAccount(row) : null;
  }

  async setAccountArchived(accountId: string, archived: boolean, updatedAt: string, updatedByMemberId: string): Promise<void> {
    const result = await this.db.runAsync(
      `UPDATE accounts SET is_archived = ?, updated_at = ?, updated_by_member_id = ?, revision = revision + 1
      WHERE id = ? AND deleted_at IS NULL`,
      archived ? 1 : 0, updatedAt, updatedByMemberId, accountId,
    );
    if (result.changes !== 1) throw new Error('Account not found');
  }

  async listAccounts(householdId: string): Promise<Account[]> {
    const rows = await this.db.getAllAsync<AccountRow>(
      `SELECT id, household_id, ownership_scope, owner_member_id, name, account_type,
        CAST(opening_balance_minor AS TEXT) AS opening_balance_minor, currency_code,
        is_archived, created_at, updated_at, created_by_member_id,
        updated_by_member_id, revision, deleted_at
      FROM accounts
      WHERE household_id = ? AND deleted_at IS NULL
      ORDER BY is_archived, name COLLATE NOCASE`,
      householdId,
    );

    return rows.map(mapAccount);
  }

  async listAccountSummaries(householdId: string): Promise<AccountSummary[]> {
    const rows = await this.db.getAllAsync<AccountSummaryRow>(
      `SELECT a.id, a.household_id, a.ownership_scope, a.owner_member_id, a.name, a.account_type,
        CAST(a.opening_balance_minor AS TEXT) AS opening_balance_minor, a.currency_code,
        a.is_archived, a.created_at, a.updated_at, a.created_by_member_id,
        a.updated_by_member_id, a.revision, a.deleted_at,
        CAST(a.opening_balance_minor + COALESCE(SUM(
          CASE WHEN t.status = 'confirmed' AND t.deleted_at IS NULL THEN t.amount_minor ELSE 0 END
        ), 0) AS TEXT) AS current_balance_minor
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id
      WHERE a.household_id = ? AND a.deleted_at IS NULL
      GROUP BY a.id
      ORDER BY a.is_archived, a.name COLLATE NOCASE`,
      householdId,
    );
    return rows.map((row) => ({
      account: mapAccount(row),
      currentBalance: money(BigInt(row.current_balance_minor), row.currency_code),
    }));
  }

  async getBalances(scope: BalanceScope) {
    const personalClause = scope.kind === 'personal'
      ? "AND a.ownership_scope = 'personal' AND a.owner_member_id = ?"
      : '';
    const parameters = scope.kind === 'personal'
      ? [scope.householdId, scope.memberId]
      : [scope.householdId];
    const rows = await this.db.getAllAsync<BalanceRow>(
      `SELECT CAST(SUM(account_balance_minor) AS TEXT) AS amount_minor, currency_code
      FROM (
        SELECT a.id, a.currency_code,
          a.opening_balance_minor + COALESCE(SUM(
            CASE WHEN t.status = 'confirmed' AND t.deleted_at IS NULL THEN t.amount_minor ELSE 0 END
          ), 0) AS account_balance_minor
        FROM accounts a
        LEFT JOIN transactions t ON t.account_id = a.id
        WHERE a.household_id = ? AND a.deleted_at IS NULL AND a.is_archived = 0
          ${personalClause}
        GROUP BY a.id
      ) balances
      GROUP BY currency_code
      ORDER BY currency_code`,
      parameters,
    );

    return rows.map((row) => money(BigInt(row.amount_minor), row.currency_code));
  }

  async saveCategory(value: Category): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO categories (
        id, household_id, parent_id, applicability, system_key, name_en, name_uk, name_ru,
        icon, color_token, is_archived, created_at, updated_at, created_by_member_id,
        updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        parent_id = excluded.parent_id,
        applicability = excluded.applicability,
        name_en = excluded.name_en,
        name_uk = excluded.name_uk,
        name_ru = excluded.name_ru,
        icon = excluded.icon,
        color_token = excluded.color_token,
        is_archived = excluded.is_archived,
        updated_at = excluded.updated_at,
        updated_by_member_id = excluded.updated_by_member_id,
        revision = excluded.revision,
        deleted_at = excluded.deleted_at
      WHERE excluded.revision > categories.revision`,
      value.id, value.householdId, value.parentId, value.applicability, value.systemKey,
      value.names.en, value.names.uk, value.names.ru, value.icon, value.colorToken,
      value.isArchived ? 1 : 0, value.createdAt, value.updatedAt, value.createdByMemberId,
      value.updatedByMemberId, value.revision, value.deletedAt,
    );
  }

  async listCategories(householdId: string): Promise<Category[]> {
    const rows = await this.db.getAllAsync<CategoryRow>(
      `SELECT id, household_id, parent_id, applicability, system_key, name_en, name_uk, name_ru,
        icon, color_token, is_archived, created_at, updated_at, created_by_member_id,
        updated_by_member_id, revision, deleted_at
      FROM categories
      WHERE (household_id = ? OR household_id IS NULL) AND deleted_at IS NULL
      ORDER BY is_archived, applicability, name_en COLLATE NOCASE`,
      householdId,
    );
    return rows.map(mapCategory);
  }

  async saveTransaction(value: Transaction, splits: TransactionSplit[]): Promise<void> {
    assertManualTransactionAmount(value);
    assertSplitsMatchTransaction(value, splits);

    await this.db.withExclusiveTransactionAsync(async (transactionDb) => {
      await transactionDb.runAsync(
        `INSERT INTO transactions (
          id, household_id, account_id, member_id, category_id, transaction_type,
          transaction_date, posting_date, source, status, amount_minor, currency_code,
          reporting_amount_minor, reporting_currency_code, fx_rate_decimal, fx_provider,
          fx_requested_date, fx_effective_date, description, notes, created_at, updated_at,
          created_by_member_id, updated_by_member_id, revision, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        value.id, value.householdId, value.accountId, value.memberId, value.categoryId,
        value.transactionType, value.transactionDate, value.postingDate, value.source, value.status,
        value.originalAmount.amountMinor.toString(), value.originalAmount.currency,
        value.reportingAmount?.amountMinor.toString() ?? null, value.reportingAmount?.currency ?? null,
        value.fxSnapshot?.rateDecimal ?? null, value.fxSnapshot?.provider ?? null,
        value.fxSnapshot?.requestedDate ?? null, value.fxSnapshot?.effectiveDate ?? null,
        value.description, value.notes, value.createdAt, value.updatedAt, value.createdByMemberId,
        value.updatedByMemberId, value.revision, value.deletedAt,
      );

      for (const split of splits) {
        await transactionDb.runAsync(
          `INSERT INTO transaction_splits (
            id, household_id, transaction_id, category_id, amount_minor, currency_code,
            created_at, updated_at, created_by_member_id, updated_by_member_id, revision, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          split.id, split.householdId, split.transactionId, split.categoryId,
          split.amount.amountMinor.toString(), split.amount.currency, split.createdAt, split.updatedAt,
          split.createdByMemberId, split.updatedByMemberId, split.revision, split.deletedAt,
        );
      }
    });
  }
}

function assertManualTransactionAmount(value: Transaction): void {
  if (value.transactionType === 'expense' && value.originalAmount.amountMinor >= 0n) {
    throw new Error('Expense amount must be negative');
  }
  if (value.transactionType === 'income' && value.originalAmount.amountMinor <= 0n) {
    throw new Error('Income amount must be positive');
  }
}

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    householdId: row.household_id,
    ownershipScope: row.ownership_scope,
    ownerMemberId: row.owner_member_id,
    name: row.name,
    accountType: row.account_type,
    openingBalance: money(BigInt(row.opening_balance_minor), row.currency_code),
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByMemberId: row.created_by_member_id,
    updatedByMemberId: row.updated_by_member_id,
    revision: row.revision,
    deletedAt: row.deleted_at,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    householdId: row.household_id,
    parentId: row.parent_id,
    applicability: row.applicability,
    systemKey: row.system_key,
    names: { en: row.name_en, uk: row.name_uk, ru: row.name_ru },
    icon: row.icon,
    colorToken: row.color_token,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByMemberId: row.created_by_member_id,
    updatedByMemberId: row.updated_by_member_id,
    revision: row.revision,
    deletedAt: row.deleted_at,
  };
}

function mapMember(row: MemberRow): HouseholdMember {
  return {
    id: row.id, householdId: row.household_id, userId: row.user_id, displayName: row.display_name,
    role: row.role, membershipStatus: row.membership_status, createdAt: row.created_at,
    updatedAt: row.updated_at, createdByMemberId: row.created_by_member_id,
    updatedByMemberId: row.updated_by_member_id, revision: row.revision, deletedAt: row.deleted_at,
  };
}

function assertSplitsMatchTransaction(value: Transaction, splits: TransactionSplit[]): void {
  if (splits.length === 0) return;

  let total = 0n;
  for (const split of splits) {
    if (split.householdId !== value.householdId || split.transactionId !== value.id) {
      throw new Error('Split does not belong to the transaction');
    }
    if (split.amount.currency !== value.originalAmount.currency) {
      throw new Error('Split currency must match the transaction currency');
    }
    if (split.deletedAt === null) total += split.amount.amountMinor;
  }
  if (total !== value.originalAmount.amountMinor) {
    throw new Error('Active splits must sum exactly to the transaction amount');
  }
}
