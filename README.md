# Certificate Reminder

A macOS desktop application that monitors certificate expirations and sends automated email reminders via Microsoft Outlook.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Email Sending via Outlook](#email-sending-via-outlook)
- [Development](#development)
- [Building a DMG](#building-a-dmg)
- [Project Structure](#project-structure)
- [Configuration](#configuration)

---

## Overview

Certificate Reminder is a native macOS application that helps organizations track certificate expirations and send automated reminders to employees. The application is completely offline - all data stays on the user's machine.

### Key Features

- ✅ **Excel Parsing** - Upload Excel files with certificate data
- ✅ **Word Template Support** - Use custom Word templates for formatted emails
- ✅ **Automated Email Reminders** - Send reminders via Microsoft Outlook
- ✅ **Expiration Tracking** - Track days until expiration
- ✅ **Permission Management** - Clear UX for macOS automation permissions
- ✅ **Offline Operation** - No internet connection required
- ✅ **Rich HTML Emails** - Beautiful formatted emails with bold, colors, and lists

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.6 | React framework with static export |
| **React** | 19.2.3 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 4.x | Styling |
| **React Dropzone** | 15.0.0 | File upload UI |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Bun** | 1.3.10 | JavaScript runtime and server |
| **Electrobun** | 1.16.0 | macOS app bundling framework |

### Libraries

| Library | Purpose |
|---------|---------|
| **Mammoth** | 1.11.0 | Convert Word documents to HTML |
| **XLSX** | 0.18.5 | Parse Excel files |
| **UUID** | 13.0.0 | Generate unique IDs |

### Native Integration

- **AppleScript** - Control Microsoft Outlook for email sending
- **macOS Privacy APIs** - Automation permissions management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Certificate Reminder                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Browser    │◄────────┤  Bun Server  │                 │
│  │  (Next.js)   │  HTTP   │  (Backend)   │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                    │                         │
│                    ┌───────────────┼───────────────┐        │
│                    │               │               │        │
│            ┌───────▼──────┐ ┌──────▼──────┐ ┌────▼─────┐  │
│            │   Excel      │ │    Word     │ │  Outlook │  │
│            │   Parsing    │ │  Templates  │ │  Emails  │  │
│            └──────────────┘ └─────────────┘ └──────────┘  │
│                                                              │
│  Data Storage: ~/Library/Application Support/               │
│                CertificateReminder/data/app-data.json       │
└─────────────────────────────────────────────────────────────┘
```

### Component Flow

1. **User uploads Excel/Word files** → Browser sends to Bun server
2. **Server processes files** → Parses data with Mammoth/XLSX
3. **Server saves to disk** → Stores in Application Support
4. **User clicks "Send Reminders"** → Server checks expirations
5. **Server sends emails** → Uses AppleScript to control Outlook

---

## How It Works

### 1. Certificate Checking Process

```
┌─────────────────────────────────────────────────────────────┐
│                    checkExpirations()                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Load certificates from app-data.json                    │
│                                                              │
│  2. Check ALL entries for expiration                        │
│     └─> getExpirationStatus(entry)                          │
│         └─> calculateDaysUntil(expirationDate)              │
│                                                              │
│  3. Separate expired vs valid entries                       │
│                                                              │
│  4. Group expired by person+category (prevent duplicates)   │
│     └─> Key: "{DNI}_{BASE_CATEGORY}"                       │
│                                                              │
│  5. For each group, select LATEST expiration date           │
│     └─> Send ONE notification per person+category           │
│                                                              │
│  6. Build reminder payloads                                 │
│     ├─> Match Word template by category                     │
│     ├─> Fill template with [NAME] and [DATE]               │
│     └─> Generate HTML email body                           │
│                                                              │
│  7. Send emails via sendEmailNotifications()               │
│     └─> Sequential processing (500ms delay between emails) │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Excel Parsing

The app supports two Excel formats:

**Old Format:**
| Pseudonym | Documentacion | email | Fecha Caducidad |
|-----------|---------------|-------|-----------------|

**New Format:**
| Nombre Trabajador | DNI | Puesto Trabajo | Documentacion | Fecha Alta | Fecha Caducidad | Email |

**Column Mapping:**
- Spanish columns are mapped to English properties
- Date formats: `DD/MM/YYYY`, `DD-MM-YYYY`
- Email validation: Must contain `@`

### 3. Word Template Processing

```
Word Document (.docx)
        │
        ▼
Mammoth.convertToHtml()
        │
        ▼
HTML Fragment
        │
        ▼
Extract Sections by Type
(FICHA, CONSENTIMIENTO, APTO, EPIS, etc.)
        │
        ▼
Template Array
```

**Template Placeholders:**
- `[NAME]` - Employee name (extracted from email)
- `[DATE]` - Expiration date
- `[CURRENT YEAR]` - Current year

---

## Email Sending via Outlook

### The Challenge

Sending emails via AppleScript on macOS requires:
1. Correct syntax for Microsoft Outlook
2. Proper HTML handling
3. Character escaping
4. Permission management

### The Solution

#### AppleScript Syntax

**Incorrect (causes failure):**
```applescript
tell application "Microsoft Outlook"
  set newMsg to create message
  set subject of newMsg to "..."
  set content of newMsg to "..."
  set newRecipient to make recipient at end of recipients
  set address of newRecipient to "..."
  set recipient of newMsg to newRecipient
  send newMsg
end tell
```

**Correct (working):**
```applescript
tell application "Microsoft Outlook"
  set newMsg to make new outgoing message with properties {subject:"...", content:"..."}
  make new recipient at end of to recipients of newMsg with properties {email address:{address:"..."}}
  send newMsg
end tell
```

#### HTML Handling

**Problem:** Word templates generate HTML fragments without `<html>` and `<body>` tags.

**Solution:** Wrap HTML in proper document structure

```typescript
// src/lib/email.ts:34-38
const wrappedBody = body.startsWith('<html>')
  ? body
  : `<html><body>${body}</body></html>`;
```

This ensures Outlook recognizes the content as HTML and renders it properly.

#### Character Escaping

Before passing to AppleScript, HTML must be escaped:

```typescript
const escapedBody = wrappedBody
  .replace(/\\/g, '\\\\')  // Backslashes
  .replace(/"/g, '\\"')    // Quotes
  .replace(/\$/g, '\\$')   // Dollar signs
  .replace(/`/g, '\\`')    // Backticks
  .replace(/\n/g, '\\n')   // Newlines
  .replace(/\r/g, '\\r');  // Carriage returns
```

#### Permission Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Permission Request Flow                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. App starts                                              │
│     └─> Check Outlook permission via checkOutlookPermission()│
│                                                              │
│  2. User clicks "Send Email Reminders"                      │
│     └─> If no permission → Show permission modal            │
│                                                              │
│  3. User grants permission                                  │
│     ├─> macOS shows: "Certificate Reminder wants to         │
│     │   control Microsoft Outlook"                          │
│     └─> User clicks "Open System Settings"                  │
│                                                              │
│  4. Enable automation                                       │
│     ├─> System Settings > Privacy & Security > Automation   │
│     └─> Check "Microsoft Outlook" checkbox                  │
│                                                              │
│  5. Permission granted!                                     │
│     └─> Emails can be sent                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Development

### Prerequisites

- macOS 10.15+ (Catalina or later)
- Node.js/Bun installed
- Microsoft Outlook (for testing email sending)

### Setup

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run Electrobun in development mode
bun run electrobun:dev
```

### Project Scripts

```bash
# Build Next.js UI
bun run build

# Build Electrobun app (development)
bun run electrobun:build

# Build Electrobun app (canary/production)
bun run electrobun:canary

# Quick build and launch
./dev.sh

# Build production DMG
./build-dmg.sh
```

### Running Locally

**Option 1: Development Mode**
```bash
# Terminal 1: Run Next.js dev server
bun run dev

# Terminal 2: Run backend
bun run electrobun:dev
```

**Option 2: Quick Launch**
```bash
./dev.sh  # Builds and launches the app
```

---

## Building a DMG

### Overview

The DMG build process creates a distributable macOS disk image containing:
- The native app bundle
- Documentation (README, User Guide)
- Optional example files if an `examples/` folder exists locally
- Launcher scripts

### Build Script

The build process is automated in `build-dmg.sh`:

```bash
#!/bin/bash

# Step 1: Build UI
npm run build

# Step 2: Build app bundle with Electrobun
bun install && electrobun build --env=canary

# Step 3: Remove quarantine attributes
xattr -cr "$APP_BUNDLE"

# Step 4: Copy to distribution folder
cp -R "$APP_BUNDLE" "CertificateReminder-Distribution/"

# Step 5: Add documentation and examples
cp DISTRIBUTION_README.md "CertificateReminder-Distribution/README.md"
cp USER_GUIDE.md "CertificateReminder-Distribution/"
cp -r examples "CertificateReminder-Distribution/"  # optional, if present
cp launch-app.command "CertificateReminder-Distribution/"
cp quit-app.sh "CertificateReminder-Distribution/"

# Step 6: Create DMG
hdiutil create -volname "Certificate Reminder" \
    -srcfolder "CertificateReminder-Distribution" \
    -ov -format UDZO \
    "artifacts/Certificate Reminder-${VERSION}-macOS.dmg"

# Step 7: Remove quarantine from DMG
xattr -cr "artifacts/Certificate Reminder-${VERSION}-macOS.dmg"
```

### To Build a DMG

```bash
# From the app directory
./build-dmg.sh
```

### DMG Contents

```
Certificate Reminder (DMG Volume)
├── CertificateReminder.app              # Main application
├── README.md                            # Quick start guide
├── USER_GUIDE.md                        # Detailed user guide
├── launch-app.command                   # Launcher script
└── quit-app.sh                          # Quit script
```

### Distribution

1. **Copy the DMG** from `artifacts/` to your Desktop
2. **Rename** for distribution (e.g., `Certificate-Reminder-5.0.0-WORKING.dmg`)
3. **Send to users** via email, file sharing, etc.
4. **Users install** by dragging app to Applications folder

---

## Project Structure

```
CertificateReminder.app/
├── src/
│   ├── app/                    # Next.js frontend
│   │   ├── page.tsx           # Main UI page
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   │
│   ├── components/            # React components
│   │   └── DataTable.tsx      # Certificate data table
│   │
│   ├── bun/                   # Bun backend server
│   │   └── index.ts           # API routes and server
│   │
│   ├── lib/                   # Business logic
│   │   ├── email.ts           # Email sending via AppleScript
│   │   ├── excel.ts           # Excel parsing
│   │   ├── word.ts            # Word template processing
│   │   ├── expiration.ts      # Expiration calculation
│   │   ├── scheduler.ts       # Certificate checking logic
│   │   └── permissions.ts     # macOS permission checks
│   │
│   ├── types/                 # TypeScript types
│   │   └── index.ts           # Shared interfaces
│   │
│   └── main-ui/               # Additional UI components
│
├── public/                    # Static assets
│
├── build-dmg.sh              # DMG build script
├── dev.sh                    # Development build script
├── launch-app.command        # Launcher script
├── quit-app.sh              # Quit script
├── DISTRIBUTION_README.md   # User-facing README
├── USER_GUIDE.md           # Detailed user guide
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── next.config.ts          # Next.js config
├── electrobun.config.ts    # Electrobun config
└── README.md              # This file
```

---

## Configuration

### Environment Variables

No environment variables required. The app is fully self-contained.

### Data Storage

```
~/Library/Application Support/CertificateReminder/
└── data/
    └── app-data.json    # User's uploaded data
```

### Port Configuration

The app runs on port **3000** by default. To change:

```typescript
// src/bun/index.ts:45
const PORT = 3000;
```

### Certificate Categories

Supported categories (defined in `src/lib/word.ts`):

```typescript
const knownTypes = [
  'FICHA',           # Employee file
  'CONSENTIMIENTO',  # Consent form
  'TELEFORMACION',   # Online training
  'APTO',            # Medical fitness
  'EPIS',            # PPE (Personal Protective Equipment)
  'EPI',             # Alternative PPE name
  'RENUNCIA',        # Waiver
  'FORMACION'        # Training (maps to TELEFORMACION)
];
```

Each Word template page must start with its matching title. If an expired certificate has no matching template page, the app skips that email instead of sending a fallback message.

---

## Troubleshooting

### Build Issues

**Problem:** `bun: command not found`
```bash
# Solution: Add bun to PATH
export PATH="$HOME/.bun/bin:$PATH"
```

**Problem:** Electrobun build fails
```bash
# Solution: Clean and rebuild
rm -rf build/ node_modules/
bun install
bun run electrobun:build
```

### Email Issues

**Problem:** Emails not sending
- Check Outlook is running
- Verify Automation permission in System Settings
- Check console for AppleScript errors

**Problem:** HTML showing as raw tags
- Ensure HTML is wrapped in `<html><body>` tags
- Check escaping in `src/lib/email.ts`

### Permission Issues

**Problem:** App can't be opened
```bash
# Solution: Remove quarantine attribute
xattr -cr "CertificateReminder.app"
```

---

## Version History

### Version 5.0.0 (2026-03-18)

**Fixed:**
- ✅ Corrected AppleScript syntax for Microsoft Outlook on macOS
- ✅ Restored HTML formatting in email templates
- ✅ Fixed all certificate types (FICHA, APTO, EPIS, CONSENTIMIENTO, FORMACION)

**Changed:**
- Updated Word template HTML handling to wrap in proper document structure
- Improved character escaping for AppleScript

### Version 4.0.2 (2026-03-15)

**Added:**
- Browser auto-open on startup
- Launcher script for easy startup

### Version 2.0.0 (2025-03-17)

**Initial release with:**
- Excel parsing
- Word template support
- Outlook email sending
- Permission management UI

---

## License

Internal company tool - MaibornWolff GmbH

---

## Support

For technical support:
1. Check the troubleshooting section above
2. Review the USER_GUIDE.md
3. Contact your system administrator
