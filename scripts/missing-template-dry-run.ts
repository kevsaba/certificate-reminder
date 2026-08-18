import type { ReminderPayload, Template } from '@/types';
import { buildOutlookEmailBody, extractEmailSubject } from '../src/lib/email';
import { extractBaseCategory, getExpirationStatus } from '../src/lib/expiration';
import { fillTemplate, matchTemplate } from '../src/lib/word';

const recipient = process.env.CERT_REMINDER_TEST_EMAIL || 'recipient@example.test';

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

function createPayload(category: string): ReminderPayload {
  const expirationDate = new Date('2026-01-10');
  const baseCategory = extractBaseCategory(category);
  const template = matchTemplate(templatesWithoutTeleformacion, baseCategory);
  const expirationStatus = getExpirationStatus({
    id: category,
    dni: category.replace(/\W/g, '_'),
    category,
    expirationDate,
    email: recipient,
  });
  const message = `${recipient} ${category} expired (${expirationStatus.reason})`;

  return {
    email: recipient,
    category,
    expirationDate: expirationDate.toISOString().split('T')[0],
    daysRemaining: expirationStatus.daysUntil ?? 0,
    message,
    html: template ? fillTemplate(template, 'Kevin Sabatino', '10/1/2026') : undefined,
  };
}

for (const category of ['FORMACION - 2025', 'TELEFORMACION - 2025', 'FICHA - 2025']) {
  const payload = createPayload(category);

  console.log('---');
  console.log(`To: ${payload.email}`);
  console.log(`Category: ${payload.category}`);
  console.log(`Base category: ${extractBaseCategory(payload.category)}`);
  console.log(`Subject: ${extractEmailSubject(payload.category)}`);
  console.log(`Uses Word template: ${payload.html ? 'yes' : 'no'}`);
  console.log('Outlook body:');
  console.log(buildOutlookEmailBody(payload));
}
