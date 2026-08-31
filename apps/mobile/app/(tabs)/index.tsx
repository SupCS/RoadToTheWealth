import { StyleSheet, Text, View } from 'react-native';

import { Card, layoutStyles, Screen, ScreenHeader } from '@/src/design/layout';
import { useSettings } from '@/src/settings/settings-context';

export default function HomeScreen() {
  const { t, theme } = useSettings();
  return (
    <Screen>
      <ScreenHeader eyebrow="RTTW" title="Road To The Wealth" />
      <Text style={[styles.subtitle, { color: theme.muted }]}>{t('subtitle')}</Text>
      <Card>
        <Text style={[layoutStyles.eyebrow, { color: theme.muted }]}>{t('balance')}</Text>
        <Text style={[styles.balance, { color: theme.text }]}>₾ 12,480.50</Text>
        <View style={[layoutStyles.row, styles.metrics]}>
          <View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>{t('spent')}</Text>
            <Text style={[layoutStyles.metric, { color: theme.danger }]}>₾ 1,842</Text>
          </View>
          <View>
            <Text style={[styles.metricLabel, { color: theme.muted }]}>{t('goal')}</Text>
            <Text style={[layoutStyles.metric, { color: theme.positive }]}>64%</Text>
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.progress, { backgroundColor: theme.accent }]} />
        </View>
        <Text style={[styles.prototype, { color: theme.muted }]}>{t('prototype')}</Text>
      </Card>
      <Text style={[layoutStyles.sectionTitle, { color: theme.text }]}>{t('recent')}</Text>
      <Card>
        <Text style={[styles.empty, { color: theme.muted }]}>{t('noTransactions')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20, marginTop: -14 },
  balance: { fontSize: 36, fontWeight: '800', letterSpacing: -1.2, marginTop: 6 },
  metrics: { marginTop: 24 },
  metricLabel: { fontSize: 12, marginBottom: 4 },
  track: { borderRadius: 5, height: 8, marginTop: 18, overflow: 'hidden' },
  progress: { borderRadius: 5, height: 8, width: '64%' },
  prototype: { fontSize: 11, marginTop: 10, textAlign: 'right' },
  empty: { fontSize: 14, textAlign: 'center' },
});
