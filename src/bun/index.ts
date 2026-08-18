// Bun backend for CertificateReminder
import { serve, spawn } from 'bun';
import { parseExcel, validateExcel } from '../lib/excel';
import { parseWordTemplates } from '../lib/word';
import { checkExpirations } from '../lib/scheduler';
import { checkOutlookPermission, isOutlookRunning } from '../lib/permissions';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import type { AppData, CertificateEntry } from '../types';

// Set the data directory to user's Application Support directory
// This ensures the app can write to it even when bundled
const APP_DATA_DIR = join(homedir(), 'Library', 'Application Support', 'CertificateReminder');
const DATA_DIR = join(APP_DATA_DIR, 'data');
const APP_DATA_FILE = join(DATA_DIR, 'app-data.json');

// Ensure data directories exist
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Local implementations of data functions with correct paths
function saveAppData(data: AppData): void {
  writeFileSync(APP_DATA_FILE, JSON.stringify(data, null, 2));
}

function loadAppData(): AppData | null {
  if (!existsSync(APP_DATA_FILE)) return null;

  try {
    const data = JSON.parse(readFileSync(APP_DATA_FILE, 'utf-8'));
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

const PORT = 3030;

console.log('CertificateReminder Bun backend starting...');

// Create a server instance that we can stop later
let server: any = null;

// Shutdown function
function shutdown() {
  console.log('Shutting down CertificateReminder...');
  // Use more aggressive shutdown
  setTimeout(() => {
    console.log('Exiting...');
    // Try multiple methods to ensure exit
    try {
      process.kill(process.pid, 'SIGTERM');
    } catch (e) {
      // If that fails, try exit
      process.exit(0);
    }
  }, 50);
}

// Serve the API routes
server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;

    // Handle file upload
    if (url.pathname === '/api/upload' && method === 'POST') {
      try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string | null;

        if (!file) {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const buffer = await file.arrayBuffer();

        if (type === 'word' || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
          const templates = await parseWordTemplates(Buffer.from(buffer));

          const existingData = loadAppData();
          saveAppData({
            entries: existingData?.entries || [],
            templates,
          });

          return new Response(JSON.stringify({
            type: 'templates',
            templates,
            count: templates.length,
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const validation = validateExcel(Buffer.from(buffer));

        if (!validation.valid) {
          return new Response(JSON.stringify({ error: validation.error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const entries = parseExcel(Buffer.from(buffer));

        const existingData = loadAppData();
        saveAppData({
          entries,
          templates: existingData?.templates || [],
        });

        return new Response(JSON.stringify({
          type: 'entries',
          entries,
          count: entries.length,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error('Upload error:', error);
        return new Response(JSON.stringify({ error: 'Failed to process file' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle certificate check
    if (url.pathname === '/api/check' && (method === 'POST' || method === 'GET')) {
      try {
        const appData = loadAppData();

        if (!appData || appData.entries.length === 0) {
          return new Response(JSON.stringify({ error: 'No Excel file uploaded yet' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const templates = appData.templates || [];
        let enabledCategories: string[] | undefined;

        if (method === 'POST') {
          try {
            const body = await req.json();
            if (Array.isArray(body.enabledCategories)) {
              enabledCategories = body.enabledCategories.filter((category: unknown): category is string =>
                typeof category === 'string'
              );
            }
          } catch {
            enabledCategories = undefined;
          }
        }

        const result = await checkExpirations(appData.entries, templates, {
          channels: { email: true },
          enabledCategories,
        });

        return new Response(JSON.stringify({
          success: true,
          result: {
            ...result,
            emailsSent: (result as any).emailsSent || 0,
            emailsFailed: (result as any).emailsFailed || 0,
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error('Check error:', error);
        return new Response(JSON.stringify({ error: 'Failed to check expirations' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle shutdown
    if (url.pathname === '/api/shutdown' && method === 'POST') {
      // Send success response
      const response = new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });

      // Trigger shutdown after response is sent
      setTimeout(shutdown, 100);

      return response;
    }

    // Handle email sending
    if (url.pathname === '/api/send-email' && method === 'POST') {
      try {
        const { recipient, subject, body } = await req.json();

        if (!recipient || !subject || !body) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        console.log(`[Email] Sending to ${recipient}: ${subject}`);

        // Create AppleScript to send email via Outlook
        // Note: Outlook on macOS uses "outgoing message" not "message"
        // and requires email address as a record {address:"..."}
        // IMPORTANT: Preserve HTML tags for rich formatting and wrap in <html><body> tags
        const wrappedBody = body.startsWith('<html>')
          ? body
          : `<html><body>${body}</body></html>`;

        const escapedSubject = subject.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
        const escapedBody = wrappedBody
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/"/g, '\\"')    // Escape quotes
          .replace(/\$/g, '\\$')   // Escape dollar signs
          .replace(/`/g, '\\`')    // Escape backticks
          .replace(/\n/g, '\\n')   // Escape newlines
          .replace(/\r/g, '\\r');  // Escape carriage returns

        const script = `
          tell application "Microsoft Outlook"
            set newMessage to make new outgoing message with properties {subject:"${escapedSubject}", content:"${escapedBody}"}
            make new recipient at end of to recipients of newMessage with properties {email address:{address:"${recipient}"}}
            send newMessage
          end tell
        `;

        const proc = spawn(['osascript', '-e', script]);
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          console.error('[Email] AppleScript error:', stderr);

          // Check if it's a permission error
          if (stderr.includes('not authorized') || stderr.includes('not allowed') || stderr.includes('permission')) {
            return new Response(JSON.stringify({
              error: 'PERMISSION_DENIED: The app needs permission to control Microsoft Outlook. Please grant it in System Settings > Privacy & Security > Automation.'
            }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ error: stderr || 'Failed to send email' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        console.log(`[Email] Successfully sent to ${recipient}`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[Email] Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to send email' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle permission check
    if (url.pathname === '/api/permissions' && method === 'GET') {
      try {
        const outlookPermission = await checkOutlookPermission();
        const outlookRunning = await isOutlookRunning();

        return new Response(
          JSON.stringify({
            outlook: {
              permission: outlookPermission.granted,
              running: outlookRunning,
              error: outlookPermission.error,
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to check permissions' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Serve static files from Next.js build
    try {
      // When bundled, static files are in Contents/Resources/app/static/
      // In development, they're in the out directory
      let staticPath: string;
      try {
        // Try bundled path first
        const testPath = import.meta.dir + '/../static/index.html';
        Bun.file(testPath);
        staticPath = import.meta.dir + '/../static';
      } catch {
        // Fall back to development path
        staticPath = import.meta.dir + '/../../out';
      }

      let filePath = staticPath + url.pathname;

      // Try index.html for directory requests
      if (filePath.endsWith('/') || url.pathname === '/') {
        filePath = staticPath + '/index.html';
      } else if (!filePath.includes('.')) {
        // If no extension, try index.html
        filePath = filePath + '/index.html';
      }

      const file = Bun.file(filePath);
      if (file.size > 0) {
        // Set correct content type for HTML
        if (filePath.endsWith('.html')) {
          return new Response(file, {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        return new Response(file);
      }
    } catch (e) {
      // File not found
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running on http://localhost:${PORT}`);

// Auto-open browser after server starts
setTimeout(() => {
  try {
    // Use shell command to open browser (more reliable)
    const proc = spawn([
      'sh',
      '-c',
      `open "http://localhost:${PORT}"`
    ]);
    console.log('Browser open command executed');
  } catch (error) {
    console.error('Failed to open browser:', error);
  }
}, 1500);

// Export for Electrobun
export const greet = (name: string) => {
  return `Hello from Bun, ${name}!`;
};

export const getServerUrl = () => {
  return `http://localhost:${PORT}`;
};

// Electrobun will call this when the app starts
// This ensures the window opens automatically
export const onStart = async () => {
  console.log('CertificateReminder backend started');
  // The window will be opened automatically by Electrobun
  // based on the autoOpen config in electrobun.config.ts
};
