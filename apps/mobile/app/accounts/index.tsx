import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, ErrorState, LoadingState, MoneyText, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import type { AccountSummary } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { getMinorUnit } from '@/src/domain/money/currencies';
import { money } from '@/src/domain/money/money';
import { useLatestRates } from '@/src/fx/use-fx';
import { type CurrencyCode, useSettings } from '@/src/settings/settings-context';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; accounts: AccountSummary[] };

export default function AccountsScreen() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const router = useRouter();
  const { locale, t, theme } = useSettings();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      const accounts = household ? await repository.listAccountSummaries(household.id) : [];
      setState({ status: 'ready', accounts });
    } catch {
      setState({ status: 'error' });
    }
  }, [repository]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <MaterialCommunityIcons color={theme.primary} name="arrow-left" size={24} />
        <Text style={[styles.backLabel, { color: theme.primary }]}>{t('back')}</Text>
      </Pressable>
      <ScreenHeader title={t('accounts')} action={
        <Pressable accessibilityLabel={t('addAccount')} accessibilityRole="button" hitSlop={8} onPress={() => router.push('/accounts/new' as Href)} style={({ pressed }) => [styles.addButton, { backgroundColor: theme.primary, opacity: pressed ? 0.78 : 1 }]}>
          <MaterialCommunityIcons color={theme.onPrimary} name="plus" size={26} />
        </Pressable>
      } />

      {state.status === 'loading' ? <LoadingState label={t('loadingAccounts')} /> : null}
      {state.status === 'error' ? (
        <Card><ErrorState message={t('accountsLoadError')} onRetry={() => void load()} retryLabel={t('retry')} /></Card>
      ) : null}
      {state.status === 'ready' && state.accounts.length === 0 ? (
        <EmptyState
          description={t('noAccountsHint')}
          icon={<MaterialCommunityIcons color={theme.primary} name="wallet-outline" size={46} />}
          title={t('noAccounts')}
        />
      ) : null}
      {state.status === 'ready' ? state.accounts.map((summary) => <AccountCard key={summary.account.id} summary={summary} />) : null}
    </Screen>
  );
}

function AccountCard({ summary: { account, currentBalances } }: { summary: AccountSummary }) {
  const router = useRouter();
  const { locale, t, theme } = useSettings();
  const quotes = currentBalances.map((balance) => balance.currency).filter((currency) => currency !== account.primaryCurrency) as CurrencyCode[];
  const { rates } = useLatestRates(account.primaryCurrency as CurrencyCode, quotes);
  const total = currentBalances.length > 1 ? calculatePrimaryTotal(currentBalances, account.primaryCurrency, rates) : null;
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/accounts/${account.id}` as Href)} style={({ pressed }) => [styles.accountCard, { opacity: pressed ? 0.75 : 1 }]}>
    <Card>
      <View style={styles.accountRow}>
        <View style={styles.accountIdentity}>
          <View style={[styles.icon, { backgroundColor: theme.background }]}>
            <MaterialCommunityIcons color={theme.primary} name="wallet-outline" size={24} />
          </View>
          <View style={styles.accountText}>
            <Text style={[styles.accountName, { color: theme.text }]}>{account.name}</Text>
            <Text style={[styles.accountMeta, { color: theme.muted }]}>
              {account.ownershipScope === 'shared' ? t('sharedAccount') : t('personalAccount')}
              {' · '}{t(accountTypeKey[account.accountType])}{' · '}{account.primaryCurrency}
            </Text>
          </View>
        </View>
        <View style={styles.balances}>{currentBalances.map((balance) => <MoneyText key={balance.currency} locale={locale} value={balance} variant="metric" />)}</View>
      </View>
      {total ? <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.muted }]}>{t('estimatedAccountTotal')}{rates[0]?.date ? ` · ${rates[0].date}` : ''}</Text>
        <MoneyText locale={locale} value={total} variant="metric" />
      </View> : null}
      {account.isArchived ? <Text style={[styles.archived, { color: theme.muted }]}>{t('archived')}</Text> : null}
    </Card>
  </Pressable>;
}

function calculatePrimaryTotal(balances: AccountSummary['currentBalances'], primary: AccountSummary['account']['primaryCurrency'], rates: { quote: string; rate: number }[]) {
  let total = 0;
  for (const balance of balances) {
    const amountMinor = Number(balance.amountMinor);
    if (!Number.isSafeInteger(amountMinor)) return null;
    if (balance.currency === primary) {
      total += amountMinor;
      continue;
    }
    const rate = rates.find((candidate) => candidate.quote === balance.currency)?.rate;
    if (!rate || !Number.isFinite(rate)) return null;
    const quoteScale = 10 ** getMinorUnit(balance.currency);
    const primaryScale = 10 ** getMinorUnit(primary);
    total += Math.round((amountMinor / quoteScale / rate) * primaryScale);
  }
  return Number.isSafeInteger(total) ? money(BigInt(total), primary) : null;
}

const accountTypeKey = {
  cash: 'accountTypeCash', debit_card: 'accountTypeDebitCard', credit_card: 'accountTypeCreditCard',
  current: 'accountTypeCurrent', savings: 'accountTypeSavings', deposit: 'accountTypeDeposit',
  investment: 'accountTypeInvestment', debt: 'accountTypeDebt', e_wallet: 'accountTypeEWallet', custom: 'accountTypeCustom',
} as const;

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44 },
  backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  addButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  accountCard: { marginBottom: spacing.md },
  accountRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  accountIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, marginRight: spacing.md },
  accountText: { flex: 1 },
  accountName: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold },
  accountMeta: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  icon: { alignItems: 'center', borderRadius: radii.lg, height: 44, justifyContent: 'center', width: 44 },
  archived: { fontSize: fontSizes.caption, marginTop: spacing.md },
  balances: { alignItems: 'flex-end', gap: spacing.xs },
  totalRow: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, paddingTop: spacing.md },
  totalLabel: { fontSize: fontSizes.caption },
});
