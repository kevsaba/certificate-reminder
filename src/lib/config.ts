import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    address: string;
    name: string;
  };
}

export interface SimpleConfig {
  emailConfig?: EmailConfig;
}

const defaultConfig: SimpleConfig = {
  emailConfig: undefined,
};

function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getConfig(): SimpleConfig {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...defaultConfig, ...JSON.parse(data) };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(config: Partial<SimpleConfig>): SimpleConfig {
  ensureConfigDir();

  const currentConfig = getConfig();
  const newConfig = { ...currentConfig, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  return newConfig;
}

/**
 * Validates email configuration
 * @returns { valid: boolean; error?: string }
 */
export function validateEmailConfig(emailConfig: EmailConfig | undefined): { valid: boolean; error?: string } {
  if (!emailConfig) {
    return { valid: false, error: 'Email configuration is not set' };
  }

  const requiredFields: (keyof EmailConfig)[] = ['host', 'port', 'secure', 'auth', 'from'];

  for (const field of requiredFields) {
    if (!emailConfig[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate auth fields
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    return { valid: false, error: 'Email authentication credentials (user and pass) are required' };
  }

  // Validate from fields
  if (!emailConfig.from.address || !emailConfig.from.name) {
    return { valid: false, error: 'Email from address and name are required' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailConfig.from.address)) {
    return { valid: false, error: 'Invalid email format for from.address' };
  }

  // Validate port
  if (emailConfig.port < 1 || emailConfig.port > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }

  return { valid: true };
}

/**
 * Gets email configuration (validates before returning)
 * @returns EmailConfig or undefined if not configured or invalid
 */
export function getEmailConfig(): EmailConfig | undefined {
  const config = getConfig();

  if (!config.emailConfig) {
    return undefined;
  }

  const validation = validateEmailConfig(config.emailConfig);
  if (!validation.valid) {
    console.warn('Email configuration is invalid:', validation.error);
    return undefined;
  }

  return config.emailConfig;
}
