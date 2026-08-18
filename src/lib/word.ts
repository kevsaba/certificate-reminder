import mammoth from 'mammoth';

export interface Template {
  type: string;
  html: string;
}

export const BUILT_IN_TEMPLATE_TYPES = [
  'FICHA',
  'CONSENTIMIENTO',
  'TELEFORMACION',
  'TELEFORMACIÓN',
  'APTO',
  'EPIS',
  'EPI',
  'RENUNCIA',
  'FORMACION',
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeTemplateType(type: string): string {
  const normalized = type.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'FORMACION') return 'TELEFORMACION';
  if (normalized === 'EPI') return 'EPIS';

  return normalized;
}

export function getKnownTemplateTypes(customCategories: string[] = []): string[] {
  return Array.from(new Set(
    [...BUILT_IN_TEMPLATE_TYPES, ...customCategories]
      .flatMap(category => [category.trim().toUpperCase(), normalizeTemplateType(category)])
      .filter(Boolean)
  ));
}

export async function parseWordTemplates(buffer: Buffer, customCategories: string[] = []): Promise<Template[]> {
  const result = await mammoth.convertToHtml({ buffer });
  return parseWordTemplateHtml(result.value, customCategories);
}

export function parseWordTemplateHtml(html: string, customCategories: string[] = []): Template[] {
  const knownTypes = getKnownTemplateTypes(customCategories);
  const templates: Template[] = [];
  const knownTypePattern = knownTypes
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  
  const starts: Array<{ index: number; type: string }> = [];
  
  const titleBoundary = '(?=\\s|<|&nbsp;|\\u00a0|:|-)';
  const startRegex = new RegExp(`^\\s*<p[^>]*>\\s*<strong>\\s*(${knownTypePattern})${titleBoundary}`, 'i');
  const startMatch = html.match(startRegex);
  if (startMatch) {
    starts.push({ index: 0, type: normalizeTemplateType(startMatch[1]) });
  }
  
  const sectionRegex = new RegExp(
    `(</p>\\s*)(<p[^>]*>\\s*(?:<br\\s*/?>\\s*)?<strong>\\s*(${knownTypePattern})${titleBoundary}[\\s\\S]*?</strong>)`,
    'gi'
  );
  
  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    const type = normalizeTemplateType(match[3]);
    const pStart = match.index + match[1].length;
    starts.push({ index: pStart, type });
  }
  
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i < starts.length - 1 ? starts[i + 1].index : html.length;
    const content = html.substring(start, end).trim();
    
    if (content.length > 0) {
      templates.push({
        type: starts[i].type,
        html: content,
      });
    }
  }

  return templates;
}

export function fillTemplate(template: Template, name: string, date: string): string {
  let html = template.html;
  html = html.replace(/\[NAME\]/g, name);
  html = html.replace(/\[DATE\]/g, date);
  html = html.replace(/\[CURRENT YEAR\]/g, new Date().getFullYear().toString());
  return html;
}

export function matchTemplate(templates: Template[], documentationType: string): Template | null {
  const templateType = normalizeTemplateType(documentationType);
  const exactMatch = templates.find(t => normalizeTemplateType(t.type) === templateType);

  if (exactMatch) return exactMatch;

  // Map FORMACION to TELEFORMACION
  if (templateType.includes('FORMACION')) {
    return templates.find(t => t.type === 'TELEFORMACION') || null;
  }

  // Check for specific template types
  if (templateType.includes('FICHA')) {
    return templates.find(t => t.type === 'FICHA') || null;
  }
  if (templateType.includes('CONSENT')) {
    return templates.find(t => t.type === 'CONSENTIMIENTO') || null;
  }
  if (templateType.includes('TELEFORM')) {
    return templates.find(t => t.type === 'TELEFORMACION') || null;
  }
  if (templateType.includes('APTO')) {
    return templates.find(t => t.type === 'APTO') || null;
  }
  if (templateType.includes('EPI')) {
    return templates.find(t => t.type === 'EPIS' || t.type === 'EPI') || null;
  }
  if (templateType.includes('RENUNC')) {
    return templates.find(t => t.type === 'RENUNCIA') || null;
  }

  return null;
}

export function extractNameFromEmail(email: string): string {
  const parts = email.split('@')[0].split('.');
  if (parts.length >= 2) {
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  return email.split('@')[0];
}
