import * as xlsx from 'xlsx';
import { CertificateEntry } from '@/types';

export function parseExcel(buffer: Buffer): CertificateEntry[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' });

  // Find the "Overview" or "Worksheet" sheet (case insensitive)
  const sheetName = workbook.SheetNames.find(name =>
    name.toLowerCase().includes('overview') ||
    name.toLowerCase() === 'overview' ||
    name.toLowerCase().includes('worksheet') ||
    name.toLowerCase() === 'worksheet'
  );

  if (!sheetName) {
    throw new Error('Could not find "Overview" or "Worksheet" sheet in the Excel file. Available sheets: ' + workbook.SheetNames.join(', '));
  }

  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet) as Record<string, unknown>[];

  return data.map((row) => {
    // Try new format first (Worksheet), then fall back to old format (Overview)
    const id = String(
      row['Pseudonym'] ??
      row['pseudonym'] ??
      row['ID'] ??
      row['id'] ??
      row['DNI'] ??
      row['dni'] ??
      ''
    );

    const name = row['Nombre Trabajador'] ?? row['nombre trabajador'] ?? undefined;
    const dni = row['DNI'] ?? row['dni'] ?? undefined;
    const position = row['Puesto Trabajo'] ?? row['puesto trabajo'] ?? undefined;
    const category = String(row['Documentacion'] ?? row['documentacion'] ?? row['Category'] ?? row['category'] ?? '');
    const email = String(row['email'] ?? row['Email'] ?? '');
    const expirationDate = parseExcelDate(
      row['Fecha Caducidad'] ??
      row['fecha caducidad'] ??
      row['expirationDate'] ??
      row['Date']
    );

    // Parse start date (new format)
    let startDate: Date | undefined;
    if (row['Fecha Alta'] ?? row['fecha alta']) {
      startDate = parseExcelDate(row['Fecha Alta'] ?? row['fecha alta']);
    }

    // Extract year from category (e.g., "FICHA - 2025" -> 2025)
    const year = extractYearFromCategory(category);

    const entry: CertificateEntry = {
      id,
      category,
      email,
      expirationDate,
    };

    // Add optional fields if they exist
    if (name) (entry as any).name = String(name);
    if (dni) (entry as any).dni = String(dni);
    if (position) (entry as any).position = String(position);
    if (startDate && !isNaN(startDate.getTime())) (entry as any).startDate = startDate;
    if (year) (entry as any).year = year;

    return entry;
  }).filter((entry) =>
    entry.id && entry.category && entry.email && !isNaN(entry.expirationDate.getTime())
  );
}

function parseExcelDate(value: unknown): Date {
  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    // Excel serial date format
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  if (typeof value === 'string') {
    // Handle string dates like "23/10/2025" or "2025-10-23"
    const trimmedValue = value.trim();

    // Try DD/MM/YYYY format first (common in Spanish locales)
    const dmyMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Try YYYY-MM-DD format
    const ymdMatch = trimmedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Fall back to standard Date parsing
    const parsed = new Date(trimmedValue);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Return Invalid Date (NaN) - will be filtered out by isNaN check
  return new Date('');
}

/**
 * Extracts the year from a category string (e.g., "FICHA - 2025" -> 2025)
 * @param category Category string that may contain a year
 * @returns Year number or undefined
 */
export function extractYearFromCategory(category: string): number | undefined {
  const match = category.match(/(\d{4})/);
  return match ? parseInt(match[1]) : undefined;
}

export function getExcelHeaders(buffer: Buffer): string[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' });

  // Accept both "Overview" and "Worksheet" sheets
  const sheetName = workbook.SheetNames.find(name =>
    name.toLowerCase().includes('overview') ||
    name.toLowerCase() === 'overview' ||
    name.toLowerCase().includes('worksheet') ||
    name.toLowerCase() === 'worksheet'
  );

  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length === 0) return [];
  return (data[0] as string[]).map((h) => String(h).trim());
}

export function validateExcel(buffer: Buffer): { valid: boolean; error?: string } {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });

    // Accept both "Overview" and "Worksheet" sheets
    const sheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('overview') ||
      name.toLowerCase() === 'overview' ||
      name.toLowerCase().includes('worksheet') ||
      name.toLowerCase() === 'worksheet'
    );

    if (!sheetName) {
      return {
        valid: false,
        error: 'Excel file must contain a sheet named "Overview" or "Worksheet". Available: ' + workbook.SheetNames.join(', ')
      };
    }

    const headers = getExcelHeaders(buffer).map(h => h.toLowerCase().trim());

    // Check for at least email and expiration date (most important)
    const hasEmail = headers.some(h => h === 'email');
    const hasDate = headers.some(h => h.includes('caducidad') || h.includes('fecha') || h.includes('expiration'));
    const hasCategory = headers.some(h => h.includes('documentacion') || h.includes('category'));
    const hasId = headers.some(h => h.includes('pseudonym') || h.includes('id') || h.includes('dni'));

    if (!hasEmail || !hasDate) {
      return {
        valid: false,
        error: 'Excel file must contain "email" and "Fecha Caducidad" columns. Found: ' + headers.join(', ')
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid Excel file format: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}
