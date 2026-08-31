import { Pressable, StyleSheet, Text, View } from 'react-native';

import { layoutStyles, Screen, ScreenHeader } from '@/src/design/layout';
import { themes } from '@/src/design/themes';
import { locales } from '@/src/i18n/translations';
import { currencyCatalog, useSettings } from '@/src/settings/settings-context';

export default function SettingsScreen() {
  const {
    baseCurrency,
    enabledCurrencies,
    locale,
    setBaseCurrency,
    setEnabledCurrencies,
    setLocale,
    setThemeId,
    t,
    theme,
    themeId,
  } = useSettings();

  function toggleCurrency(currency: (typeof currencyCatalog)[number]) {
    if (currency === baseCurrency) return;
    setEnabledCurrencies(
      enabledCurrencies.includes(currency)
        ? enabledCurrencies.filter((item) => item !== currency)
        : [...enabledCurrencies, currency],
    );
  }
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

      <Text style={[layoutStyles.sectionTitle, { color: theme.text }]}>{t('currencySettings')}</Text>
      <Text style={[styles.label, { color: theme.muted }]}>{t('baseCurrency')}</Text>
      <View style={styles.wrap}>
        {currencyCatalog.map((currency) => (
          <Pressable
            accessibilityRole="button"
            key={`base-${currency}`}
            onPress={() => setBaseCurrency(currency)}
            style={[styles.codePill, { backgroundColor: baseCurrency === currency ? theme.primary : theme.surface, borderColor: baseCurrency === currency ? theme.primary : theme.border }]}
          >
            <Text style={[styles.codeText, { color: baseCurrency === currency && theme.id !== 'contrast' ? '#FFFFFF' : theme.text }]}>{currency}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, styles.visibleLabel, { color: theme.muted }]}>{t('visibleCurrencies')}</Text>
      <View style={styles.wrap}>
        {currencyCatalog.filter((currency) => currency !== baseCurrency).map((currency) => {
          const selected = enabledCurrencies.includes(currency);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={`visible-${currency}`}
              onPress={() => toggleCurrency(currency)}
              style={[styles.checkPill, { backgroundColor: theme.surface, borderColor: selected ? theme.primary : theme.border }]}
            >
              <Text style={[styles.checkMark, { color: selected ? theme.primary : theme.muted }]}>{selected ? '✓' : '○'}</Text>
              <Text style={[styles.codeText, { color: theme.text }]}>{currency}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: theme.muted }]}>{t('currencyHint')}</Text>
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
  label: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  visibleLabel: { marginTop: 20 },
  codePill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  checkPill: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  checkMark: { fontSize: 14, fontWeight: '900' },
  codeText: { fontSize: 13, fontWeight: '800' },
});
