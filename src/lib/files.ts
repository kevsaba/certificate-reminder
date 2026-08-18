import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CertificateEntry, Template, AppData } from '@/types';
import { parseExcel } from './excel';
import { parseWordTemplates } from './word';

const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const APP_DATA_FILE = path.join(DATA_DIR, 'app-data.json');

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function saveExcelFile(buffer: Buffer, filename: string): { id: string; path: string } {
  ensureDirs();
  
  const id = uuidv4();
  const ext = path.extname(filename);
  const newFilename = `${id}${ext}`;
  const filePath = path.join(UPLOADS_DIR, newFilename);
  
  fs.writeFileSync(filePath, buffer);
  
  return { id, path: filePath };
}

export function getLatestExcelFile(): { id: string; path: string; filename: string } | null {
  ensureDirs();
  
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .map(f => ({
      name: f,
      path: path.join(UPLOADS_DIR, f),
      mtime: fs.statSync(path.join(UPLOADS_DIR, f)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) return null;
  
  return {
    id: path.basename(files[0].name, path.extname(files[0].name)),
    path: files[0].path,
    filename: files[0].name,
  };
}

export function saveWordTemplates(buffer: Buffer): Template[] {
  ensureDirs();
  
  const templatesPath = path.join(DATA_DIR, 'templates.docx');
  fs.writeFileSync(templatesPath, buffer);
  
  return [];
}

export function getWordTemplatesPath(): string | null {
  ensureDirs();
  const templatesPath = path.join(DATA_DIR, 'templates.docx');
  return fs.existsSync(templatesPath) ? templatesPath : null;
}

export async function loadWordTemplates(): Promise<Template[]> {
  const templatesPath = getWordTemplatesPath();
  if (!templatesPath) return [];
  
  const buffer = fs.readFileSync(templatesPath);
  return parseWordTemplates(buffer);
}

export function saveAppData(data: AppData): void {
  ensureDirs();
  fs.writeFileSync(APP_DATA_FILE, JSON.stringify(data, null, 2));
}

export function loadAppData(): AppData | null {
  ensureDirs();
  
  if (!fs.existsSync(APP_DATA_FILE)) return null;
  
  try {
    const data = JSON.parse(fs.readFileSync(APP_DATA_FILE, 'utf-8'));
    if (data.entries) {
      data.entries = data.entries.map((e: CertificateEntry) => ({
        ...e,
        expirationDate: new Date(e.expirationDate),
      }));
    }
    return data;
  } catch {
    return null;
  }
}

export function clearUploads(): void {
  ensureDirs();
  const files = fs.readdirSync(UPLOADS_DIR);
  for (const file of files) {
    fs.unlinkSync(path.join(UPLOADS_DIR, file));
  }
  if (fs.existsSync(APP_DATA_FILE)) {
    fs.unlinkSync(APP_DATA_FILE);
  }
}
