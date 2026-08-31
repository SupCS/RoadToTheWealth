import { Pressable, StyleSheet, Text, View } from 'react-native';

import { layoutStyles, Screen, ScreenHeader } from '@/src/design/layout';
import { themes } from '@/src/design/themes';
import { locales } from '@/src/i18n/translations';
import { useSettings } from '@/src/settings/settings-context';

export default function SettingsScreen() {
  const { locale, setLocale, setThemeId, t, theme, themeId } = useSettings();
  return (
    <Screen>
      <ScreenHeader title={t('settings')} />
      <Text style={[layoutStyles.sectionTitle, styles.firstSection, { color: theme.text }]}>{t('language')}</Text>
      <View style={styles.wrap}>
        {locales.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => setLocale(item.id)}
            style={[styles.pill, { backgroundColor: theme.surface, borderColor: locale === item.id ? theme.primary : theme.border }]}
          >
            <Text style={styles.flag}>{item.flag}</Text>
            <Text style={[styles.pillText, { color: theme.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[layoutStyles.sectionTitle, { color: theme.text }]}>{t('appearance')}</Text>
      <View style={styles.grid}>
        {themes.map((item) => (
          <Pressable
            accessibilityLabel={item.name}
            accessibilityRole="button"
            key={item.id}
            onPress={() => setThemeId(item.id)}
            style={[styles.themeChoice, { backgroundColor: item.surface, borderColor: themeId === item.id ? theme.primary : item.border }]}
          >
            <View style={[styles.swatch, { backgroundColor: item.primary }]} />
            <View style={[styles.swatch, { backgroundColor: item.accent }]} />
            <Text numberOfLines={1} style={[styles.themeName, { color: item.text }]}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.hint, { color: theme.muted }]}>{t('preferencesHint')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  firstSection: { marginTop: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { alignItems: 'center', borderRadius: 16, borderWidth: 2, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  flag: { fontSize: 18 },
  pillText: { fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeChoice: { alignItems: 'center', borderRadius: 16, borderWidth: 2, flexDirection: 'row', minWidth: '47%', paddingHorizontal: 10, paddingVertical: 12 },
  swatch: { borderRadius: 10, height: 20, marginRight: 5, width: 20 },
  themeName: { flex: 1, fontSize: 12, fontWeight: '700', marginLeft: 3 },
  hint: { fontSize: 13, lineHeight: 19, marginTop: 18 },
});
