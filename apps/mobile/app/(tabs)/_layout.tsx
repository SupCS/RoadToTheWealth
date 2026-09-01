import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSettings } from '@/src/settings/settings-context';
import { controlSizes, fontSizes, fontWeights, spacing } from '@/src/design/tokens';

export default function TabLayout() {
  const { t, theme } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const scaledTabHeight = controlSizes.tabBarContent + Math.max(0, fontScale - 1) * 24;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: scaledTabHeight + insets.bottom,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          paddingTop: spacing.sm,
        },
        tabBarLabelStyle: { fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
        tabBarAllowFontScaling: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="home-variant-outline" size={size} /> }} />
      <Tabs.Screen name="transactions" options={{ title: t('transactions'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="format-list-bulleted" size={size} /> }} />
      <Tabs.Screen
        name="add"
        listeners={{ tabPress: (event) => { event.preventDefault(); router.push('/transaction/new'); } }}
        options={{
          title: t('add'),
          tabBarIcon: () => <View style={[styles.quickAdd, { backgroundColor: theme.primary, borderColor: theme.background }]}><MaterialCommunityIcons color={theme.onPrimary} name="plus" size={30} /></View>,
          tabBarLabelStyle: { color: theme.primary, fontSize: fontSizes.caption, fontWeight: fontWeights.bold },
        }}
      />
      <Tabs.Screen name="plan" options={{ title: t('plan'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="map-marker-path" size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: t('settings'), tabBarIcon: ({ color, size }) => <MaterialCommunityIcons color={color} name="cog-outline" size={size} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  quickAdd: { alignItems: 'center', borderRadius: 27, borderWidth: 4, height: 54, justifyContent: 'center', marginTop: -18, width: 54 },
});
