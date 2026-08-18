# Certificate Reminder - Quick Start Guide

## Installation (Recommended Method with Installer Script)

### 1. Download & Run Installer
If you received `Install-CertificateReminder.command` along with this DMG:
- Double-click `Install-CertificateReminder.command`
- If you see "unidentified developer", right-click and select "Open"
- The installer will automatically remove security attributes and open this DMG

### 2. Install
Drag **CertificateReminder.app** to your **Applications** folder.

### 3. Launch
**Option A: Double-click the app** (if window doesn't open, see below)
**Option B: Use the launcher script** (recommended - see below)

---

## Installation (Manual Method)

If you didn't receive the installer script:

### 1. Manual Quarantine Removal
Open Terminal and run:
```bash
xattr -cr ~/Downloads/CertificateReminder-9.0.0-macOS.dmg
```
(Adjust the path if you downloaded to a different location)

### 2. Install
Drag **CertificateReminder.app** to your **Applications** folder.

### 3. Launch
**Option A: Double-click the app**
**Option B: Use the launcher script** (recommended - see below)

**First launch only**: If you see a security warning, right-click the app and select "Open". This only happens once.

---

## About the Launcher Script

The DMG includes `launch-app.command` which:
- ✅ Launches the app automatically
- ✅ Waits for the server to start
- ✅ Opens your browser to the app
- ✅ Provides helpful status messages

**To use it:**
1. Copy `launch-app.command` to your Desktop or Applications folder
2. Double-click `launch-app.command` to start the app
3. The app will open in your browser automatically

**Note**: If you double-click the app directly and the window doesn't open, simply open your browser and go to `http://localhost:3030`

---

## First Time Setup

### Granting Outlook Permission (Required)

When you first send email reminders, you'll see a prompt asking for permission:

1. **You'll see**: "Certificate Reminder" wants to control "Microsoft Outlook"
2. **Click**: "Open System Settings"
3. **Go to**: Privacy & Security → Automation
4. **Check the box** next to "Microsoft Outlook"
5. **Close** System Settings

That's it! The app can now send emails through Outlook.

---

## How to Use

1. **Launch the app** from Applications
2. **Upload your Excel file** with certificate data
3. **(Optional) Upload Word templates** for custom emails
4. **Enable or disable categories** for this send run
5. **Add custom categories** if your Excel/Word files use new category titles, then re-upload the Word template
6. **Click "Send Email Reminders"** to send notifications
7. **Click "Close App"** when done

---

## Troubleshooting

### "App can't be opened" warning
**Solution**: Right-click the app → Select "Open" → Click "Open" again

### Emails not sending
1. Make sure **Microsoft Outlook is open**
2. Check that you **granted Automation permission** (see First Time Setup above)
3. Check your Excel file has valid email addresses

### Permission status indicator
- **Green**: Outlook access granted ✓
- **Yellow**: Outlook access needed (will prompt on first send)
- **Gray**: Checking permission status...

---

## Privacy & Security

**What the app accesses:**
- ✅ Your files (to read Excel/Word files you upload)
- ✅ Microsoft Outlook (to send emails via AppleScript)
- ✅ Application Support folder (to save your data)

**What the app does NOT do:**
- ❌ NO internet access
- ❌ NO telemetry or analytics
- ❌ NO data collection
- ❌ NO network communication

All data stays on your Mac. Nothing is sent to external servers.

---

## Excel File Format

The app supports two Excel formats:

### Old Format
- **Sheet name**: Overview or Worksheet
- **Columns**: Pseudonym, Documentacion, email, Fecha Caducidad

### New Format (Recommended)
- **Columns**: Nombre Trabajador, DNI, Puesto Trabajo, Documentacion, Fecha Alta, Fecha Caducidad, Email

---

## Word Template Format

If using custom Word templates:
- Each page must start with its matching title: FICHA, CONSENTIMIENTO, TELEFORMACION, APTO, EPIS/EPI, or RENUNCIA
- Expired certificates are skipped when their matching template page is missing
- Custom categories can be added in the app before uploading the Word template
- Use placeholders: `[NAME]` and `[DATE]`
- Upload .docx or .doc files

---

## Version

**Version**: 9.0.0
**Date**: 2026-03-25
**Requires**: macOS 10.15+, Microsoft Outlook

### What's New in 9.0.0
- ✅ **NEW**: CONSENTIMIENTO/RENUNCIA either-or logic
  - When both certificates are expired, only sends email for the one with the later expiration date
  - If both expired on same date, only sends CONSENTIMIENTO
  - If one is not expired, no email is sent for either
- ✅ Updated installer wrapper script to v9.0.0
- ✅ Bug fixes and performance improvements

### What's New in 7.0.0
- ✅ NEW: Installer wrapper script to bypass Gatekeeper warnings
- ✅ Automated quarantine removal for seamless installation
- ✅ Fixed email sending logic for categories with valid certificates
- ✅ Cleaned up legacy Next.js/web app source files
- ✅ Updated documentation with simplified installation guide

### What's New in 6.0.0
- ✅ Brand new app name: CertificateReminder (no space)
- ✅ New custom icon for the application
- ✅ Cleaner, more professional branding
- ✅ All functionality from v5.0.0 preserved

### What's New in 5.0.0
- ✅ Fixed email sending with proper AppleScript syntax for Microsoft Outlook on macOS
- ✅ HTML formatting from Word templates now renders correctly in emails
- ✅ Improved email content handling with proper HTML document structure
- ✅ All certificate types (FICHA, APTO, EPIS, CONSENTIMIENTO, FORMACION) now send properly formatted emails

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Make sure Outlook is running before sending emails
3. Verify your Excel file has the correct columns
4. Check that you've granted Automation permission in System Settings

For additional help, contact your system administrator.
