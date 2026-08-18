# Certificate Reminder

Certificate Reminder is a macOS desktop app for tracking certificate expirations and sending reminder emails through Microsoft Outlook.

The app runs locally on the user's Mac at `http://localhost:3030`. Users upload an Excel file with certificate data and a Word document with email templates. The app finds expired certificates, matches them to the correct Word template page, and sends formatted emails through Outlook using AppleScript.

## Current Release

- Current version: `9.0.0`
- Main branch: `main`
- Release branch pattern: `release/<version>`, for example `release/9.0.0`
- Public repo: `https://github.com/kevsaba/certificate-reminder`
- Primary install artifact for non-technical users: `CertificateReminder-<version>-macOS.pkg`

## What The App Does

- Parses Excel files containing employee certificate rows.
- Parses Word `.docx` templates where each page starts with a category title.
- Detects expired certificates.
- Sends one reminder per employee/category group.
- Sends emails through the installed Microsoft Outlook desktop app.
- Lets the user enable or disable categories before each send run.
- Lets the user add custom categories from the UI.
- Stores local app data under `~/Library/Application Support/CertificateReminder/data/app-data.json`.

The app does not use a backend service or remote database. Uploaded certificate data stays on the Mac where the app is running.

## Important v9 Behavior

Missing Word template pages are skipped. The app must not send fallback/plain-text reminder emails when an expired certificate has no matching template page.

Examples:

- If Excel has expired `FORMACION` rows but the Word file has no `TELEFORMACION` page, no email is sent for those rows.
- If Excel has expired `FICHA` rows but the Word file has no `FICHA` page, no email is sent for those rows.
- This applies to every category, including custom categories.

Category aliases:

- `FORMACION` maps to `TELEFORMACION`.
- `TELEFORMACIÓN` maps to `TELEFORMACION`.
- `EPI` maps to `EPIS`.

Custom category flow:

1. Upload Excel.
2. Add the custom category in the UI, for example `REMOTO`.
3. Upload or re-upload the Word template so the matching page is parsed.
4. Enable the desired categories.
5. Send reminders.

## Input Files

### Excel

Supported columns include:

- Old format: `Pseudonym`, `Documentacion`, `email`, `Fecha Caducidad`
- New format: `Nombre Trabajador`, `DNI`, `Puesto Trabajo`, `Documentacion`, `Fecha Alta`, `Fecha Caducidad`, `Email`

### Word Templates

Each email template page must start with the matching category title, for example:

- `FICHA`
- `CONSENTIMIENTO`
- `TELEFORMACION`
- `APTO`
- `EPIS`
- `RENUNCIA`
- A custom category added in the UI, for example `REMOTO`

Supported placeholders:

- `[NAME]`
- `[DATE]`
- `[CURRENT YEAR]`

## Tech Stack

- Next.js static export for the UI.
- React and TypeScript.
- Bun for runtime, dependency management, local API server, and tests.
- Electrobun for macOS app bundling.
- Mammoth for Word-to-HTML parsing.
- XLSX for Excel parsing.
- AppleScript for Microsoft Outlook email sending and macOS permission checks.
- `pkgbuild`, `hdiutil`, `xattr`, and `codesign` for macOS release packaging.

Use Bun, not npm, for normal development and release work.

## Local Development

Install dependencies:

```bash
bun install
```

Run the full local app server:

```bash
bun run dev
```

`bun run dev` builds the static UI and starts the Bun server on `http://localhost:3030`. This is the local flow that owns `/api/upload`, `/api/check`, `/api/categories`, `/api/permissions`, and Outlook email sending.

Do not use `bun run dev:ui` for upload/email testing. It starts only the Next UI server.

## Validation

Run these before pushing functional or release changes:

```bash
bun run build
bun run test:missing-template
bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts
```

For a release package, also run:

```bash
./build-dmg.sh
```

The build script currently creates both DMG and PKG artifacts.

## Release Process

For a new version, for example `9.1.0` or `10.0.0`:

1. Create or switch to a release branch:

```bash
git switch -c release/<version>
```

2. Update version references in:

- `package.json`
- `electrobun.config.ts`
- `build-dmg.sh`
- `Install-CertificateReminder.command`
- `pkg-postinstall.sh` if the version appears there
- `README.md`
- `USER_GUIDE.md`
- `DISTRIBUTION_README.md`
- Desktop handoff docs copied into `Send-To-Colleague-v<version>`

3. Search for stale previous-version references:

```bash
rg "<old-version>|Send-To-Colleague-v<old-version>|CertificateReminder-<old-version>"
```

4. Run validation:

```bash
bun run build
bun run test:missing-template
bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts
./build-dmg.sh
```

5. Create the Desktop handoff folder:

```text
/Users/kevin.sabatino/Desktop/Send-To-Colleague-v<version>
```

6. Copy release artifacts from `artifacts/` into that folder:

- `CertificateReminder-<version>-macOS.pkg`
- `CertificateReminder-<version>-macOS.dmg`
- `Install CertificateReminder.app`
- `Install-CertificateReminder.command`
- `INSTALLATION-INSTRUCTIONS.txt`
- `README-FOR-YOU.md`

7. For non-technical users, the primary file is:

```text
CertificateReminder-<version>-macOS.pkg
```

They should unzip the folder, double-click the `.pkg`, follow macOS Installer, and wait for the browser to open `http://localhost:3030`.

8. Test the package on the local Mac:

- Remove any existing `/Applications/CertificateReminder.app`.
- Confirm nothing is listening on `3030`.
- Install the PKG.
- Confirm `/Applications/CertificateReminder.app` exists.
- Confirm `CFBundleVersion` matches the release version.
- Confirm `http://localhost:3030/api/categories` responds.

Useful checks:

```bash
lsof -nP -iTCP:3030 -sTCP:LISTEN
plutil -p /Applications/CertificateReminder.app/Contents/Info.plist
curl -i http://localhost:3030/api/categories
```

9. Commit, push, and merge:

```bash
git add <changed-files>
git commit -m "..."
git push origin release/<version>
git switch main
git merge origin/release/<version>
git push origin main
```

## Packaging Notes

`./build-dmg.sh` is the source of truth for release artifact creation. It performs the hard work:

- Builds the Next.js static UI.
- Builds the Electrobun macOS app.
- Creates `CertificateReminder-Distribution/`.
- Creates `artifacts/CertificateReminder-<version>-macOS.dmg`.
- Creates `artifacts/CertificateReminder-<version>-macOS.pkg`.
- Creates `artifacts/Install CertificateReminder.app`.
- Copies `artifacts/Install-CertificateReminder.command`.

The PKG is the recommended installer because `.command` files can be interrupted by a user's shell startup behavior, such as an `oh-my-zsh` update prompt.

The generated DMG and PKG are not notarized. The PKG postinstall script clears quarantine on the installed app, performs ad-hoc local signing, launches the app as the logged-in user, and opens `http://localhost:3030`.

## Common macOS Issues

If a DMG or app fails to open, the usual cause is macOS quarantine or Gatekeeper. The old v8 manual workaround was:

```bash
xattr -cr CertificateReminder-8.0.0-macOS.dmg
open CertificateReminder-8.0.0-macOS.dmg
```

For v9 and later, the normal user should not need Terminal. Prefer the `.pkg` installer. If the PKG is blocked by macOS, the user can right-click the PKG, choose `Open`, then click `Open`.

If the app installs but `localhost:3030` does not open:

- Check whether an old app is already running on port `3030`.
- Quit the old app or kill the stale process.
- Open `/Applications/CertificateReminder.app`.
- Then visit `http://localhost:3030`.

## Project Structure

```text
src/app/                         Next.js UI
src/bun/index.ts                 Bun local server and API routes
src/lib/excel.ts                 Excel parsing
src/lib/word.ts                  Word template parsing and category normalization
src/lib/scheduler.ts             Expiration grouping and send decisions
src/lib/email.ts                 Outlook AppleScript email sending
src/lib/permissions.ts           macOS Outlook permission checks
src/types/index.ts               Shared TypeScript types
build-dmg.sh                     Release artifact builder
Install-CertificateReminder.command
installer-app-launcher.sh        Fallback installer app launcher
pkg-postinstall.sh               PKG postinstall install/launch script
AGENTS.md                        Agent operating notes and release checklist
CLAUDE.md                        Claude entrypoint pointing to AGENTS.md
```

## Privacy

This is a public GitHub repository. Do not commit personal spreadsheets, Word templates, certificate data, app data, secrets, `.env*` files, generated DMGs, PKGs, app bundles, build folders, or private examples.

## Support

For future agents: read `AGENTS.md` first. It contains the working context, release conventions, and packaging pitfalls discovered during v9.
