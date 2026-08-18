import { describe, expect, test } from 'bun:test';
import type { CertificateEntry, ReminderPayload, Template } from '@/types';
import { checkExpirations } from '../scheduler';
import { extractBaseCategory, getExpirationStatus } from '../expiration';
import { buildOutlookEmailBody, extractEmailSubject, sendEmailNotification } from '../email';
import { fillTemplate, matchTemplate, parseWordTemplateHtml } from '../word';

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

  test('TELEFORMACION has no template body when its page is missing', () => {
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

  test('every expired category is skipped when its matching Word template page is missing', async () => {
    const categories = [
      'FICHA - 2025',
      'CONSENTIMIENTO - 2025',
      'RENUNCIA - 2025',
      'APTO - 2025',
      'EPIS - 2025',
      'EPI - 2025',
      'FORMACION - 2025',
      'TELEFORMACION - 2025',
    ];
    const entries: CertificateEntry[] = categories.map((category, index) => ({
      id: `missing-${index}`,
      dni: `MISSING_${index}`,
      category,
      expirationDate: new Date('2026-01-10'),
      email: testRecipient,
    }));

    const result = await checkExpirations(entries, [], { channels: { email: false } });

    expect(result.remindersSent).toBe(0);
    expect(result.results).toHaveLength(categories.length);
    expect(result.results.every((entry) => entry.status === 'skipped')).toBe(true);
  });

  test('scheduler skips expired FORMACION and TELEFORMACION when TELEFORMACION template is missing', async () => {
    const entries: CertificateEntry[] = [
      {
        id: 'formacion',
        dni: 'MISSING_TEMPLATE',
        category: 'FORMACION - 2025',
        expirationDate: new Date('2026-01-10'),
        email: testRecipient,
      },
      {
        id: 'teleformacion',
        dni: 'MISSING_TEMPLATE_2',
        category: 'TELEFORMACION - 2025',
        expirationDate: new Date('2026-01-10'),
        email: testRecipient,
      },
    ];

    const result = await checkExpirations(entries, templatesWithoutTeleformacion, { channels: { email: false } });

    expect(result.remindersSent).toBe(0);
    expect(result.results).toEqual([
      expect.objectContaining({ category: 'FORMACION - 2025', status: 'skipped' }),
      expect.objectContaining({ category: 'TELEFORMACION - 2025', status: 'skipped' }),
    ]);
  });

  test('DEFAULT template is not used as a fallback for unknown documentation types', () => {
    expect(matchTemplate([{ type: 'DEFAULT', html: '<p>Fallback</p>' }], 'UNKNOWN')).toBeNull();
  });

  test('parser returns no templates instead of creating DEFAULT when no known page titles exist', () => {
    const templates = parseWordTemplateHtml('<p><strong>UNKNOWN</strong></p><p>Unknown body.</p>');

    expect(templates).toEqual([]);
  });

  test('missing middle pages do not break parsing or matching later template pages', () => {
    const templates = parseWordTemplateHtml([
      '<p><strong>FICHA</strong></p>',
      '<p>Ficha body.</p>',
      '<p><strong>APTO</strong></p>',
      '<p>Apto body.</p>',
      '<p><strong>RENUNCIA</strong></p>',
      '<p>Renuncia body.</p>',
    ].join(''));

    expect(templates.map((template) => template.type)).toEqual(['FICHA', 'APTO', 'RENUNCIA']);
    expect(matchTemplate(templates, 'FICHA')).toEqual(expect.objectContaining({ type: 'FICHA' }));
    expect(matchTemplate(templates, 'CONSENTIMIENTO')).toBeNull();
    expect(matchTemplate(templates, 'TELEFORMACION')).toBeNull();
    expect(matchTemplate(templates, 'APTO')).toEqual(expect.objectContaining({ type: 'APTO' }));
    expect(matchTemplate(templates, 'RENUNCIA')).toEqual(expect.objectContaining({ type: 'RENUNCIA' }));
  });

  test('custom categories are parsed from Word titles and matched to expired certificates', async () => {
    const templates = parseWordTemplateHtml([
      '<p><strong>FICHA</strong></p>',
      '<p>Ficha body.</p>',
      '<p><strong>SEGURIDAD</strong></p>',
      '<p>Seguridad body for [NAME] on [DATE].</p>',
    ].join(''), ['SEGURIDAD']);

    const result = await checkExpirations([
      {
        id: 'custom-category',
        dni: 'CUSTOM_CATEGORY',
        category: 'SEGURIDAD - 2025',
        expirationDate: new Date('2026-01-10'),
        email: testRecipient,
      },
    ], templates, { channels: { email: false } });

    expect(templates.map((template) => template.type)).toEqual(['FICHA', 'SEGURIDAD']);
    expect(matchTemplate(templates, 'SEGURIDAD')).toEqual(expect.objectContaining({ type: 'SEGURIDAD' }));
    expect(result.results).toEqual([
      expect.objectContaining({ category: 'SEGURIDAD - 2025', status: 'sent' }),
    ]);
  });

  test('custom category titles require a whole-title match, not a prefix match', () => {
    const templates = parseWordTemplateHtml(
      '<p><strong>SAFETY</strong></p><p>Safety body.</p>',
      ['SAFE']
    );

    expect(templates).toEqual([]);
  });

  test('category aliases normalize before matching and filtering', async () => {
    const templates = parseWordTemplateHtml(
      '<p><strong>TELEFORMACIÓN</strong></p><p>Teleformacion body.</p><p><strong>EPI</strong></p><p>Epi body.</p>'
    );

    const result = await checkExpirations([
      {
        id: 'formacion-alias',
        dni: 'ALIAS_1',
        category: 'FORMACION - 2025',
        expirationDate: new Date('2026-01-10'),
        email: testRecipient,
      },
      {
        id: 'epi-alias',
        dni: 'ALIAS_2',
        category: 'EPI - 2025',
        expirationDate: new Date('2026-01-10'),
        email: testRecipient,
      },
    ], templates, {
      channels: { email: false },
      enabledCategories: ['TELEFORMACION', 'EPIS'],
    });

    expect(templates.map((template) => template.type)).toEqual(['TELEFORMACION', 'EPIS']);
    expect(result.results.filter((entry) => entry.status === 'sent').map((entry) => entry.category).sort()).toEqual([
      'EPI - 2025',
      'FORMACION - 2025',
    ]);
  });

  test('email sender refuses to send when no template HTML is available', async () => {
    const payload = createPayload('FORMACION - 2025', templatesWithoutTeleformacion);

    await expect(sendEmailNotification(payload)).resolves.toEqual({
      success: false,
      error: 'MISSING_TEMPLATE: No Word template matched FORMACION - 2025; email was not sent.',
    });
  });
});
