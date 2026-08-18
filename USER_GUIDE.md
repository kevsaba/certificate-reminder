# Certificate Reminder - User Guide & Troubleshooting

## Installation

1. **Double-click** `CertificateReminder-8.0.0-macOS.dmg` to mount it
2. **Drag** `CertificateReminder.app` to **Applications**
3. **Launch** from Applications or Spotlight

---

## How to Quit the App

### Normal Quit (Should Work)
1. Click the **"Close App"** button in the top-right corner
2. The browser window should close
3. The app should quit automatically

### Force Quit (If App Gets Stuck)

**Option 1: Use the Quit Script**
```bash
./quit-app.sh
```

**Option 2: Manual Force Quit**
```bash
# Kill all Certificate Reminder processes
pkill -9 -f "certificate-reminder"

# Kill anything on port 3030
lsof -ti:3030 | xargs kill -9
```

**Option 3: Activity Monitor**
1. Open Activity Monitor (Applications → Utilities → Activity Monitor)
2. Search for "Certificate Reminder" or "bun"
3. Click the **X** button to quit the process

---

## Troubleshooting

### Problem: Emails Not Sending

**Possible Causes:**

1. **Microsoft Outlook not open**
   - **Solution**: Open Microsoft Outlook first, then try again

2. **Outlook not configured**
   - **Solution**: Make sure Outlook is set up with your email account

3. **AppleScript permissions**
   - **Solution**: Grant AppleScript permissions when prompted:
     - System Settings → Privacy & Security → Automation
     - Allow Safari (or your browser) to control Microsoft Outlook

4. **Wrong email address**
   - Check that the email addresses in your Excel file are correct
   - Make sure they match your Outlook contacts

**How to Check if Emails Are Sending:**

1. Open the Terminal app
2. Run:
   ```bash
   bun run dev
   ```
3. Look for log messages like:
   - ✅ `[Email] Email sent successfully to: someone@example.com`
   - ❌ `[Email] AppleScript error: ...`

### Problem: App Won't Start

**Check if already running:**
```bash
lsof -ti:3030
```

If it returns a number, the app is already running. Use the quit script above.

**Check the logs:**
```bash
bun run dev
```

Look for error messages in the output.

### Problem: "App Damaged" Warning

This is because the app isn't code-signed. **This is normal and safe!**

**To fix the warning:**
1. Control-click or right-click the app
2. Select "Open"
3. Click "Open" in the dialog
4. The app will open and macOS will remember it as safe

**Permanently fix (optional):**
```bash
xattr -cr -d com.apple.quarantine "/Applications/CertificateReminder.app"
```

---

## Testing the App

### Quick Test (No Email Required)

1. Launch the app
2. Upload a local Excel file with test certificate data
3. Click "Send Email Reminders"
4. Check the results:
   - You should see "Emails Sent: X" (where X is the number of expired certificates)
   - Check the Terminal/logs for `[Email] Email sent successfully` messages

### Full Test (Requires Microsoft Outlook)

1. **Open Microsoft Outlook** first
2. Launch the Certificate Reminder app
3. Upload your Excel file with certificate data
4. Upload your Word template (if using)
5. Click "Send Email Reminders"
6. Check Outlook's **Sent Items** folder to verify emails were sent

---

## Features

✅ **What Works:**
- Upload Excel files (.xlsx, .xls)
- Upload Word templates (.docx)
- Check certificate expiration dates
- Send email reminders via Microsoft Outlook
- Data persistence (saves your uploads)
- Runs from DMG (no installation required)
- No command line needed

⚠️ **Known Limitations:**
- Opens in Safari (not a true native window)
- Requires Microsoft Outlook to be open
- Not code-signed (shows warning on first launch)
- Must grant AppleScript permissions for email

---

## File Locations

**App Bundle:**
```
/Applications/CertificateReminder.app/
```

**Data Storage:**
```
~/Library/Application Support/CertificateReminder/data/
```

**Logs:**
To see real-time logs, run the backend manually (see "Problem: Emails Not Sending" above).

---

## Development & Updates

### If You're the Developer

To rebuild the app after making changes:

1. Build Next.js static export:
   ```bash
   bun run build
   ```

2. Rebuild DMG:
   ```bash
   ./build-dmg.sh
   ```

---

## Support

If you encounter issues not covered here:

1. Check the logs (see "Problem: Emails Not Sending" above)
2. Try quitting the app completely and relaunching
3. Make sure Microsoft Outlook is open and configured
4. Verify AppleScript permissions are granted

---

## Quick Reference

**Launch:**
```bash
open "/Applications/CertificateReminder.app"
```

**Quit (if stuck):**
```bash
./quit-app.sh
```

**Check logs:**
```bash
bun run dev
```
