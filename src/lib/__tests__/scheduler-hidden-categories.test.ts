import { describe, expect, test } from 'bun:test';
import { checkExpirations } from '../scheduler';
import { countHiddenEntries } from '../categories';
import { extractBaseCategory } from '../expiration';
import { normalizeTemplateType } from '../word';
import type { CertificateEntry, Template } from '@/types';

const templates: Template[] = [
  { type: 'FICHA', html: '<p>FICHA [NAME] [DATE]</p>' },
  { type: 'EPIS', html: '<p>EPIS [NAME] [DATE]</p>' },
];

function entry(dni: string, category: string, expirationDate: string): CertificateEntry {
  return {
    id: `${dni}_${category}`,
    dni,
    category,
    expirationDate: new Date(expirationDate),
    email: `${dni.toLowerCase()}@example.test`,
  };
}

function filterHidden(entries: CertificateEntry[], hidden: string[]): CertificateEntry[] {
  const hiddenSet = new Set(hidden.map((v) => normalizeTemplateType(v)));
  return entries.filter((e) => !hiddenSet.has(normalizeTemplateType(extractBaseCategory(e.category))));
}

describe('hidden categories are excluded from checkExpirations', () => {
  const entries = [
    entry('A', 'FICHA - 2024', '2025-01-01'),
    entry('A', 'EPIS - 2024', '2025-01-01'),
    entry('B', 'FICHA - 2024', '2025-01-01'),
  ];

  test('countHiddenEntries counts entries in hidden categories', () => {
    expect(countHiddenEntries(entries, ['FICHA'])).toBe(2);
  });

  test('after filtering, checkExpirations does not emit sent results for hidden categories', async () => {
    const visible = filterHidden(entries, ['FICHA']);
    const result = await checkExpirations(visible, templates, { channels: { email: false } });
    const sentCategories = result.results
      .filter((r) => r.status === 'sent')
      .map((r) => extractBaseCategory(r.category));
    expect(sentCategories).not.toContain('FICHA');
    expect(sentCategories).toContain('EPIS');
  });

  test('empty hidden list leaves entries untouched', () => {
    expect(filterHidden(entries, []).length).toBe(entries.length);
  });
});
