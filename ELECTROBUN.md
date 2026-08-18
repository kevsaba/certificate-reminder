# Certificate Reminder - Electrobun Native App

## Quick Start (For You - Developer)

### Option 1: Easiest - One Command
```bash
bun run quick
```
This builds Next.js, bundles with Electrobun, and launches the app automatically.

### Option 2: Manual Steps
```bash
bun run build              # Build Next.js static export
bun run electrobun:build   # Bundle with Electrobun
open build/dev-macos-arm64/Certificate\ Reminder-dev.app
```

---

## Distribution (For End Users)

### Create Distributable DMG
```bash
bun run dist
```

This creates:
- `artifacts/canary-macos-arm64-CertificateReminder-canary.dmg` (~17MB)

**Users just need to:**
1. Download the DMG
2. Double-click to open
3. Drag the app to Applications
4. Launch from Applications

**No building required!** The app is self-contained.

---

## What's the Difference?

| | Development Build | Distribution Build |
|---|---|---|
| **Command** | `bun run quick` | `bun run dist` |
| **Location** | `build/dev-macos-arm64/` | `artifacts/*.dmg` |
| **Use For** | Testing changes | Giving to users |
| **Requires Build?** | Yes, every time | No, already built |
| **Double-click to run?** | Yes | Yes |

---

## Important Notes

⚠️ **Development Mode**: Every time you change the frontend code, you need to run `bun run quick` again to rebuild.

✅ **Distribution Mode**: The DMG contains a fully-built app that users can just double-click - no building needed.

🔐 **Code Signing**: Currently not signed. macOS will show a warning. For distribution, you'll need to:
1. Get an Apple Developer certificate
2. Configure code signing in `electrobun.config.ts`
3. Notarize the app with Apple

---

## File Structure

```
CertificateReminder.app/
├── src/
│   ├── bun/
│   │   └── index.ts          # Bun backend (API server)
│   ├── main-ui/
│   │   ├── index.ts          # UI entry point
│   │   └── index.html        # HTML loader (iframe)
│   ├── lib/                   # Business logic
│   └── app/                   # Next.js frontend
├── build/                     # Development builds
├── artifacts/                 # Distribution builds (DMG)
├── electrobun.config.ts       # Electrobun configuration
├── next.config.ts             # Next.js configuration
└── dev.sh                     # Quick build & run script
```

---

## How It Works

1. **Bun Backend** (`src/bun/index.ts`):
   - Starts HTTP server on port 3030
   - Handles API routes: `/api/upload`, `/api/check`, `/api/shutdown`
   - Serves static Next.js files

2. **Electrobun Window**:
   - Creates native macOS window
   - Loads `src/main-ui/index.html`
   - HTML contains an iframe pointing to `http://localhost:3030`

3. **Data Storage**:
   - Stored in `~/Library/Application Support/CertificateReminder/data/`
   - Persists across app restarts
