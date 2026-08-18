import mammoth from 'mammoth';

export interface Template {
  type: string;
  html: string;
}

export async function parseWordTemplates(buffer: Buffer): Promise<Template[]> {
  const result = await mammoth.convertToHtml({ buffer });
  return parseWordTemplateHtml(result.value);
}

export function parseWordTemplateHtml(html: string): Template[] {
  const knownTypes = ['FICHA', 'CONSENTIMIENTO', 'TELEFORMACION', 'APTO', 'EPIS', 'EPI', 'RENUNCIA', 'FORMACION'];
  const templates: Template[] = [];
  
  const starts: Array<{ index: number; type: string }> = [];
  
  const startRegex = new RegExp(`^\\s*<p[^>]*>\\s*<strong>\\s*(${knownTypes.join('|')})`, 'i');
  const startMatch = html.match(startRegex);
  if (startMatch) {
    starts.push({ index: 0, type: startMatch[1].toUpperCase() });
  }
  
  const sectionRegex = new RegExp(
    `(</p>\\s*)(<p[^>]*>\\s*(?:<br\\s*/?>\\s*)?<strong>\\s*(${knownTypes.join('|')})[\\s\\S]*?</strong>)`,
    'gi'
  );
  
  let match;
  while ((match = sectionRegex.exec(html)) !== null) {
    const type = match[3].toUpperCase();
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
  const docUpper = documentationType.toUpperCase();

  // Map FORMACION to TELEFORMACION
  if (docUpper.includes('FORMACION')) {
    return templates.find(t => t.type === 'TELEFORMACION') || null;
  }

  // Check for specific template types
  if (docUpper.includes('FICHA')) {
    return templates.find(t => t.type === 'FICHA') || null;
  }
  if (docUpper.includes('CONSENT')) {
    return templates.find(t => t.type === 'CONSENTIMIENTO') || null;
  }
  if (docUpper.includes('TELEFORM')) {
    return templates.find(t => t.type === 'TELEFORMACION') || null;
  }
  if (docUpper.includes('APTO')) {
    return templates.find(t => t.type === 'APTO') || null;
  }
  if (docUpper.includes('EPI')) {
    return templates.find(t => t.type === 'EPIS' || t.type === 'EPI') || null;
  }
  if (docUpper.includes('RENUNC')) {
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
