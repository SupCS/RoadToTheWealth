import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Crypto from 'expo-crypto';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category } from '@/src/data/repositories/ledger-repository';
import { SQLiteLedgerRepository } from '@/src/data/repositories/sqlite-ledger-repository';
import { AppTextField, ErrorState, LoadingState, PrimaryButton, Screen, ScreenHeader } from '@/src/design/layout';
import { fontSizes, fontWeights, radii, spacing } from '@/src/design/tokens';
import { useSettings } from '@/src/settings/settings-context';

export default function CategoryEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const repository = useMemo(() => new SQLiteLedgerRepository(db), [db]);
  const router = useRouter();
  const { locale, t, theme } = useSettings();
  const [category, setCategory] = useState<Category | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [names, setNames] = useState({ en: '', uk: '', ru: '' });
  const [applicability, setApplicability] = useState<Category['applicability']>('expense');
  const [parentId, setParentId] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void (async () => {
    try {
      const household = await repository.getActiveHousehold();
      if (!household) throw new Error('Household missing');
      const [member, allCategories, existing] = await Promise.all([
        repository.getActiveMember(household.id), repository.listCategories(household.id), isNew ? Promise.resolve(null) : repository.getCategory(id),
      ]);
      if (!member || (!isNew && !existing) || existing?.systemKey) throw new Error('Category context missing');
      setHouseholdId(household.id); setMemberId(member.id); setCategories(allCategories);
      if (existing) { setCategory(existing); setNames(existing.names); setApplicability(existing.applicability); setParentId(existing.parentId ?? ''); }
      setStatus('ready');
    } catch { setStatus('error'); }
  })(); }, [id, isNew, repository]);

  const possibleParents = categories.filter((candidate) => candidate.id !== category?.id && candidate.parentId === null && !candidate.isArchived && (candidate.applicability === applicability || candidate.applicability === 'both'));

  async function save() {
    if (!names.en.trim() || !names.uk.trim() || !names.ru.trim()) { setError(t('categoryNamesRequired')); return; }
    if (!householdId || !memberId) return;
    setStatus('saving'); setError(null);
    const now = new Date().toISOString();
    try {
      await repository.saveCategory({
        id: category?.id ?? Crypto.randomUUID(), householdId, parentId: parentId || null, applicability,
        systemKey: null, names: { en: names.en.trim(), uk: names.uk.trim(), ru: names.ru.trim() },
        icon: category?.icon ?? null, colorToken: category?.colorToken ?? null, isArchived: category?.isArchived ?? false,
        createdAt: category?.createdAt ?? now, updatedAt: now, createdByMemberId: category?.createdByMemberId ?? memberId,
        updatedByMemberId: memberId, revision: (category?.revision ?? 0) + 1, deletedAt: null,
      });
      router.replace('/categories' as Href);
    } catch { setStatus('ready'); setError(t('categorySaveError')); }
  }

  function archive() {
    if (!category || !memberId) return;
    Alert.alert(t('archiveCategory'), t('archiveCategoryConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('archive'), style: 'destructive', onPress: () => void repository.setCategoryArchived(category.id, true, new Date().toISOString(), memberId).then(() => router.replace('/categories' as Href)).catch(() => setError(t('categorySaveError'))) }]);
  }

  if (status === 'loading') return <Screen><LoadingState label={t('loading')} /></Screen>;
  if (status === 'error') return <Screen><ErrorState message={t('categoriesLoadError')} /></Screen>;
  return <Screen>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons color={theme.primary} name="arrow-left" size={24} /><Text style={[styles.backLabel, { color: theme.primary }]}>{t('back')}</Text></Pressable>
    <ScreenHeader title={isNew ? t('newCategory') : t('editCategory')} />
    <AppTextField label={`${t('categoryName')} · EN`} onChangeText={(value) => setNames((current) => ({ ...current, en: value }))} value={names.en} />
    <AppTextField label={`${t('categoryName')} · UK`} onChangeText={(value) => setNames((current) => ({ ...current, uk: value }))} value={names.uk} />
    <AppTextField label={`${t('categoryName')} · RU`} onChangeText={(value) => setNames((current) => ({ ...current, ru: value }))} value={names.ru} />
    <ChoiceGroup label={t('categoryUsage')} options={[{ label: t('expense'), value: 'expense' }, { label: t('income'), value: 'income' }, { label: t('incomeAndExpense'), value: 'both' }]} selected={applicability} onSelect={(value) => { setApplicability(value as Category['applicability']); setParentId(''); }} />
    <ChoiceGroup label={t('parentCategory')} options={[{ label: t('noParentCategory'), value: '' }, ...possibleParents.map((candidate) => ({ label: candidate.names[locale], value: candidate.id }))]} selected={parentId} onSelect={setParentId} />
    {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <PrimaryButton label={status === 'saving' ? t('saving') : t('save')} onPress={status === 'saving' ? undefined : () => void save()} />
    {category && !category.isArchived ? <Pressable accessibilityRole="button" onPress={archive} style={[styles.archiveButton, { borderColor: theme.danger }]}><Text style={[styles.archiveLabel, { color: theme.danger }]}>{t('archiveCategory')}</Text></Pressable> : null}
  </Screen>;
}

function ChoiceGroup({ label, onSelect, options, selected }: { label: string; onSelect: (value: string) => void; options: { label: string; value: string }[]; selected: string }) {
  const { theme } = useSettings();
  return <View style={styles.group}><Text style={[styles.label, { color: theme.text }]}>{label}</Text><View style={styles.choices}>{options.map((option) => { const active = option.value === selected; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={option.value || 'none'} onPress={() => onSelect(option.value)} style={[styles.choice, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border }]}><Text style={[styles.choiceLabel, { color: active ? theme.onPrimary : theme.text }]}>{option.label}</Text></Pressable>; })}</View></View>;
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, minHeight: 44 }, backLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  group: { gap: spacing.sm, marginBottom: spacing.lg }, label: { fontSize: fontSizes.body, fontWeight: fontWeights.bold }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderRadius: radii.lg, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, choiceLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  error: { fontSize: fontSizes.body, marginVertical: spacing.md }, archiveButton: { alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, marginTop: spacing.lg, minHeight: 48, justifyContent: 'center', padding: spacing.md }, archiveLabel: { fontSize: fontSizes.button, fontWeight: fontWeights.extraBold },
});
