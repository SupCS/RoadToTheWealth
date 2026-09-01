import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { AppTheme } from '../../design/themes';

export type CategoryIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type CategoryColorValue = `#${string}`;
type CategoryColorLabelKey = 'categoryColorEmerald' | 'categoryColorBlue' | 'categoryColorCyan' | 'categoryColorViolet' | 'categoryColorPurple' | 'categoryColorPink' | 'categoryColorRed' | 'categoryColorOrange' | 'categoryColorAmber' | 'categoryColorLime' | 'categoryColorBrown' | 'categoryColorSlate';

type CategoryIconSetKey = 'categoryIconSetMoney' | 'categoryIconSetHome' | 'categoryIconSetFood' | 'categoryIconSetTravel' | 'categoryIconSetLife';

export const categoryIconSets: ReadonlyArray<Readonly<{ key: CategoryIconSetKey; icons: readonly CategoryIconName[] }>> = [
  { key: 'categoryIconSetMoney', icons: ['wallet', 'cash', 'cash-multiple', 'credit-card', 'bank', 'piggy-bank', 'chart-line', 'safe', 'currency-usd', 'receipt-text', 'sale', 'gift'] },
  { key: 'categoryIconSetHome', icons: ['home', 'home-city', 'key', 'lightbulb', 'water', 'flash', 'wifi', 'tools', 'sofa', 'bed', 'washing-machine', 'flower'] },
  { key: 'categoryIconSetFood', icons: ['cart', 'basket', 'food', 'food-apple', 'silverware-fork-knife', 'silverware', 'coffee', 'cup', 'pizza', 'hamburger', 'cake-variant', 'bottle-soda'] },
  { key: 'categoryIconSetTravel', icons: ['car', 'bus', 'train', 'subway', 'bike', 'walk', 'airplane', 'ferry', 'gas-station', 'parking', 'map-marker', 'briefcase'] },
  { key: 'categoryIconSetLife', icons: ['medical-bag', 'heart-pulse', 'dumbbell', 'school', 'book-open-variant', 'movie-open', 'gamepad-variant', 'music', 'paw', 'baby-face-outline', 'tshirt-crew', 'cellphone'] },
];

export const categoryColorOptions: ReadonlyArray<Readonly<{ labelKey: CategoryColorLabelKey; value: CategoryColorValue }>> = [
  { labelKey: 'categoryColorEmerald', value: '#168A65' }, { labelKey: 'categoryColorBlue', value: '#2878C8' },
  { labelKey: 'categoryColorCyan', value: '#168AA3' }, { labelKey: 'categoryColorViolet', value: '#6D5BD0' },
  { labelKey: 'categoryColorPurple', value: '#8B4FB3' }, { labelKey: 'categoryColorPink', value: '#C94F83' },
  { labelKey: 'categoryColorRed', value: '#C74747' }, { labelKey: 'categoryColorOrange', value: '#D66A2C' },
  { labelKey: 'categoryColorAmber', value: '#C58B16' }, { labelKey: 'categoryColorLime', value: '#668F2D' },
  { labelKey: 'categoryColorBrown', value: '#815B45' }, { labelKey: 'categoryColorSlate', value: '#596579' },
];

export const categoryIconColorOptions: readonly CategoryColorValue[] = [
  '#FFFFFF', '#111827', ...categoryColorOptions.map((option) => option.value),
];

const legacyThemeColors: Readonly<Record<string, CategoryColorValue>> = {
  primary: '#168A65', accent: '#C58B16', positive: '#668F2D', warning: '#D66A2C',
  danger: '#C74747', text: '#596579', muted: '#6D5BD0',
};

export function resolveCategoryColor(_theme: AppTheme, storedColor: string | null): CategoryColorValue {
  if (storedColor && /^#[0-9a-f]{6}$/i.test(storedColor)) return storedColor as CategoryColorValue;
  return legacyThemeColors[storedColor ?? ''] ?? categoryColorOptions[0]!.value;
}

const legacyIconNames: Readonly<Record<string, CategoryIconName>> = {
  restaurant: 'silverware-fork-knife',
  medical: 'medical-bag',
  bag: 'shopping-outline',
  'add-circle': 'cash-plus',
};

export function resolveCategoryIcon(icon: string | null): CategoryIconName {
  if (!icon) return 'shape-outline';
  return legacyIconNames[icon] ?? icon as CategoryIconName;
}

export function resolveCategoryForeground(theme: AppTheme, storedColor: string | null, storedIconColor?: string | null): CategoryColorValue {
  if (storedIconColor && /^#[0-9a-f]{6}$/i.test(storedIconColor)) return storedIconColor as CategoryColorValue;
  const background = resolveCategoryColor(theme, storedColor);
  return contrastRatio('#111827', background) >= contrastRatio('#FFFFFF', background) ? '#111827' : '#FFFFFF';
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
}
