import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { themes, type ThemeId } from './src/design/themes';
import { locales, messages, type Locale } from './src/i18n/translations';

export default function App() {
  const [themeId, setThemeId] = useState<ThemeId>('wealth');
  const [locale, setLocale] = useState<Locale>('en');
  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
  const copy = messages[locale];

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
    >
      <StatusBar style={themeId === 'pirate' || themeId === 'contrast' ? 'light' : 'dark'} />

      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.primary }]}>RTTW</Text>
        <Text style={[styles.title, { color: theme.text }]}>Road To The Wealth</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>{copy.subtitle}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.eyebrow, { color: theme.muted }]}>{copy.balance}</Text>
        <Text style={[styles.balance, { color: theme.text }]}>₾ 12,480.50</Text>
        <View style={styles.metrics}>
          <View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>{copy.spent}</Text>
            <Text style={[styles.metricValue, { color: theme.danger }]}>₾ 1,842</Text>
          </View>
          <View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>{copy.goal}</Text>
            <Text style={[styles.metricValue, { color: theme.positive }]}>64%</Text>
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.progress, { backgroundColor: theme.accent }]} />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>{copy.language}</Text>
      <View style={styles.rowWrap}>
        {locales.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => setLocale(item.id)}
            style={[
              styles.pill,
              { backgroundColor: theme.surface, borderColor: locale === item.id ? theme.primary : theme.border },
            ]}
          >
            <Text style={styles.flag}>{item.flag}</Text>
            <Text style={[styles.pillText, { color: theme.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>{copy.appearance}</Text>
      <View style={styles.themeGrid}>
        {themes.map((item) => (
          <Pressable
            accessibilityLabel={item.name}
            accessibilityRole="button"
            key={item.id}
            onPress={() => setThemeId(item.id)}
            style={[
              styles.themeChoice,
              { backgroundColor: item.surface, borderColor: themeId === item.id ? theme.primary : item.border },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: item.primary }]} />
            <View style={[styles.swatch, { backgroundColor: item.accent }]} />
            <Text numberOfLines={1} style={[styles.themeName, { color: item.text }]}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 64,
  },
  header: { marginBottom: 24 },
  brand: { fontSize: 14, fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  card: { borderRadius: 24, borderWidth: 1, padding: 22 },
  eyebrow: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  balance: { fontSize: 36, fontWeight: '800', letterSpacing: -1.2, marginTop: 6 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  metricLabel: { fontSize: 12, marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: '700' },
  track: { borderRadius: 5, height: 8, marginTop: 18, overflow: 'hidden' },
  progress: { borderRadius: 5, height: 8, width: '64%' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 28 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { alignItems: 'center', borderRadius: 16, borderWidth: 2, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  flag: { fontSize: 18 },
  pillText: { fontSize: 14, fontWeight: '700' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeChoice: { alignItems: 'center', borderRadius: 16, borderWidth: 2, flexDirection: 'row', minWidth: '47%', paddingHorizontal: 10, paddingVertical: 12 },
  swatch: { borderRadius: 10, height: 20, marginRight: 5, width: 20 },
  themeName: { flex: 1, fontSize: 12, fontWeight: '700', marginLeft: 3 },
});
