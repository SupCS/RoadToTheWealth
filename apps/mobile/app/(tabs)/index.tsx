import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen, ScreenHeader } from '@/src/design/layout';
import { DashboardOverview } from '@/src/features/dashboard/dashboard-overview';
import { useSettings } from '@/src/settings/settings-context';

export default function HomeScreen() {
  const { t, theme } = useSettings();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader eyebrow="RTTW" title={t('overview')} action={<Pressable accessibilityLabel={t('addTransaction')} accessibilityRole="button" onPress={() => router.push('/transaction/new')} style={({ pressed }) => [styles.addButton, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}><MaterialCommunityIcons color={theme.onPrimary} name="plus" size={28} /></Pressable>} />
      <Text style={[styles.subtitle, { color: theme.muted }]}>{t('dashboardSubtitle')}</Text>
      <DashboardOverview />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 20, marginTop: -18 },
  addButton: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
});
