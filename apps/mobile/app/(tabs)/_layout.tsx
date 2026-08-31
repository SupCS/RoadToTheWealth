import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/src/settings/settings-context';
import { controlSizes, fontSizes, fontWeights, spacing } from '@/src/design/tokens';

export default function TabLayout() {
  const { t, theme } = useSettings();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: controlSizes.tabBarContent + insets.bottom,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingTop: spacing.sm,
        },
        tabBarLabelStyle: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="home-variant-outline" size={size} /> }} />
      <Tabs.Screen name="transactions" options={{ title: t('transactions'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="format-list-bulleted" size={size} /> }} />
      <Tabs.Screen name="plan" options={{ title: t('plan'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="map-marker-path" size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('settings'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="cog-outline" size={size} /> }} />
    </Tabs>
  );
}
