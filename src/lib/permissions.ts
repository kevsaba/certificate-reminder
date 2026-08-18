import { spawn } from 'bun';

/**
 * Check if the app has AppleScript/Outlook automation permission
 * Runs a harmless test command to see if permission is granted
 */
export async function checkOutlookPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    // Test AppleScript access by checking if we can access System Events
    // This will trigger the permission dialog if not granted
    const script = `tell application "System Events" to return (name of processes) contains "Microsoft Outlook"`;
    const proc = spawn(['osascript', '-e', script]);
    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { granted: false, error: stderr || 'Permission denied' };
    }

    return { granted: true };
  } catch (error) {
    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if Microsoft Outlook is running
 */
export async function isOutlookRunning(): Promise<boolean> {
  try {
    const script = `tell application "System Events" to return (name of processes) contains "Microsoft Outlook"`;
    const proc = spawn(['osascript', '-e', script]);
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Check if the app has automation permission for Microsoft Outlook
 * This is more specific than the general check above
 */
export async function checkOutlookAutomationPermission(): Promise<{
  granted: boolean;
  error?: string;
}> {
  try {
    // Try to tell Outlook to do something harmless
    const script = `tell application "Microsoft Outlook" to return name`;
    const proc = spawn(['osascript', '-e', script]);
    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      // Check if it's a permission error
      if (stderr.includes('not allowed') || stderr.includes('not authorized')) {
        return { granted: false, error: 'Automation permission not granted' };
      }
      // Outlook might not be running
      if (stderr.includes('not running')) {
        return { granted: true, error: 'Outlook not running' };
      }
      return { granted: false, error: stderr || 'Unknown error' };
    }

    return { granted: true };
  } catch (error) {
    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
