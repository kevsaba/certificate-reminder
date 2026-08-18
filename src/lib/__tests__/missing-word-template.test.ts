import { describe, expect, test } from 'bun:test';
import type { ReminderPayload, Template } from '@/types';
import { extractBaseCategory, getExpirationStatus } from '../expiration';
import { buildOutlookEmailBody, extractEmailSubject } from '../email';
import { fillTemplate, matchTemplate } from '../word';

const testRecipient = process.env.CERT_REMINDER_TEST_EMAIL || 'recipient@example.test';

function createPayload(category: string, templates: Template[]): ReminderPayload {
  const expirationDate = new Date('2026-01-10');
  const baseCategory = extractBaseCategory(category);
  const template = matchTemplate(templates, baseCategory);
  const expirationStatus = getExpirationStatus({
    id: category,
    dni: category.replace(/\W/g, '_'),
    category,
    expirationDate,
    email: testRecipient,
  });

  const message = `${testRecipient} ${category} expired (${expirationStatus.reason})`;

  return {
    email: testRecipient,
    category,
    expirationDate: expirationDate.toISOString().split('T')[0],
    daysRemaining: expirationStatus.daysUntil ?? 0,
    message,
    html: template ? fillTemplate(template, 'Kevin Sabatino', '10/1/2026') : undefined,
  };
}

describe('missing Word template behavior', () => {
  const templatesWithoutTeleformacion: Template[] = [
    {
      type: 'FICHA',
      html: '<p><strong>FICHA</strong></p><p>Ficha body for [NAME] on [DATE].</p>',
    },
    {
      type: 'CONSENTIMIENTO',
      html: '<p><strong>CONSENTIMIENTO</strong></p><p>Consentimiento body.</p>',
    },
    {
      type: 'RENUNCIA',
      html: '<p><strong>RENUNCIA</strong></p><p>Renuncia body.</p>',
    },
    {
      type: 'EPI',
      html: '<p><strong>EPI</strong></p><p>EPI body.</p>',
    },
  ];

  test('FORMACION maps to TELEFORMACION and has no template body when TELEFORMACION is missing', () => {
    const payload = createPayload('FORMACION - 2025', templatesWithoutTeleformacion);

    expect(payload.email).toBe(testRecipient);
    expect(extractBaseCategory(payload.category)).toBe('TELEFORMACION');
    expect(matchTemplate(templatesWithoutTeleformacion, extractBaseCategory(payload.category))).toBeNull();
    expect(payload.html).toBeUndefined();
    expect(extractEmailSubject(payload.category)).toBe('FORMACION');
    expect(buildOutlookEmailBody(payload)).toBe(
      `<html><body>${testRecipient} FORMACION - 2025 expired (DATE_BASED)</body></html>`
    );
  });

  test('TELEFORMACION also falls back to the plain expired message when its page is missing', () => {
    const payload = createPayload('TELEFORMACION - 2025', templatesWithoutTeleformacion);

    expect(payload.email).toBe(testRecipient);
    expect(extractBaseCategory(payload.category)).toBe('TELEFORMACION');
    expect(matchTemplate(templatesWithoutTeleformacion, extractBaseCategory(payload.category))).toBeNull();
    expect(payload.html).toBeUndefined();
    expect(extractEmailSubject(payload.category)).toBe('TELEFORMACION');
    expect(buildOutlookEmailBody(payload)).toBe(
      `<html><body>${testRecipient} TELEFORMACION - 2025 expired (DATE_BASED)</body></html>`
    );
  });

  test('an available matching template still produces the Word template HTML', () => {
    const payload = createPayload('FICHA - 2025', templatesWithoutTeleformacion);

    expect(payload.html).toContain('Ficha body for Kevin Sabatino on 10/1/2026.');
    expect(buildOutlookEmailBody(payload)).toContain('<strong>FICHA</strong>');
  });
});
