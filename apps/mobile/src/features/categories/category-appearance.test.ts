import { describe, expect, it } from 'vitest';

import { themes } from '../../design/themes';
import { categoryColorTokens, categoryIconSets, resolveCategoryColor, resolveCategoryForeground, resolveCategoryIcon } from './category-appearance';

describe('category appearance', () => {
  it('offers broad icon and themed color choices', () => {
    expect(categoryIconSets.flatMap((set) => set.icons)).toHaveLength(60);
    expect(categoryColorTokens).toHaveLength(7);
  });

  it('resolves every color through the active theme and chooses a foreground', () => {
    for (const theme of themes) for (const token of categoryColorTokens) {
      expect(resolveCategoryColor(theme, token)).toBe(theme[token]);
      expect([theme.text, theme.onPrimary]).toContain(resolveCategoryForeground(theme, token));
    }
  });

  it('maps icons stored by the legacy icon family to valid Material Community names', () => {
    expect(resolveCategoryIcon('restaurant')).toBe('silverware-fork-knife');
    expect(resolveCategoryIcon('medical')).toBe('medical-bag');
    expect(resolveCategoryIcon('bag')).toBe('shopping-outline');
    expect(resolveCategoryIcon('add-circle')).toBe('cash-plus');
  });
});
