import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/src/settings/settings-context';

export function Screen({ children }: PropsWithChildren) {
  const { theme } = useSettings();
  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.screen}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const { theme } = useSettings();
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  const { theme } = useSettings();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function EmptyState({ description, icon, title }: { description: string; icon: ReactNode; title: string }) {
  const { theme } = useSettings();
  return (
    <Card>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{description}</Text>
    </Card>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  const { theme } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed ? 0.82 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: theme.id === 'contrast' ? '#000000' : '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

export const layoutStyles = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  metric: { fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 24 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flexGrow: 1, paddingBottom: 40, paddingHorizontal: 20, paddingTop: 18 },
  header: { marginBottom: 22 },
  eyebrow: { fontSize: 13, fontWeight: '900', letterSpacing: 3, marginBottom: 5 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.9 },
  card: { borderRadius: 22, borderWidth: 1, padding: 20 },
  emptyIcon: { alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { alignItems: 'center', borderRadius: 16, marginTop: 18, paddingHorizontal: 18, paddingVertical: 15 },
  buttonText: { fontSize: 16, fontWeight: '800' },
});
