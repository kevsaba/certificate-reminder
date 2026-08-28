import { describe, expect, test } from 'bun:test';
import { visibleCategories, countHiddenEntries } from '../categories';
import type { CertificateEntry } from '@/types';

function entry(category: string): CertificateEntry {
  return {
    id: category,
    category,
    expirationDate: new Date('2026-01-01'),
    email: 'user@example.test',
  };
}

describe('visibleCategories', () => {
  test('returns sorted, deduped union of excel and custom when hidden is empty', () => {
    expect(visibleCategories(['B', 'A'], ['C', 'A'], [])).toEqual(['A', 'B', 'C']);
  });

  test('filters out hidden categories present in the excel list', () => {
    expect(visibleCategories(['A', 'B', 'C'], [], ['B'])).toEqual(['A', 'C']);
  });

  test('filters out hidden categories present in the custom list', () => {
    expect(visibleCategories([], ['A', 'B', 'C'], ['B'])).toEqual(['A', 'C']);
  });

  test('hidden wins when the same value appears in custom and hidden', () => {
    // Defensive: the API keeps these disjoint on writes, but the pure
    // filter documents what happens if they ever overlap.
    expect(visibleCategories([], ['FICHA'], ['FICHA'])).toEqual([]);
  });

  test('normalizes case: hidden matches regardless of casing in inputs', () => {
    expect(visibleCategories(['ficha'], [], ['FICHA'])).toEqual([]);
  });
});

describe('countHiddenEntries', () => {
  test('returns 0 when hidden is empty', () => {
    expect(countHiddenEntries([entry('FICHA'), entry('EPIS')], [])).toBe(0);
  });

  test('counts entries whose base category matches a hidden entry', () => {
    const entries = [
      entry('FICHA - 2025'),
      entry('FICHA - 2024'),
      entry('EPIS - 2025'),
      entry('APTO - 2025'),
    ];
    expect(countHiddenEntries(entries, ['FICHA'])).toBe(2);
  });

  test('matches after base-category extraction and normalization', () => {
    // FORMACION should be normalized to TELEFORMACION by extractBaseCategory
    const entries = [entry('FORMACION - 2025'), entry('TELEFORMACION - 2024')];
    expect(countHiddenEntries(entries, ['TELEFORMACION'])).toBe(2);
  });

  test('is case-insensitive on the hidden list', () => {
    const entries = [entry('FICHA - 2025')];
    expect(countHiddenEntries(entries, ['ficha'])).toBe(1);
  });
});
