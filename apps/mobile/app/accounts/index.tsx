import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, ErrorState, LoadingState, MoneyText, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import type { AccountSummary } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { useSettings } from '@/src/settings/settings-context';

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
      <ScreenHeader title={t('accounts')} />
      <PrimaryButton label={t('addAccount')} onPress={() => router.push('/accounts/new' as Href)} />

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
      {state.status === 'ready' ? state.accounts.map(({ account, currentBalance }) => (
        <Pressable
          accessibilityRole="button"
          key={account.id}
          onPress={() => router.push(`/accounts/${account.id}` as Href)}
          style={({ pressed }) => [styles.accountCard, { opacity: pressed ? 0.75 : 1 }]}
        >
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
                    {' · '}{t(accountTypeKey[account.accountType])}
                  </Text>
                </View>
              </View>
              <MoneyText locale={locale} value={currentBalance} variant="metric" />
            </View>
            {account.isArchived ? <Text style={[styles.archived, { color: theme.muted }]}>{t('archived')}</Text> : null}
          </Card>
        </Pressable>
      )) : null}
    </Screen>
  );
}

const accountTypeKey = {
  cash: 'accountTypeCash', debit_card: 'accountTypeDebitCard', credit_card: 'accountTypeCreditCard',
  current: 'accountTypeCurrent', savings: 'accountTypeSavings', deposit: 'accountTypeDeposit',
  investment: 'accountTypeInvestment', debt: 'accountTypeDebt', e_wallet: 'accountTypeEWallet', custom: 'accountTypeCustom',
} as const;

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44 },
  backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  accountCard: { marginBottom: spacing.md },
  accountRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  accountIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, marginRight: spacing.md },
  accountText: { flex: 1 },
  accountName: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold },
  accountMeta: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  icon: { alignItems: 'center', borderRadius: radii.lg, height: 44, justifyContent: 'center', width: 44 },
  archived: { fontSize: fontSizes.caption, marginTop: spacing.md },
});
