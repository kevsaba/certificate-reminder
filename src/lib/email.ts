import { ReminderPayload } from '@/types';
import { spawn } from 'bun';

/**
 * Extracts the base category (template name) from a category string
 * Used as the email subject
 * @param category Category string (e.g., "FICHA - 2025")
 * @returns Base category (e.g., "FICHA")
 */
export function extractEmailSubject(category: string): string {
  // Remove year suffix and return base category
  const match = category.match(/^(.+?)\s*-\s*\d{4}/);
  return match ? match[1].trim().toUpperCase() : category.trim().toUpperCase();
}

export function buildOutlookEmailBody(payload: ReminderPayload): string {
  const body = payload.html || payload.message;

  return body.startsWith('<html>')
    ? body
    : `<html><body>${body}</body></html>`;
}

/**
 * Sends an email notification for an expired certificate using AppleScript
 * Uses HTML template with rich formatting (bold, colors, bullets)
 * @param payload Reminder payload with certificate details
 * @returns Promise with success status
 */
export async function sendEmailNotification(
  payload: ReminderPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!payload.html) {
      return {
        success: false,
        error: `MISSING_TEMPLATE: No Word template matched ${payload.category}; email was not sent.`,
      };
    }

    // Extract subject from category
    const subject = extractEmailSubject(payload.category);

    console.log(`[Email] Sending email to ${payload.email}: ${subject}`);

    // Wrap HTML in proper document structure for Outlook to recognize as HTML
    // Word templates generate HTML fragments, so we need to add <html><body> tags
    const wrappedBody = buildOutlookEmailBody(payload);

    // Escape special characters for AppleScript
    // IMPORTANT: We preserve HTML tags for rich formatting
    const escapedSubject = subject.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    const escapedBody = wrappedBody
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/"/g, '\\"')    // Escape quotes
      .replace(/\$/g, '\\$')    // Escape dollar signs
      .replace(/`/g, '\\`')     // Escape backticks
      .replace(/\n/g, '\\n')    // Escape newlines
      .replace(/\r/g, '\\r');   // Escape carriage returns

    // Use correct Microsoft Outlook AppleScript syntax for macOS
    // Note: Outlook on macOS uses "make new outgoing message" not "create message"
    // and recipients must use "to recipients" with email address record
    const script = `
      tell application "Microsoft Outlook"
        set newMsg to make new outgoing message with properties {subject:"${escapedSubject}", content:"${escapedBody}"}
        make new recipient at end of to recipients of newMsg with properties {email address:{address:"${payload.email}"}}
        send newMsg
      end tell
    `;

    const proc = spawn(['osascript', '-e', script]);
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error(`[Email] AppleScript error (exit code ${exitCode}):`, stderr);

      // Check if it's a permission error
      if (
        stderr.includes('not authorized') ||
        stderr.includes('not allowed') ||
        stderr.includes('permission') ||
        stderr.includes('not allowed to send Apple events')
      ) {
        return {
          success: false,
          error:
            'PERMISSION_DENIED: The app needs permission to control Microsoft Outlook. Please grant it in System Settings > Privacy & Security > Automation.',
        };
      }

      return {
        success: false,
        error: `AppleScript error: ${stderr}`,
      };
    }

    console.log(`[Email] ✓ Successfully sent email to ${payload.email}`);
    return { success: true };
  } catch (error) {
    console.error(`[Email] Failed to send to ${payload.email}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for permission-related errors
    if (
      errorMessage.includes('Apple Events') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('not allowed') ||
      errorMessage.includes('not authorized') ||
      errorMessage.includes('Not authorized to send Apple events')
    ) {
      return {
        success: false,
        error:
          'PERMISSION_DENIED: The app needs permission to control Microsoft Outlook. Please grant it in System Settings > Privacy & Security > Automation.',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sends multiple email notifications
 * Processes emails sequentially to avoid overwhelming Outlook
 * @param payloads Array of reminder payloads
 * @returns Promise with results summary
 */
export async function sendEmailNotifications(
  payloads: ReminderPayload[]
): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`[Email] Starting batch send of ${payloads.length} emails`);

  // Process sequentially to avoid rate limiting
  for (const payload of payloads) {
    const result = await sendEmailNotification(payload);

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${payload.email}: ${result.error}`);
      console.error(`[Email] Failed to send to ${payload.email}:`, result.error);
    }

    // Small delay between emails to be gentle with Outlook
    if (payloads.indexOf(payload) < payloads.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`[Email] Batch complete: ${sent} sent, ${failed} failed`);

  return {
    success: failed === 0,
    sent,
    failed,
    errors,
  };
}
