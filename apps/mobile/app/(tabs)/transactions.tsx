import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Account, Transaction } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { Card, EmptyState, ErrorState, LoadingState, MoneyText, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, spacing } from '@/src/design/tokens';
import { formatDate } from '@/src/i18n/formatters';
import { useSettings } from '@/src/settings/settings-context';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; accounts: Account[]; memberId: string | null; transactions: Transaction[] };

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const { locale, t, theme } = useSettings();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      if (!household) {
        setState({ status: 'ready', accounts: [], memberId: null, transactions: [] });
        return;
      }
      const [accounts, member, transactions] = await Promise.all([
        repository.listAccounts(household.id), repository.getActiveMember(household.id), repository.listTransactions(household.id),
      ]);
      setState({ status: 'ready', accounts, memberId: member?.id ?? null, transactions });
    } catch {
      setState({ status: 'error' });
    }
  }, [repository]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen>
      <ScreenHeader title={t('transactions')} action={
        <Pressable accessibilityLabel={t('addTransaction')} accessibilityRole="button" hitSlop={8} onPress={() => router.push('/transaction/new')} style={({ pressed }) => [styles.addButton, { backgroundColor: theme.primary, opacity: pressed ? 0.78 : 1 }]}>
          <MaterialCommunityIcons color={theme.onPrimary} name="plus" size={26} />
        </Pressable>
      } />
      {state.status === 'loading' ? <LoadingState label={t('loadingTransactions')} /> : null}
      {state.status === 'error' ? <Card><ErrorState message={t('transactionsLoadError')} onRetry={() => void load()} retryLabel={t('retry')} /></Card> : null}
      {state.status === 'ready' && state.transactions.length === 0 ? <EmptyState
        description={t('noTransactionsHint')}
        icon={<MaterialCommunityIcons color={theme.primary} name="receipt-text-outline" size={46} />}
        title={t('noTransactions')}
      /> : null}
      {state.status === 'ready' ? groupByDate(state.transactions).map(([date, transactions]) => <View key={date} style={styles.dateGroup}>
        <Text style={[styles.date, { color: theme.muted }]}>{formatDate(date, locale)}</Text>
        {transactions.map((transaction) => {
          const account = state.accounts.find((candidate) => candidate.id === transaction.accountId);
          const tone = transaction.originalAmount.amountMinor < 0n ? 'danger' : 'positive';
          const editable = transaction.transactionType === 'expense' || transaction.transactionType === 'income';
          return <Pressable disabled={!editable} key={transaction.id} onPress={() => router.push(`/transaction/new?id=${transaction.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
          <Card>
            <View style={styles.row}>
              <View style={styles.details}>
                <Text style={[styles.transactionTitle, { color: theme.text }]}>{transaction.description || t(transactionTypeKey[transaction.transactionType])}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>{account?.name ?? t('unknownAccount')}{transaction.status === 'fx_pending' ? ` · ${t('fxPending')}` : ''}</Text>
              </View>
              <MoneyText locale={locale} tone={tone} value={transaction.originalAmount} variant="metric" />
              {state.memberId ? <Pressable accessibilityLabel={t('deleteTransaction')} accessibilityRole="button" hitSlop={8} onPress={(event) => { event.stopPropagation(); Alert.alert(t('deleteTransaction'), t('deleteTransactionConfirm'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('delete'), style: 'destructive', onPress: () => void repository.softDeleteTransaction(transaction.id, new Date().toISOString(), state.memberId!).then(load).catch(() => Alert.alert(t('transactionDeleteError'))) },
              ]); }} style={styles.deleteButton}>
                <MaterialCommunityIcons color={theme.danger} name="trash-can-outline" size={22} />
              </Pressable> : null}
            </View>
          </Card></Pressable>;
        })}
      </View>) : null}
    </Screen>
  );
}

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) groups.set(transaction.transactionDate, [...(groups.get(transaction.transactionDate) ?? []), transaction]);
  return [...groups.entries()];
}

const transactionTypeKey = {
  expense: 'expense', income: 'income', transfer: 'transfer', refund: 'refund',
  adjustment: 'adjustment', debt_payment: 'debtPayment',
} as const;

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  dateGroup: { gap: spacing.sm, marginBottom: spacing.xl },
  date: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold, marginTop: spacing.sm },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  details: { flex: 1 },
  transactionTitle: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold },
  meta: { fontSize: fontSizes.caption, marginTop: spacing.xs },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
});
