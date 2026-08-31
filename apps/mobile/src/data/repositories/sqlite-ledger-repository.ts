import type { SQLiteDatabase } from 'expo-sqlite';

import type { MoneyCurrencyCode } from '../../domain/money/currencies';
import { money } from '../../domain/money/money';

import type { Account, BalanceScope, Household, HouseholdMember, LedgerRepository } from './ledger-repository';

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
