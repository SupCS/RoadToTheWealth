import { describe, expect, it } from 'vitest';

import { themes } from '../../design/themes';
import { categoryColorOptions, categoryIconSets, resolveCategoryColor, resolveCategoryForeground, resolveCategoryIcon } from './category-appearance';

describe('category appearance', () => {
  it('offers broad icon and fixed color choices', () => {
    expect(categoryIconSets.flatMap((set) => set.icons)).toHaveLength(60);
    expect(categoryColorOptions).toHaveLength(12);
  });

  it('keeps category background and icon colors stable across app themes', () => {
    for (const option of categoryColorOptions) {
      const colors = themes.map((theme) => resolveCategoryColor(theme, option.value));
      const foregrounds = themes.map((theme) => resolveCategoryForeground(theme, option.value));
      expect(new Set(colors)).toEqual(new Set([option.value]));
      expect(new Set(foregrounds).size).toBe(1);
    }
  });

  it('converts old semantic values to stable colors', () => {
    expect(new Set(themes.map((theme) => resolveCategoryColor(theme, 'primary'))).size).toBe(1);
  });

  it('maps icons stored by the legacy icon family to valid Material Community names', () => {
    expect(resolveCategoryIcon('restaurant')).toBe('silverware-fork-knife');
    expect(resolveCategoryIcon('medical')).toBe('medical-bag');
    expect(resolveCategoryIcon('bag')).toBe('shopping-outline');
    expect(resolveCategoryIcon('add-circle')).toBe('cash-plus');
  });
});
