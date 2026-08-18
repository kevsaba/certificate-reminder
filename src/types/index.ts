export interface CertificateEntry {
  id: string;
  name?: string;
  dni?: string;
  position?: string;
  category: string;
  startDate?: Date;
  expirationDate: Date;
  email: string;
  year?: number;
}

export interface Template {
  type: string;
  html: string;
}

export interface ReminderPayload {
  email: string;
  category: string;
  expirationDate: string;
  daysRemaining: number;
  message: string;
  html?: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  uploadedAt: Date;
  entries: CertificateEntry[];
}

export interface CheckResult {
  timestamp: Date;
  checked: number;
  remindersSent: number;
  emailsSent?: number;      // NEW
  emailsFailed?: number;    // NEW
  results: Array<{
    email: string;
    category: string;
    expirationDate: string;
    daysRemaining: number;
    status: 'sent' | 'failed' | 'skipped';
  }>;
}

export interface CheckOptions {
  channels?: {
    email?: boolean;
  };
  enabledCategories?: string[];
}

export interface AppData {
  entries: CertificateEntry[];
  templates: Template[];
}
