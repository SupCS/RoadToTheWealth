import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/src/settings/settings-context';

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
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="home-variant-outline" size={size} /> }} />
      <Tabs.Screen name="transactions" options={{ title: t('transactions'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="format-list-bulleted" size={size} /> }} />
      <Tabs.Screen name="plan" options={{ title: t('plan'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="map-marker-path" size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('settings'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="cog-outline" size={size} /> }} />
    </Tabs>
  );
}
