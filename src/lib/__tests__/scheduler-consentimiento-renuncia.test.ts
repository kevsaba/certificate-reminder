import { describe, expect, test } from 'bun:test';
import { checkExpirations } from '../scheduler';
import type { CertificateEntry } from '@/types';

function createEntry(
  dni: string,
  category: string,
  expirationDate: string,
  email = `${dni.toLowerCase()}@example.test`
): CertificateEntry {
  return {
    id: `${dni}_${category}_${expirationDate}`,
    dni,
    category,
    expirationDate: new Date(expirationDate),
    email,
  };
}

async function sentCategories(entries: CertificateEntry[]): Promise<string[]> {
  const result = await checkExpirations(entries, [], { channels: { email: false } });
  return result.results
    .filter((entry) => entry.status === 'sent')
    .map((entry) => entry.category)
    .sort();
}

describe('CONSENTIMIENTO/RENUNCIA either-or logic', () => {
  test('sends only RENUNCIA when it expired later', async () => {
    await expect(sentCategories([
      createEntry('CASE1', 'CONSENTIMIENTO - 2025', '2026-01-10'),
      createEntry('CASE1', 'RENUNCIA - 2025', '2026-02-10'),
    ])).resolves.toEqual(['RENUNCIA - 2025']);
  });

  test('sends only CONSENTIMIENTO when it expired later', async () => {
    await expect(sentCategories([
      createEntry('CASE2', 'CONSENTIMIENTO - 2025', '2026-02-10'),
      createEntry('CASE2', 'RENUNCIA - 2025', '2026-01-10'),
    ])).resolves.toEqual(['CONSENTIMIENTO - 2025']);
  });

  test('sends neither when one paired certificate is still valid', async () => {
    await expect(sentCategories([
      createEntry('CASE3', 'CONSENTIMIENTO - 2026', '2027-02-10'),
      createEntry('CASE3', 'RENUNCIA - 2025', '2026-01-10'),
    ])).resolves.toEqual([]);

    await expect(sentCategories([
      createEntry('CASE4', 'CONSENTIMIENTO - 2025', '2026-01-10'),
      createEntry('CASE4', 'RENUNCIA - 2026', '2027-02-10'),
    ])).resolves.toEqual([]);
  });

  test('sends CONSENTIMIENTO when both expire on the same date', async () => {
    await expect(sentCategories([
      createEntry('CASE5', 'CONSENTIMIENTO - 2025', '2026-01-10'),
      createEntry('CASE5', 'RENUNCIA - 2025', '2026-01-10'),
    ])).resolves.toEqual(['CONSENTIMIENTO - 2025']);
  });

  test('keeps other categories independent', async () => {
    await expect(sentCategories([
      createEntry('CASE8', 'FICHA - 2025', '2026-01-15'),
      createEntry('CASE8', 'APTO - 2025', '2026-01-20'),
      createEntry('CASE8', 'EPIS - 2025', '2026-01-25'),
    ])).resolves.toEqual([
      'APTO - 2025',
      'EPIS - 2025',
      'FICHA - 2025',
    ]);
  });
});
