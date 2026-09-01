import type { SQLiteDatabase } from 'expo-sqlite';

import type { MoneyCurrencyCode } from '../../domain/money/currencies';
import { money, type Money } from '../../domain/money/money';

import type {
  Account,
  AccountSummary,
  BalanceScope,
  Category,
  Household,
  HouseholdMember,
  LedgerRepository,
  Transaction,
  TransactionDetails,
  TransactionSplit,
  TransferLink,
} from './ledger-repository';

type AccountRow = {
  id: string;
  household_id: string;
  ownership_scope: Account['ownershipScope'];
  owner_member_id: string | null;
  name: string;
  account_type: Account['accountType'];
  primary_currency_code: MoneyCurrencyCode | null;
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

type AccountBalanceRow = { account_id: string; amount_minor: string; currency_code: MoneyCurrencyCode };

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

type TransactionRow = {
  id: string; household_id: string; account_id: string; member_id: string | null; category_id: string | null;
  transaction_type: Transaction['transactionType']; transaction_date: string; posting_date: string | null;
  source: Transaction['source']; status: Transaction['status']; amount_minor: string; currency_code: MoneyCurrencyCode;
  reporting_amount_minor: string | null; reporting_currency_code: MoneyCurrencyCode | null;
  fx_rate_decimal: string | null; fx_provider: string | null; fx_requested_date: string | null; fx_effective_date: string | null;
  description: string | null; notes: string | null; created_at: string; updated_at: string;
  created_by_member_id: string | null; updated_by_member_id: string | null; revision: number; deleted_at: string | null;
};

type TransactionSplitRow = {
  id: string; household_id: string; transaction_id: string; category_id: string;
  amount_minor: string; currency_code: MoneyCurrencyCode; created_at: string; updated_at: string;
  created_by_member_id: string | null; updated_by_member_id: string | null; revision: number; deleted_at: string | null;
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
    assertOpeningBalances(value.openingBalances);
    if (!value.openingBalances.some((balance) => balance.currency === value.primaryCurrency)) {
      throw new Error('Primary currency must belong to the account');
    }
    const usedCurrencies = await this.db.getAllAsync<{ currency_code: MoneyCurrencyCode }>(
      `SELECT DISTINCT currency_code FROM transactions
      WHERE account_id = ? AND deleted_at IS NULL`, value.id,
    );
    const selectedCurrencies = new Set(value.openingBalances.map((balance) => balance.currency));
    if (usedCurrencies.some((row) => !selectedCurrencies.has(row.currency_code))) {
      throw new Error('A currency with transaction history cannot be removed');
    }
    await this.db.withExclusiveTransactionAsync(async (transactionDb) => {
      const legacyBalance = value.openingBalances[0]!;
      await transactionDb.runAsync(
      `INSERT INTO accounts (
        id, household_id, ownership_scope, owner_member_id, name, account_type,
        currency_code, opening_balance_minor, primary_currency_code, is_archived, created_at, updated_at,
        created_by_member_id, updated_by_member_id, revision, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ownership_scope = excluded.ownership_scope,
        owner_member_id = excluded.owner_member_id,
        name = excluded.name,
        account_type = excluded.account_type,
        currency_code = excluded.currency_code,
        opening_balance_minor = excluded.opening_balance_minor,
        primary_currency_code = excluded.primary_currency_code,
        is_archived = excluded.is_archived,
        updated_at = excluded.updated_at,
        updated_by_member_id = excluded.updated_by_member_id,
        revision = excluded.revision,
        deleted_at = excluded.deleted_at
      WHERE excluded.revision > accounts.revision`,
      value.id, value.householdId, value.ownershipScope, value.ownerMemberId, value.name,
      value.accountType, legacyBalance.currency, legacyBalance.amountMinor.toString(), value.primaryCurrency,
      value.isArchived ? 1 : 0, value.createdAt, value.updatedAt, value.createdByMemberId,
      value.updatedByMemberId, value.revision, value.deletedAt,
      );
      const placeholders = value.openingBalances.map(() => '?').join(', ');
      await transactionDb.runAsync(
        `DELETE FROM account_currency_balances WHERE account_id = ? AND currency_code NOT IN (${placeholders})`,
        value.id, ...value.openingBalances.map((balance) => balance.currency),
      );
      for (const balance of value.openingBalances) {
        await transactionDb.runAsync(
          `INSERT INTO account_currency_balances (
            account_id, currency_code, opening_balance_minor, created_at, updated_at, revision
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id, currency_code) DO UPDATE SET
            opening_balance_minor = excluded.opening_balance_minor,
            updated_at = excluded.updated_at,
            revision = excluded.revision
          WHERE excluded.revision > account_currency_balances.revision`,
          value.id, balance.currency, balance.amountMinor.toString(), value.createdAt, value.updatedAt, value.revision,
        );
      }
    });
  }

  async getAccount(accountId: string): Promise<Account | null> {
    const row = await this.db.getFirstAsync<AccountRow>(
      `SELECT id, household_id, ownership_scope, owner_member_id, name, account_type,
        CAST(opening_balance_minor AS TEXT) AS opening_balance_minor, currency_code, primary_currency_code,
        is_archived, created_at, updated_at, created_by_member_id,
        updated_by_member_id, revision, deleted_at
      FROM accounts WHERE id = ? AND deleted_at IS NULL`,
      accountId,
    );
    if (!row) return null;
    return mapAccount(row, await this.getOpeningBalances(row.id));
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
        CAST(opening_balance_minor AS TEXT) AS opening_balance_minor, currency_code, primary_currency_code,
        is_archived, created_at, updated_at, created_by_member_id,
        updated_by_member_id, revision, deleted_at
      FROM accounts
      WHERE household_id = ? AND deleted_at IS NULL
      ORDER BY is_archived, name COLLATE NOCASE`,
      householdId,
    );

    return Promise.all(rows.map(async (row) => mapAccount(row, await this.getOpeningBalances(row.id))));
  }

  async listAccountSummaries(householdId: string): Promise<AccountSummary[]> {
    const accounts = await this.listAccounts(householdId);
    return Promise.all(accounts.map(async (account) => {
      const rows = await this.db.getAllAsync<AccountBalanceRow>(
        `SELECT ? AS account_id, b.currency_code,
          CAST(b.opening_balance_minor + COALESCE(SUM(
            CASE WHEN t.status IN ('confirmed', 'fx_pending') AND t.deleted_at IS NULL THEN t.amount_minor ELSE 0 END
          ), 0) AS TEXT) AS amount_minor
        FROM account_currency_balances b
        LEFT JOIN transactions t ON t.account_id = b.account_id AND t.currency_code = b.currency_code
        WHERE b.account_id = ?
        GROUP BY b.currency_code
        ORDER BY b.currency_code`, account.id, account.id,
      );
      return { account, currentBalances: rows.map(mapBalance) };
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
      `SELECT CAST(SUM(amount_minor) AS TEXT) AS amount_minor, currency_code FROM (
        SELECT b.opening_balance_minor AS amount_minor, b.currency_code
        FROM account_currency_balances b JOIN accounts a ON a.id = b.account_id
        WHERE a.household_id = ? AND a.deleted_at IS NULL AND a.is_archived = 0 ${personalClause}
        UNION ALL
        SELECT t.amount_minor AS amount_minor, t.currency_code
        FROM transactions t JOIN accounts a ON a.id = t.account_id
        WHERE a.household_id = ? AND a.deleted_at IS NULL AND a.is_archived = 0 ${personalClause}
          AND t.status IN ('confirmed', 'fx_pending') AND t.deleted_at IS NULL
      ) balances GROUP BY currency_code ORDER BY currency_code`,
      [...parameters, ...parameters],
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

  private async getOpeningBalances(accountId: string): Promise<Money[]> {
    const rows = await this.db.getAllAsync<AccountBalanceRow>(
      `SELECT account_id, CAST(opening_balance_minor AS TEXT) AS amount_minor, currency_code
      FROM account_currency_balances WHERE account_id = ? ORDER BY currency_code`, accountId,
    );
    return rows.map(mapBalance);
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

  async getCategory(categoryId: string): Promise<Category | null> {
    const row = await this.db.getFirstAsync<CategoryRow>(
      `SELECT id, household_id, parent_id, applicability, system_key, name_en, name_uk, name_ru,
        icon, color_token, is_archived, created_at, updated_at, created_by_member_id,
        updated_by_member_id, revision, deleted_at
      FROM categories WHERE id = ? AND deleted_at IS NULL`, categoryId,
    );
    return row ? mapCategory(row) : null;
  }

  async setCategoryArchived(categoryId: string, archived: boolean, updatedAt: string, updatedByMemberId: string): Promise<void> {
    const result = await this.db.runAsync(
      `UPDATE categories SET is_archived = ?, updated_at = ?, updated_by_member_id = ?, revision = revision + 1
      WHERE (id = ? OR parent_id = ?) AND household_id IS NOT NULL AND system_key IS NULL AND deleted_at IS NULL`,
      archived ? 1 : 0, updatedAt, updatedByMemberId, categoryId, categoryId,
    );
    if (result.changes < 1) throw new Error('Custom category not found');
  }

  async saveTransaction(value: Transaction, splits: TransactionSplit[]): Promise<void> {
    assertManualTransactionAmount(value);
    assertSplitsMatchTransaction(value, splits);

    await this.db.withExclusiveTransactionAsync(async (transactionDb) => {
      await insertTransaction(transactionDb, value);
      await transactionDb.runAsync(
        `UPDATE transaction_splits SET deleted_at = ?, updated_at = ?, updated_by_member_id = ?, revision = revision + 1
        WHERE transaction_id = ? AND deleted_at IS NULL`,
        value.updatedAt, value.updatedAt, value.updatedByMemberId, value.id,
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

  async getTransaction(transactionId: string): Promise<TransactionDetails | null> {
    const row = await this.db.getFirstAsync<TransactionRow>(
      `${transactionSelect} WHERE id = ? AND deleted_at IS NULL`, transactionId,
    );
    if (!row) return null;
    const splitRows = await this.db.getAllAsync<TransactionSplitRow>(
      `SELECT id, household_id, transaction_id, category_id, CAST(amount_minor AS TEXT) AS amount_minor,
        currency_code, created_at, updated_at, created_by_member_id, updated_by_member_id, revision, deleted_at
      FROM transaction_splits WHERE transaction_id = ? AND deleted_at IS NULL ORDER BY created_at`, transactionId,
    );
    return { transaction: mapTransaction(row), splits: splitRows.map(mapTransactionSplit) };
  }

  async listTransactions(householdId: string): Promise<Transaction[]> {
    const rows = await this.db.getAllAsync<TransactionRow>(
      `${transactionSelect} WHERE household_id = ? AND deleted_at IS NULL
      ORDER BY transaction_date DESC, created_at DESC`, householdId,
    );
    return rows.map(mapTransaction);
  }

  async softDeleteTransaction(transactionId: string, deletedAt: string, updatedByMemberId: string): Promise<void> {
    const linkedIdsSql = `SELECT debit_transaction_id FROM transfer_links WHERE deleted_at IS NULL AND (debit_transaction_id = ? OR credit_transaction_id = ? OR fee_transaction_id = ?)
      UNION SELECT credit_transaction_id FROM transfer_links WHERE deleted_at IS NULL AND (debit_transaction_id = ? OR credit_transaction_id = ? OR fee_transaction_id = ?)
      UNION SELECT fee_transaction_id FROM transfer_links WHERE deleted_at IS NULL AND fee_transaction_id IS NOT NULL AND (debit_transaction_id = ? OR credit_transaction_id = ? OR fee_transaction_id = ?)`;
    await this.db.withExclusiveTransactionAsync(async (transactionDb) => {
      const ids = [transactionId, transactionId, transactionId, transactionId, transactionId, transactionId, transactionId, transactionId, transactionId];
      await transactionDb.runAsync(
        `UPDATE transactions SET deleted_at = ?, updated_at = ?, updated_by_member_id = ?, revision = revision + 1
        WHERE deleted_at IS NULL AND (id = ? OR id IN (${linkedIdsSql}))`,
        deletedAt, deletedAt, updatedByMemberId, transactionId, ...ids,
      );
      await transactionDb.runAsync(
        `UPDATE transaction_splits SET deleted_at = ?, updated_at = ?, updated_by_member_id = ?, revision = revision + 1
        WHERE deleted_at IS NULL AND (transaction_id = ? OR transaction_id IN (${linkedIdsSql}))`,
        deletedAt, deletedAt, updatedByMemberId, transactionId, ...ids,
      );
      await transactionDb.runAsync(
        `UPDATE transfer_links SET deleted_at = ?, updated_at = ?, updated_by_member_id = ?, revision = revision + 1
        WHERE deleted_at IS NULL AND (debit_transaction_id = ? OR credit_transaction_id = ? OR fee_transaction_id = ?)`,
        deletedAt, deletedAt, updatedByMemberId, transactionId, transactionId, transactionId,
      );
    });
  }

  async saveTransfer(debit: Transaction, credit: Transaction, link: TransferLink, fee?: Transaction): Promise<void> {
    assertTransferMatchesLegs(debit, credit, link, fee);
    await this.db.withExclusiveTransactionAsync(async (transactionDb) => {
      await insertTransaction(transactionDb, debit);
      await insertTransaction(transactionDb, credit);
      if (fee) await insertTransaction(transactionDb, fee);
      await transactionDb.runAsync(
        `INSERT INTO transfer_links (
          id, household_id, debit_transaction_id, credit_transaction_id, fee_transaction_id,
          sent_amount_minor, sent_currency_code, received_amount_minor, received_currency_code,
          created_at, updated_at, created_by_member_id, updated_by_member_id, revision, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        link.id, link.householdId, link.debitTransactionId, link.creditTransactionId, link.feeTransactionId,
        link.sentAmount.amountMinor.toString(), link.sentAmount.currency,
        link.receivedAmount.amountMinor.toString(), link.receivedAmount.currency,
        link.createdAt, link.updatedAt, link.createdByMemberId, link.updatedByMemberId,
        link.revision, link.deletedAt,
      );
    });
  }
}

type TransactionWriter = Pick<SQLiteDatabase, 'runAsync'>;

const transactionSelect = `SELECT id, household_id, account_id, member_id, category_id, transaction_type,
  transaction_date, posting_date, source, status, CAST(amount_minor AS TEXT) AS amount_minor,
  currency_code, CAST(reporting_amount_minor AS TEXT) AS reporting_amount_minor,
  reporting_currency_code, fx_rate_decimal, fx_provider, fx_requested_date, fx_effective_date,
  description, notes, created_at, updated_at, created_by_member_id, updated_by_member_id,
  revision, deleted_at FROM transactions`;

async function insertTransaction(db: TransactionWriter, value: Transaction): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (
      id, household_id, account_id, member_id, category_id, transaction_type,
      transaction_date, posting_date, source, status, amount_minor, currency_code,
      reporting_amount_minor, reporting_currency_code, fx_rate_decimal, fx_provider,
      fx_requested_date, fx_effective_date, description, notes, created_at, updated_at,
      created_by_member_id, updated_by_member_id, revision, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      account_id = excluded.account_id, member_id = excluded.member_id, category_id = excluded.category_id,
      transaction_type = excluded.transaction_type, transaction_date = excluded.transaction_date,
      posting_date = excluded.posting_date, status = excluded.status, amount_minor = excluded.amount_minor,
      currency_code = excluded.currency_code, reporting_amount_minor = excluded.reporting_amount_minor,
      reporting_currency_code = excluded.reporting_currency_code, fx_rate_decimal = excluded.fx_rate_decimal,
      fx_provider = excluded.fx_provider, fx_requested_date = excluded.fx_requested_date,
      fx_effective_date = excluded.fx_effective_date, description = excluded.description, notes = excluded.notes,
      updated_at = excluded.updated_at, updated_by_member_id = excluded.updated_by_member_id,
      revision = excluded.revision, deleted_at = excluded.deleted_at
    WHERE excluded.revision > transactions.revision`,
    value.id, value.householdId, value.accountId, value.memberId, value.categoryId,
    value.transactionType, value.transactionDate, value.postingDate, value.source, value.status,
    value.originalAmount.amountMinor.toString(), value.originalAmount.currency,
    value.reportingAmount?.amountMinor.toString() ?? null, value.reportingAmount?.currency ?? null,
    value.fxSnapshot?.rateDecimal ?? null, value.fxSnapshot?.provider ?? null,
    value.fxSnapshot?.requestedDate ?? null, value.fxSnapshot?.effectiveDate ?? null,
    value.description, value.notes, value.createdAt, value.updatedAt, value.createdByMemberId,
    value.updatedByMemberId, value.revision, value.deletedAt,
  );
}

function assertManualTransactionAmount(value: Transaction): void {
  if (value.transactionType === 'expense' && value.originalAmount.amountMinor >= 0n) {
    throw new Error('Expense amount must be negative');
  }
  if (value.transactionType === 'income' && value.originalAmount.amountMinor <= 0n) {
    throw new Error('Income amount must be positive');
  }
}

function assertTransferMatchesLegs(debit: Transaction, credit: Transaction, link: TransferLink, fee?: Transaction): void {
  if (debit.transactionType !== 'transfer' || credit.transactionType !== 'transfer') throw new Error('Both transfer legs must have transfer type');
  if (debit.householdId !== credit.householdId || link.householdId !== debit.householdId) throw new Error('Transfer legs must belong to one household');
  if (debit.accountId === credit.accountId) throw new Error('Transfer accounts must be different');
  if (debit.id !== link.debitTransactionId || credit.id !== link.creditTransactionId) throw new Error('Transfer link must reference both legs');
  if (debit.originalAmount.amountMinor >= 0n || credit.originalAmount.amountMinor <= 0n) throw new Error('Transfer leg directions are invalid');
  if (link.sentAmount.amountMinor <= 0n || link.receivedAmount.amountMinor <= 0n) throw new Error('Transfer amounts must be positive');
  if (link.sentAmount.currency !== link.receivedAmount.currency || link.sentAmount.amountMinor !== link.receivedAmount.amountMinor) throw new Error('Transfer must preserve amount and currency');
  if (debit.originalAmount.currency !== link.sentAmount.currency || -debit.originalAmount.amountMinor !== link.sentAmount.amountMinor) throw new Error('Debit leg must match sent amount');
  if (credit.originalAmount.currency !== link.receivedAmount.currency || credit.originalAmount.amountMinor !== link.receivedAmount.amountMinor) throw new Error('Credit leg must match received amount');
  if (debit.transactionDate !== credit.transactionDate) throw new Error('Transfer legs must use the same date');
  if (fee) {
    if (link.feeTransactionId !== fee.id) throw new Error('Transfer link must reference its fee');
    if (fee.transactionType !== 'expense' || fee.accountId !== debit.accountId || fee.householdId !== debit.householdId) throw new Error('Transfer fee must be an expense on the source account');
    if (fee.originalAmount.amountMinor >= 0n || fee.originalAmount.currency !== debit.originalAmount.currency) throw new Error('Transfer fee amount is invalid');
    if (fee.transactionDate !== debit.transactionDate) throw new Error('Transfer fee must use the transfer date');
  } else if (link.feeTransactionId !== null) {
    throw new Error('Transfer fee link has no transaction');
  }
}

function mapAccount(row: AccountRow, openingBalances: Money[]): Account {
  return {
    id: row.id,
    householdId: row.household_id,
    ownershipScope: row.ownership_scope,
    ownerMemberId: row.owner_member_id,
    name: row.name,
    accountType: row.account_type,
    primaryCurrency: row.primary_currency_code ?? row.currency_code,
    openingBalances,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByMemberId: row.created_by_member_id,
    updatedByMemberId: row.updated_by_member_id,
    revision: row.revision,
    deletedAt: row.deleted_at,
  };
}

function mapBalance(row: Pick<AccountBalanceRow, 'amount_minor' | 'currency_code'>): Money {
  return money(BigInt(row.amount_minor), row.currency_code);
}

function assertOpeningBalances(balances: Money[]): void {
  if (balances.length === 0) throw new Error('An account must have at least one currency balance');
  if (new Set(balances.map((balance) => balance.currency)).size !== balances.length) {
    throw new Error('Account currency balances must be unique');
  }
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

function mapTransaction(row: TransactionRow): Transaction {
  const hasFxSnapshot = row.fx_rate_decimal !== null && row.fx_provider !== null
    && row.fx_requested_date !== null && row.fx_effective_date !== null;
  return {
    id: row.id, householdId: row.household_id, accountId: row.account_id, memberId: row.member_id,
    categoryId: row.category_id, transactionType: row.transaction_type, transactionDate: row.transaction_date,
    postingDate: row.posting_date, source: row.source, status: row.status,
    originalAmount: money(BigInt(row.amount_minor), row.currency_code),
    reportingAmount: row.reporting_amount_minor !== null && row.reporting_currency_code !== null
      ? money(BigInt(row.reporting_amount_minor), row.reporting_currency_code) : null,
    fxSnapshot: hasFxSnapshot ? {
      rateDecimal: row.fx_rate_decimal!, provider: row.fx_provider!, requestedDate: row.fx_requested_date!, effectiveDate: row.fx_effective_date!,
    } : null,
    description: row.description, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
    createdByMemberId: row.created_by_member_id, updatedByMemberId: row.updated_by_member_id,
    revision: row.revision, deletedAt: row.deleted_at,
  };
}

function mapTransactionSplit(row: TransactionSplitRow): TransactionSplit {
  return {
    id: row.id, householdId: row.household_id, transactionId: row.transaction_id,
    categoryId: row.category_id, amount: money(BigInt(row.amount_minor), row.currency_code),
    createdAt: row.created_at, updatedAt: row.updated_at, createdByMemberId: row.created_by_member_id,
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
