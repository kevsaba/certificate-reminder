import { extractBaseCategory } from './expiration';
import type { CertificateEntry } from '@/types';

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

export function visibleCategories(
  excelDerived: string[],
  custom: string[],
  hidden: string[],
): string[] {
  const hiddenSet = new Set(hidden.map(normalize));
  const union = new Set<string>();
  for (const value of excelDerived) union.add(normalize(value));
  for (const value of custom) union.add(normalize(value));
  return Array.from(union)
    .filter((value) => !hiddenSet.has(value))
    .sort();
}

export function countHiddenEntries(
  entries: CertificateEntry[],
  hidden: string[],
): number {
  if (hidden.length === 0) return 0;
  const hiddenSet = new Set(hidden.map(normalize));
  let count = 0;
  for (const entry of entries) {
    const baseCategory = normalize(extractBaseCategory(entry.category));
    if (hiddenSet.has(baseCategory)) count++;
  }
  return count;
}
