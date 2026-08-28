# Certificate Reminder

Certificate Reminder is a macOS desktop app for tracking certificate expirations and sending reminder emails through Microsoft Outlook.

The app runs locally on the user's Mac at `http://localhost:3030`. Users upload an Excel file with certificate data and a Word document with email templates. The app finds expired certificates, matches them to the correct Word template page, and sends formatted emails through Outlook using AppleScript.

## Current Release

- Current version: `9.0.0`
- Main branch: `main`
- Release branch pattern: `release/<version>`, for example `release/9.0.0`
- Public repo: `https://github.com/kevsaba/certificate-reminder`
- Primary install artifact for non-technical users: `CertificateReminder-<version>-macOS.pkg`
- Internet-distributed packages must be Developer ID signed and notarized, otherwise Gatekeeper can block them after download.

## Work In Progress — `feature/delete-categories`

A feature branch that adds a delete-category affordance to the "Enabled Categories" grid, so the list stops growing forever. Deleted categories persist across app restarts and Excel re-uploads. Entries whose category has been deleted are skipped when sending emails, with an amber warning line showing how many are being skipped. To restore a deleted category, the user re-adds it via the existing "New category" input.

**Spec:** `docs/superpowers/specs/2026-08-28-delete-categories-design.md`
**Plan:** `docs/superpowers/plans/2026-08-28-delete-categories.md`

### State of the branch

Done and committed on `feature/delete-categories`:

- Task 1 — `hiddenCategories?: string[]` on `AppData` and `skippedHidden?: number` on `CheckResult` (types).
- Task 2 — `src/lib/categories.ts` helper with `visibleCategories` and `countHiddenEntries` + 9 unit tests.
- Task 3 — `GET /api/categories` returns both `customCategories` and `hiddenCategories`; `POST /api/categories` un-hides on add.
- Task 4 — `DELETE /api/categories` handler.
- Task 5 — `/api/check` filters out entries in hidden categories and returns `skippedHidden` in the response.
- Task 6 — `src/lib/__tests__/scheduler-hidden-categories.test.ts` end-to-end integration test.
- Task 7 — Frontend loads `hiddenCategories`, filters `categoryOptions`, and filters Excel-uploaded categories against hidden.
- Task 8 — Frontend `deleteCategory` handler + `×` button on each category chip with `window.confirm`.
- Task 9 — Frontend amber warning banner above the category grid showing `N entries in hidden categories will be skipped`.

Pending on `feature/delete-categories`:

- **Task 10 — Manual end-to-end QA.** Requires Kevin (or Marta) to run the dev server and click through the flow. Steps are in the plan. Cannot be delegated to an agent.
- **Task 11 — Docs update in `README.md` and `USER_GUIDE.md`.** Add short paragraphs describing the delete affordance from a user perspective.
- **Task 12 — Full test sweep** (`bun run build`, `bun run test:missing-template`, `bun test src/lib/__tests__/*.test.ts`) and stale-version-reference check before merging.

### How to continue

To resume the work in a new session on this branch:

```bash
git switch feature/delete-categories
git pull --ff-only origin feature/delete-categories
bun install
bun run dev
```

Then execute Task 10 manually per the plan doc, complete Tasks 11 and 12, and merge into `main` following the release process below. If bundling into a release, bump `package.json` etc. to the new version first — likely `9.1.0`.

If you're continuing via an agent, point it at the plan file. Tasks 1–9 are marked complete via git commits with `feat(...)` and `test(...)` prefixes matching the plan step names. The subagent-driven-development workflow was used for the completed tasks; the pattern is documented in `docs/superpowers/plans/2026-08-28-delete-categories.md`.

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
- `productsign`, `xcrun notarytool`, and `xcrun stapler` for public macOS distribution.

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

5. For a non-technical user release, configure Apple signing and notarization.

The build script supports these environment variables:

```bash
export DEVELOPER_ID_APPLICATION="Developer ID Application: <Name> (<Team ID>)"
export DEVELOPER_ID_INSTALLER="Developer ID Installer: <Name> (<Team ID>)"
export NOTARYTOOL_PROFILE="<stored-notarytool-profile>"
```

The Mac running the release must have valid Apple Developer ID certificates in Keychain. Check with:

```bash
security find-identity -v
```

Create the notary profile once with:

```bash
xcrun notarytool store-credentials "<stored-notarytool-profile>"
```

Then rebuild:

```bash
./build-dmg.sh
```

Without those credentials, the build script still creates artifacts for local testing, but the `.pkg` may be blocked on another Mac with a Gatekeeper message like "Apple could not verify this is free of malware".

6. Create the Desktop handoff folder:

```text
/Users/kevin.sabatino/Desktop/Send-To-Colleague-v<version>
```

7. Copy release artifacts from `artifacts/` into that folder:

- `CertificateReminder-<version>-macOS.pkg`
- `CertificateReminder-<version>-macOS.dmg`
- `Install CertificateReminder.app`
- `Install-CertificateReminder.command`
- `INSTALLATION-INSTRUCTIONS.txt`
- `README-FOR-YOU.md`

8. For non-technical users, the primary file is:

```text
CertificateReminder-<version>-macOS.pkg
```

They should unzip the folder, double-click the `.pkg`, follow macOS Installer, and wait for the browser to open `http://localhost:3030`.

9. Test the package on the local Mac:

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

10. Confirm Gatekeeper status for the distributable PKG:

```bash
pkgutil --check-signature artifacts/CertificateReminder-<version>-macOS.pkg
spctl -a -vv -t install artifacts/CertificateReminder-<version>-macOS.pkg
```

For a release intended for non-technical users, `pkgutil` must show a Developer ID Installer signature and `spctl` must accept the package. If the package is unsigned, do not describe it as ready for frictionless sharing.

11. Commit, push, and merge:

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
- Expands Electrobun's first-run `*.tar.zst` wrapper into the real runnable app bundle.
- Ad-hoc signs unsigned local builds, or Developer ID signs when signing variables are configured.
- Creates `CertificateReminder-Distribution/`.
- Creates `artifacts/CertificateReminder-<version>-macOS.dmg`.
- Creates `artifacts/CertificateReminder-<version>-macOS.pkg`.
- Creates `artifacts/Install CertificateReminder.app`.
- Copies `artifacts/Install-CertificateReminder.command`.

The PKG is the recommended installer format because `.command` files can be interrupted by a user's shell startup behavior, such as an `oh-my-zsh` update prompt.

For local testing, the build script can create unsigned artifacts. For sharing with non-technical users, the PKG must be Developer ID signed and notarized. The PKG postinstall script clears quarantine on the installed app, performs ad-hoc local signing as a fallback, launches the app as the logged-in user, and opens `http://localhost:3030`.

Signing/notarization environment variables:

```bash
DEVELOPER_ID_APPLICATION
DEVELOPER_ID_INSTALLER
NOTARYTOOL_PROFILE
```

If these are not set, `./build-dmg.sh` prints a warning that the build is not fully ready for non-technical internet distribution.

Before sending a handoff folder, verify the DMG/PKG do not contain Electrobun's self-extracting payload:

```bash
find CertificateReminder-Distribution/CertificateReminder.app/Contents/Resources -maxdepth 1 -name "*.tar.zst" -print
rm -rf /tmp/cert-pkg-check
pkgutil --expand-full artifacts/CertificateReminder-<version>-macOS.pkg /tmp/cert-pkg-check
tar -tzf /tmp/cert-pkg-check/Scripts/CertificateReminder.app.tar.gz | grep "\\.tar\\.zst" || true
```

Both checks should print no `*.tar.zst` entries. If a release ships that wrapper, a managed Mac can fail on first launch with `Electrobun self-extractor... error: AccessDenied`.

## Common macOS Issues

If a DMG or app fails to open, the usual cause is macOS quarantine or Gatekeeper. The old v8 manual workaround was:

```bash
xattr -cr CertificateReminder-8.0.0-macOS.dmg
open CertificateReminder-8.0.0-macOS.dmg
```

For v9 and later, the normal user should not need Terminal after the PKG is signed and notarized. Prefer the `.pkg` installer.

If an unsigned PKG is blocked by macOS with only `Done` and `Move to Bin`, the reliable fallback is:

1. Click `Done`.
2. Open `System Settings`.
3. Go to `Privacy & Security`.
4. Scroll to `Security`.
5. Click `Open Anyway` for `CertificateReminder-<version>-macOS.pkg`.
6. Confirm the next prompt.

Apple documents that `Open Anyway` is available for about an hour after the blocked open attempt. Right-click `Open` can work on some macOS versions/policies, but it is not reliable for this package. Terminal quarantine removal is a last-resort workaround, not the desired non-technical release flow.

If `Privacy & Security` says the setting has been configured by a profile and no `Open Anyway` button appears, the Mac is managed by an organization. In that case the user may not be allowed to override Gatekeeper. The practical options are:

- Build and send a Developer ID signed and notarized PKG.
- Ask the organization's IT/admin team to approve or install the package.
- Use a Terminal quarantine-removal workaround only if the user has permission and admin rights.

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
