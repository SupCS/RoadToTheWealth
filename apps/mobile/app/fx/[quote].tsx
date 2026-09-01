import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Screen } from '@/src/design/layout';
import type { FxRate } from '@/src/fx/frankfurter';
import { useRateHistory } from '@/src/fx/use-fx';
import { formatDate, formatRate } from '@/src/i18n/formatters';
import { currencyCatalog, type CurrencyCode, useSettings } from '@/src/settings/settings-context';

function isCurrencyCode(value: string): value is CurrencyCode {
  return currencyCatalog.includes(value as CurrencyCode);
}

export default function RateHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ quote?: string }>();
  const { baseCurrency, isPairInverted, locale, t, theme, togglePairInverted } = useSettings();
  const quote = params.quote && isCurrencyCode(params.quote) ? params.quote : 'USD';
  const inverted = isPairInverted(baseCurrency, quote);
  const pairBase = inverted ? quote : baseCurrency;
  const pairQuote = inverted ? baseCurrency : quote;
  const { error, frankfurterError, loading, rates, source } = useRateHistory(pairBase, pairQuote);
  const values = rates.map((item) => item.rate);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const latest = rates.at(-1);

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <MaterialCommunityIcons color={theme.primary} name="chevron-left" size={28} />
        <Text style={[styles.backText, { color: theme.primary }]}>{t('back')}</Text>
      </Pressable>
      <Text style={[styles.eyebrow, { color: theme.muted }]}>{t('rateHistory')}</Text>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>{pairBase}/{pairQuote}</Text>
        <Pressable
          accessibilityLabel={t('invertRates')}
          accessibilityRole="button"
          onPress={() => togglePairInverted(baseCurrency, quote)}
          style={({ pressed }) => [styles.swapButton, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons color={theme.primary} name="swap-horizontal" size={26} />
        </Pressable>
      </View>
      <Text style={[styles.period, { color: theme.muted }]}>{t('oneMonth')}</Text>

      <Card>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{t('ratesUnavailable')}</Text> : null}
        {latest ? (
          <>
            <Text style={[styles.source, { color: theme.muted }]}>{t('fxSource')}: {source === 'nbg' ? 'NBG' : 'Frankfurter'}</Text>
            {frankfurterError ? <Text selectable style={[styles.diagnostic, { color: theme.muted }]}>{t('fxFrankfurterIssue')}: {frankfurterError}</Text> : null}
            <RateLineChart rates={rates} />
            <View style={[styles.stats, { borderTopColor: theme.border }]}>
              <Text style={[styles.stat, { color: theme.muted }]}>{t('minimum')}: {formatRate(min, locale)}</Text>
              <Text style={[styles.stat, { color: theme.muted }]}>{t('maximum')}: {formatRate(max, locale)}</Text>
            </View>
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

function RateLineChart({ rates }: { rates: FxRate[] }) {
  const { locale, theme } = useSettings();
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, rates.length - 1));
  const values = rates.map((item) => item.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  const span = max - min || Math.max(Math.abs(max) * 0.01, 0.0001);
  const graphHeight = 164;
  const verticalPadding = 12;
  const selected = rates[Math.min(selectedIndex, rates.length - 1)] ?? rates.at(-1)!;
  const point = (index: number) => ({
    x: rates.length === 1 ? width / 2 : (index / (rates.length - 1)) * width,
    y: verticalPadding + ((max - rates[index]!.rate) / span) * (graphHeight - verticalPadding * 2),
  });

  useEffect(() => setSelectedIndex(Math.max(0, rates.length - 1)), [rates]);

  return <View style={styles.lineChartSection}>
    <View style={styles.selectedValueRow}>
      <Text style={[styles.latest, { color: theme.text }]}>{formatRate(selected.rate, locale)}</Text>
      <Text style={[styles.selectedDate, { color: theme.muted }]}>{formatDate(selected.date, locale)}</Text>
    </View>
    <View style={styles.graphRow}>
      <View style={styles.yAxis}>
        <Text style={[styles.axisLabel, { color: theme.muted }]}>{formatRate(max, locale)}</Text>
        <Text style={[styles.axisLabel, { color: theme.muted }]}>{formatRate(mid, locale)}</Text>
        <Text style={[styles.axisLabel, { color: theme.muted }]}>{formatRate(min, locale)}</Text>
      </View>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.plot}>
        {[0, 0.5, 1].map((position) => <View key={position} style={[styles.gridLine, { backgroundColor: theme.border, top: verticalPadding + position * (graphHeight - verticalPadding * 2) }]} />)}
        {width > 0 ? rates.slice(0, -1).map((item, index) => {
          const start = point(index);
          const end = point(index + 1);
          const length = Math.hypot(end.x - start.x, end.y - start.y);
          const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
          return <View key={`${item.date}-line`} style={[styles.lineSegment, {
            backgroundColor: theme.accent,
            left: (start.x + end.x - length) / 2,
            top: (start.y + end.y) / 2 - 1,
            transform: [{ rotate: `${angle}deg` }],
            width: length,
          }]} />;
        }) : null}
        {width > 0 ? rates.map((item, index) => {
          const position = point(index);
          const active = index === selectedIndex;
          return <Pressable
            accessibilityLabel={`${formatDate(item.date, locale)}: ${formatRate(item.rate, locale)}`}
            accessibilityRole="button"
            key={item.date}
            onPress={() => setSelectedIndex(index)}
            style={[styles.pointTarget, { left: position.x - 16, top: position.y - 16 }]}
          >
            <View style={[styles.point, { backgroundColor: active ? theme.primary : theme.accent, borderColor: theme.surface }, active && styles.activePoint]} />
          </Pressable>;
        }) : null}
      </View>
    </View>
    <View style={styles.xAxisRow}>
      <Text style={[styles.range, { color: theme.muted }]}>{formatDate(rates[0]!.date, locale)}</Text>
      <Text style={[styles.range, { color: theme.muted }]}>{formatDate(rates.at(-1)!.date, locale)}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  backRow: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', marginBottom: 20, marginLeft: -8 },
  backText: { fontSize: 15, fontWeight: '700' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 34, fontWeight: '900', marginTop: 4 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  swapButton: { alignItems: 'center', borderRadius: 13, borderWidth: 1, justifyContent: 'center', padding: 9 },
  period: { fontSize: 14, marginBottom: 18, marginTop: 3 },
  latest: { fontSize: 30, fontVariant: ['tabular-nums'], fontWeight: '800' },
  source: { fontSize: 10, marginTop: 4 },
  diagnostic: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  lineChartSection: { marginTop: 18 },
  selectedValueRow: { alignItems: 'baseline', flexDirection: 'row', gap: 10 },
  selectedDate: { fontSize: 12 },
  graphRow: { flexDirection: 'row', marginTop: 14 },
  yAxis: { height: 164, justifyContent: 'space-between', paddingVertical: 5, width: 52 },
  axisLabel: { fontSize: 9, fontVariant: ['tabular-nums'], textAlign: 'right' },
  plot: { flex: 1, height: 164, marginLeft: 8, overflow: 'visible' },
  gridLine: { height: StyleSheet.hairlineWidth, left: 0, opacity: 0.7, position: 'absolute', right: 0 },
  lineSegment: { height: 2, position: 'absolute' },
  pointTarget: { alignItems: 'center', height: 32, justifyContent: 'center', position: 'absolute', width: 32 },
  point: { borderRadius: 5, borderWidth: 2, height: 10, width: 10 },
  activePoint: { borderRadius: 7, height: 14, width: 14 },
  xAxisRow: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 60, marginTop: 5 },
  range: { fontSize: 10 },
  stats: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 12 },
  stat: { fontSize: 12, fontVariant: ['tabular-nums'] },
  error: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
