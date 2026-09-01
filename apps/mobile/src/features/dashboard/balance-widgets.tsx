import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SQLiteLedgerRepository } from '../../data/repositories/sqlite-ledger-repository';
import { Card, ErrorState, LoadingState, MoneyText } from '../../design/layout';
import { fontSizes, fontWeights, spacing } from '../../design/tokens';
import type { Money } from '../../domain/money/money';
import { useSettings } from '../../settings/settings-context';

type BalanceState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; hasSharedAccounts: boolean; household: Money[]; personal: Money[] };

export function BalanceWidgets() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const { locale, t, theme } = useSettings();
  const [state, setState] = useState<BalanceState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      if (!household) {
        setState({ status: 'ready', hasSharedAccounts: false, household: [], personal: [] });
        return;
      }
      const member = await repository.getActiveMember(household.id);
      const [accounts, householdBalances, personalBalances] = await Promise.all([
        repository.listAccounts(household.id),
        repository.getBalances({ kind: 'household', householdId: household.id }),
        member
          ? repository.getBalances({ kind: 'personal', householdId: household.id, memberId: member.id })
          : Promise.resolve([]),
      ]);
      setState({ status: 'ready', hasSharedAccounts: accounts.some((account) => account.ownershipScope === 'shared' && !account.isArchived), household: householdBalances, personal: personalBalances });
    } catch {
      setState({ status: 'error' });
    }
  }, [repository]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (state.status === 'loading') {
    return <Card><LoadingState label={t('loadingBalances')} /></Card>;
  }
  if (state.status === 'error') {
    return <Card><ErrorState message={t('balancesLoadError')} onRetry={() => void load()} retryLabel={t('retry')} /></Card>;
  }

  return (
    <View style={styles.widgets}>
      {state.hasSharedAccounts ? <BalanceCard
        balances={state.household}
        description={t('householdBalanceHint')}
        icon="account-group-outline"
        locale={locale}
        title={t('householdBalance')}
      /> : null}
      <BalanceCard
        balances={state.personal}
        description={t('personalBalanceHint')}
        icon="account-outline"
        locale={locale}
        title={t('personalBalance')}
      />
    </View>
  );
}

function BalanceCard({ balances, description, icon, locale, title }: {
  balances: Money[];
  description: string;
  icon: 'account-group-outline' | 'account-outline';
  locale: 'en' | 'uk' | 'ru';
  title: string;
}) {
  const { t, theme } = useSettings();
  return (
    <Card>
      <View style={styles.heading}>
        <MaterialCommunityIcons color={theme.primary} name={icon} size={24} />
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      </View>
      <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
      <View style={styles.amounts}>
        {balances.length > 0
          ? balances.map((balance) => <MoneyText key={balance.currency} locale={locale} value={balance} variant="metric" />)
          : <Text style={[styles.empty, { color: theme.muted }]}>{t('noBalanceData')}</Text>}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  widgets: { gap: spacing.md },
  heading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold },
  description: { fontSize: fontSizes.caption, lineHeight: 18, marginTop: spacing.sm },
  amounts: { gap: spacing.xs, marginTop: spacing.lg },
  empty: { fontSize: fontSizes.body },
});
