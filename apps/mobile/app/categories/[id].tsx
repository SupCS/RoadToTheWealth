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
import { categoryColorOptions, categoryIconColorOptions, categoryIconSets, resolveCategoryColor, resolveCategoryForeground, resolveCategoryIcon, type CategoryColorValue, type CategoryIconName } from '@/src/features/categories/category-appearance';
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
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<CategoryIconName>('shape-outline');
  const [colorToken, setColorToken] = useState<CategoryColorValue>(categoryColorOptions[0]!.value);
  const [iconColor, setIconColor] = useState<CategoryColorValue>('#FFFFFF');
  const [applicability, setApplicability] = useState<Category['applicability']>('expense');
  const [parentId, setParentId] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void (async () => {
    try {
      const household = await repository.getActiveHousehold();
      if (!household) throw new Error('Household missing');
      const [member, allCategories, existing] = await Promise.all([repository.getActiveMember(household.id), repository.listCategories(household.id), isNew ? Promise.resolve(null) : repository.getCategory(id)]);
      if (!member || (!isNew && !existing)) throw new Error('Category context missing');
      setHouseholdId(household.id); setMemberId(member.id); setCategories(allCategories);
      if (existing) {
        setCategory(existing); setName(existing.names[locale]); setApplicability(existing.applicability); setParentId(existing.parentId ?? '');
        setIcon(resolveCategoryIcon(existing.icon));
        setColorToken(resolveCategoryColor(theme, existing.colorToken));
        setIconColor(resolveCategoryForeground(theme, existing.colorToken, existing.iconColor));
      }
      setStatus('ready');
    } catch { setStatus('error'); }
  })(); }, [id, isNew, locale, repository]);

  const possibleParents = categories.filter((candidate) => candidate.id !== category?.id && candidate.parentId === null && !candidate.isArchived && (candidate.applicability === applicability || candidate.applicability === 'both'));

  async function save() {
    const trimmedName = name.trim();
    if (!category?.systemKey && !trimmedName) { setError(t('categoryNamesRequired')); return; }
    if (!householdId || !memberId) return;
    setStatus('saving'); setError(null);
    const now = new Date().toISOString();
    try {
      await repository.saveCategory({ id: category?.id ?? Crypto.randomUUID(), householdId: category ? category.householdId : householdId, parentId: category?.systemKey ? category.parentId : parentId || null, applicability: category?.systemKey ? category.applicability : applicability, systemKey: category?.systemKey ?? null,
        names: category?.systemKey ? category.names : { en: trimmedName, uk: trimmedName, ru: trimmedName }, icon, colorToken, iconColor, isArchived: category?.isArchived ?? false,
        createdAt: category?.createdAt ?? now, updatedAt: now, createdByMemberId: category?.createdByMemberId ?? memberId,
        updatedByMemberId: memberId, revision: (category?.revision ?? 0) + 1, deletedAt: null });
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
    {!category?.systemKey ? <AppTextField label={t('categoryName')} onChangeText={setName} value={name} /> : null}
    <View style={styles.preview}><View style={[styles.previewIcon, { backgroundColor: resolveCategoryColor(theme, colorToken) }]}><MaterialCommunityIcons color={iconColor} name={icon} size={30} /></View><Text style={[styles.previewName, { color: theme.text }]}>{name.trim() || t('categoryName')}</Text></View>
    <Text style={[styles.label, { color: theme.text }]}>{t('categoryColor')}</Text>
    <View accessibilityRole="radiogroup" style={styles.colorChoices}>{categoryColorOptions.map((option) => { const active = option.value === colorToken; return <Pressable accessibilityLabel={t(option.labelKey)} accessibilityRole="radio" accessibilityState={{ checked: active }} key={option.value} onPress={() => setColorToken(option.value)} style={[styles.colorChoice, { backgroundColor: option.value, borderColor: active ? theme.text : theme.border, borderWidth: active ? 3 : 1 }]}>{active ? <MaterialCommunityIcons color={resolveCategoryForeground(theme, option.value)} name="check" size={22} /> : null}</Pressable>; })}</View>
    <Text style={[styles.label, { color: theme.text }]}>{t('categoryIconColor')}</Text>
    <View accessibilityRole="radiogroup" style={styles.colorChoices}>{categoryIconColorOptions.map((color) => { const active = color === iconColor; return <Pressable accessibilityLabel={color} accessibilityRole="radio" accessibilityState={{ checked: active }} key={color} onPress={() => setIconColor(color)} style={[styles.colorChoice, { backgroundColor: color, borderColor: active ? theme.text : theme.border, borderWidth: active ? 3 : 1 }]}>{active ? <MaterialCommunityIcons color={resolveCategoryForeground(theme, color)} name="check" size={22} /> : null}</Pressable>; })}</View>
    <Text style={[styles.label, { color: theme.text }]}>{t('categoryIcon')}</Text>
    {categoryIconSets.map((set) => <View key={set.key} style={styles.iconSet}><Text style={[styles.iconSetLabel, { color: theme.muted }]}>{t(set.key)}</Text><View accessibilityRole="radiogroup" style={styles.iconChoices}>{set.icons.map((candidate) => { const active = candidate === icon; return <Pressable accessibilityLabel={candidate} accessibilityRole="radio" accessibilityState={{ checked: active }} key={candidate} onPress={() => setIcon(candidate)} style={[styles.iconChoice, { backgroundColor: active ? resolveCategoryColor(theme, colorToken) : theme.surface, borderColor: active ? resolveCategoryColor(theme, colorToken) : theme.border }]}><MaterialCommunityIcons color={active ? iconColor : theme.text} name={candidate} size={25} /></Pressable>; })}</View></View>)}
    {!category?.systemKey ? <><ChoiceGroup label={t('categoryUsage')} options={[{ label: t('expense'), value: 'expense' }, { label: t('income'), value: 'income' }, { label: t('incomeAndExpense'), value: 'both' }]} selected={applicability} onSelect={(value) => { setApplicability(value as Category['applicability']); setParentId(''); }} /><ChoiceGroup label={t('parentCategory')} options={[{ label: t('noParentCategory'), value: '' }, ...possibleParents.map((candidate) => ({ label: candidate.names[locale], value: candidate.id }))]} selected={parentId} onSelect={setParentId} /></> : null}
    {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    <PrimaryButton label={status === 'saving' ? t('saving') : t('save')} onPress={status === 'saving' ? undefined : () => void save()} />
    {category && !category.systemKey && !category.isArchived ? <Pressable accessibilityRole="button" onPress={archive} style={[styles.archiveButton, { borderColor: theme.danger }]}><Text style={[styles.archiveLabel, { color: theme.danger }]}>{t('archiveCategory')}</Text></Pressable> : null}
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
  preview: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }, previewIcon: { alignItems: 'center', borderRadius: radii.lg, height: 52, justifyContent: 'center', width: 52 }, previewName: { flex: 1, fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold },
  colorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl, marginTop: spacing.sm }, colorChoice: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  iconSet: { marginBottom: spacing.lg }, iconSetLabel: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold, marginBottom: spacing.sm }, iconChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, iconChoice: { alignItems: 'center', borderRadius: radii.md, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
});
