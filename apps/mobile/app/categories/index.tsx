import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { Card, EmptyState, ErrorState, LoadingState, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, spacing } from '@/src/design/tokens';
import { useSettings } from '@/src/settings/settings-context';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; categories: Category[] };

export default function CategoriesScreen() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const router = useRouter();
  const { locale, t, theme } = useSettings();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const household = await repository.getActiveHousehold();
      setState({ status: 'ready', categories: household ? await repository.listCategories(household.id) : [] });
    } catch { setState({ status: 'error' }); }
  }, [repository]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
      <MaterialCommunityIcons color={theme.primary} name="arrow-left" size={24} />
      <Text style={[styles.backLabel, { color: theme.primary }]}>{t('back')}</Text>
    </Pressable>
    <ScreenHeader title={t('manageCategories')} action={<Pressable accessibilityLabel={t('addCategory')} accessibilityRole="button" onPress={() => router.push('/categories/new' as Href)} style={[styles.addButton, { backgroundColor: theme.primary }]}>
      <MaterialCommunityIcons color={theme.onPrimary} name="plus" size={26} />
    </Pressable>} />
    {state.status === 'loading' ? <LoadingState label={t('loadingCategories')} /> : null}
    {state.status === 'error' ? <Card><ErrorState message={t('categoriesLoadError')} onRetry={() => void load()} retryLabel={t('retry')} /></Card> : null}
    {state.status === 'ready' && state.categories.length === 0 ? <EmptyState description={t('noCategoriesHint')} icon={<MaterialCommunityIcons color={theme.primary} name="shape-outline" size={46} />} title={t('noCategories')} /> : null}
    {state.status === 'ready' ? state.categories.map((category) => {
      const parent = category.parentId ? state.categories.find((candidate) => candidate.id === category.parentId) : null;
      const editable = category.householdId !== null && category.systemKey === null;
      return <Pressable disabled={!editable} key={category.id} onPress={() => router.push(`/categories/${category.id}` as Href)} style={({ pressed }) => [styles.category, { opacity: pressed ? 0.74 : category.isArchived ? 0.55 : 1 }]}>
        <Card><View style={styles.row}>
          <View style={styles.text}>
            <Text style={[styles.name, { color: theme.text }]}>{parent ? `${parent.names[locale]} › ` : ''}{category.names[locale]}</Text>
            <Text style={[styles.meta, { color: theme.muted }]}>{t(categoryApplicabilityKey[category.applicability])}{' · '}{editable ? t('customCategory') : t('builtInCategory')}{category.isArchived ? ` · ${t('archived')}` : ''}</Text>
          </View>
          {editable ? <MaterialCommunityIcons color={theme.primary} name="chevron-right" size={24} /> : null}
        </View></Card>
      </Pressable>;
    }) : null}
  </Screen>;
}

const categoryApplicabilityKey = { expense: 'expense', income: 'income', both: 'incomeAndExpense' } as const;
const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44 },
  backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  addButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  category: { marginBottom: spacing.sm },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  text: { flex: 1 },
  name: { fontSize: fontSizes.body, fontWeight: fontWeights.extraBold },
  meta: { fontSize: fontSizes.caption, marginTop: spacing.xs },
});
