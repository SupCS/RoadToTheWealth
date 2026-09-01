import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '@/src/settings/settings-context';
import { fontSizes, fontWeights, lineHeights, radii, spacing } from '@/src/design/tokens';
import { formatMoney, type Money } from '@/src/domain/money/money';
import { getIntlLocale } from '@/src/i18n/formatters';
import type { Locale } from '@/src/i18n/translations';

export function Screen({ children }: PropsWithChildren) {
  const { theme } = useSettings();
  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.screen}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({ action, eyebrow, title }: { action?: ReactNode; eyebrow?: string; title: string }) {
  const { theme } = useSettings();
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow}</Text> : null}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {action}
      </View>
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
      <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

type AppTextFieldProps = TextInputProps & {
  error?: string;
  label: string;
};

export function AppTextField({ error, label, style, ...props }: AppTextFieldProps) {
  const { theme } = useSettings();
  const borderColor = error ? theme.danger : theme.border;
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        allowFontScaling
        placeholderTextColor={theme.muted}
        style={[styles.field, { backgroundColor: theme.surface, borderColor, color: theme.text }, style]}
        {...props}
      />
      {error ? <Text style={[styles.fieldError, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function MoneyText({
  locale,
  tone = 'default',
  value,
  variant = 'body',
}: {
  locale: Locale;
  tone?: 'danger' | 'default' | 'positive';
  value: Money;
  variant?: 'body' | 'display' | 'metric';
}) {
  const { theme } = useSettings();
  const color = tone === 'danger' ? theme.danger : tone === 'positive' ? theme.positive : theme.text;
  const formatted = formatMoney(value, getIntlLocale(locale));
  return (
    <Text
      accessibilityLabel={formatted}
      style={[
        styles.money,
        variant === 'display' && styles.moneyDisplay,
        variant === 'metric' && styles.moneyMetric,
        { color },
      ]}
    >
      {formatted}
    </Text>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { theme } = useSettings();
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.state}>
      <ActivityIndicator color={theme.primary} size="small" />
      {label ? <Text style={[styles.stateText, { color: theme.muted }]}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  const { theme } = useSettings();
  return (
    <View accessibilityLiveRegion="polite" style={styles.state}>
      <MaterialCommunityIcons color={theme.danger} name="alert-circle-outline" size={30} />
      <Text style={[styles.stateText, { color: theme.muted }]}>{message}</Text>
      {onRetry && retryLabel ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, { borderColor: theme.primary, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.retryText, { color: theme.primary }]}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const layoutStyles = StyleSheet.create({
  body: { fontSize: fontSizes.body, lineHeight: lineHeights.body },
  eyebrow: { fontSize: fontSizes.label, fontWeight: fontWeights.extraBold, letterSpacing: 1.5, textTransform: 'uppercase' },
  metric: { fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold, marginBottom: spacing.md, marginTop: spacing.xxl },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: { flexGrow: 1, paddingBottom: spacing.huge, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  header: { marginBottom: spacing.xxl },
  eyebrow: { fontSize: 13, fontWeight: fontWeights.black, letterSpacing: 3, marginBottom: spacing.xs },
  title: { flex: 1, fontSize: fontSizes.title, fontWeight: fontWeights.extraBold, letterSpacing: -0.9, lineHeight: lineHeights.title },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  card: { borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl },
  emptyIcon: { alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold, marginBottom: spacing.sm, textAlign: 'center' },
  body: { fontSize: fontSizes.body, lineHeight: lineHeights.body, textAlign: 'center' },
  button: { alignItems: 'center', borderRadius: radii.lg, marginTop: spacing.xl, minHeight: 48, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  buttonText: { fontSize: fontSizes.button, fontWeight: fontWeights.extraBold },
  fieldGroup: { gap: spacing.sm, marginBottom: spacing.lg },
  fieldLabel: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  field: { borderRadius: radii.lg, borderWidth: 1, fontSize: fontSizes.body, minHeight: 50, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  fieldError: { fontSize: fontSizes.label, lineHeight: lineHeights.caption },
  money: { fontSize: fontSizes.body, fontVariant: ['tabular-nums'], fontWeight: fontWeights.bold },
  moneyDisplay: { fontSize: fontSizes.display, fontWeight: fontWeights.extraBold, letterSpacing: -1.2, lineHeight: lineHeights.display },
  moneyMetric: { fontSize: fontSizes.subtitle, fontWeight: fontWeights.extraBold, lineHeight: lineHeights.subtitle },
  state: { alignItems: 'center', gap: spacing.md, justifyContent: 'center', minHeight: 96, padding: spacing.lg },
  stateText: { fontSize: fontSizes.body, lineHeight: lineHeights.body, textAlign: 'center' },
  retry: { borderRadius: radii.md, borderWidth: 1, minHeight: 44, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  retryText: { fontSize: fontSizes.body, fontWeight: fontWeights.bold },
});
