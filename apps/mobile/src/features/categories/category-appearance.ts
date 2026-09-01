import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { AppTheme } from '../../design/themes';

export type CategoryIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type CategoryColorToken = 'primary' | 'accent' | 'positive' | 'warning' | 'danger' | 'text' | 'muted';

type CategoryIconSetKey = 'categoryIconSetMoney' | 'categoryIconSetHome' | 'categoryIconSetFood' | 'categoryIconSetTravel' | 'categoryIconSetLife';

export const categoryIconSets: ReadonlyArray<Readonly<{ key: CategoryIconSetKey; icons: readonly CategoryIconName[] }>> = [
  { key: 'categoryIconSetMoney', icons: ['wallet', 'cash', 'cash-multiple', 'credit-card', 'bank', 'piggy-bank', 'chart-line', 'safe', 'currency-usd', 'receipt-text', 'sale', 'gift'] },
  { key: 'categoryIconSetHome', icons: ['home', 'home-city', 'key', 'lightbulb', 'water', 'flash', 'wifi', 'tools', 'sofa', 'bed', 'washing-machine', 'flower'] },
  { key: 'categoryIconSetFood', icons: ['cart', 'basket', 'food', 'food-apple', 'silverware-fork-knife', 'silverware', 'coffee', 'cup', 'pizza', 'hamburger', 'cake-variant', 'bottle-soda'] },
  { key: 'categoryIconSetTravel', icons: ['car', 'bus', 'train', 'subway', 'bike', 'walk', 'airplane', 'ferry', 'gas-station', 'parking', 'map-marker', 'briefcase'] },
  { key: 'categoryIconSetLife', icons: ['medical-bag', 'heart-pulse', 'dumbbell', 'school', 'book-open-variant', 'movie-open', 'gamepad-variant', 'music', 'paw', 'baby-face-outline', 'tshirt-crew', 'cellphone'] },
];

export const categoryColorTokens: readonly CategoryColorToken[] = ['primary', 'accent', 'positive', 'warning', 'danger', 'text', 'muted'];
export const categoryColorLabelKeys = {
  primary: 'categoryColor_primary', accent: 'categoryColor_accent', positive: 'categoryColor_positive',
  warning: 'categoryColor_warning', danger: 'categoryColor_danger', text: 'categoryColor_text', muted: 'categoryColor_muted',
} as const;

export function resolveCategoryColor(theme: AppTheme, token: string | null): string {
  return categoryColorTokens.includes(token as CategoryColorToken) ? theme[token as CategoryColorToken] : theme.primary;
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

export function resolveCategoryForeground(theme: AppTheme, token: string | null): string {
  const background = resolveCategoryColor(theme, token);
  return contrastRatio(theme.text, background) >= contrastRatio(theme.onPrimary, background) ? theme.text : theme.onPrimary;
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
