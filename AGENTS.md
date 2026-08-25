# Agent Operating Notes

This repository contains the source for Certificate Reminder, a macOS desktop app for tracking certificate expirations and sending reminder emails through Microsoft Outlook.

These notes are the source of truth for AI agents working in this repo. Read this file before making changes.

## Current Collaboration Context

- The public GitHub repository is `https://github.com/kevsaba/certificate-reminder`.
- The baseline public release was recovered from the Desktop v8 deliverable/source investigation.
- The v8 product deliverable used for comparison was `/Users/kevin.sabatino/Desktop/Send-To-Colleague-v8.0.0`.
- The recovered v8 source was found under `/Users/kevin.sabatino/Desktop/Important Text Files/Other Projects/CertificatesApp/CertificateReminder.app`.
- Version `9.0.0` has been merged into `main`.
- The v9 release branch was `release/9.0.0`.
- The v9 handoff folder is `/Users/kevin.sabatino/Desktop/Send-To-Colleague-v9.0.0`.
- The recommended v9 installer is `CertificateReminder-9.0.0-macOS.pkg`.
- The last validated v9 packaging commit was `6bc52c2`.
- A later real-world test showed the unsigned v9 PKG can be blocked after being sent in a zip: "Apple could not verify ... is free of malware". This is expected Gatekeeper behavior for unsigned/not-notarized internet-distributed packages.
- This Mac currently has no valid Apple signing identities according to `security find-identity -v`; a frictionless external release requires Apple Developer ID signing and notarization.

## Product Goal

The repo must allow a colleague with access to GitHub to reproduce an installable macOS app package like the Desktop `Send-To-Colleague-v8.0.0` folder.

The expected colleague-facing deliverable shape is:

- `CertificateReminder-<version>-macOS.pkg`
- `CertificateReminder-<version>-macOS.dmg`
- `Install CertificateReminder.app`
- `Install-CertificateReminder.command`
- `INSTALLATION-INSTRUCTIONS.txt`
- `README-FOR-YOU.md`

The app should be installable on macOS and run locally, currently using `localhost:3030` for the local UI/server flow.

## Tech Stack

- Next.js static export for the UI.
- React and TypeScript.
- Bun as runtime/package manager.
- Electrobun for macOS app bundling.
- Microsoft Outlook integration through AppleScript.
- Local app data stored under macOS Application Support.
- Apple `productsign`, `notarytool`, and `stapler` are needed for a frictionless non-technical external macOS release.

## Build And Validation

Use Bun, not npm, unless there is a specific reason to do otherwise.

Primary validation commands:

```bash
bun run build
bun run test:missing-template
bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts
./build-dmg.sh
```

For local manual app testing, use `bun run dev`. This builds the static UI and starts the Bun app server on `localhost:3030`, which is the server that owns `/api/upload`, `/api/check`, and Outlook integration. `bun run dev:ui` starts only the Next.js UI server and is not enough for upload/email testing.

`./build-dmg.sh` is the main release packaging script. It should do the hard work of producing:

- `artifacts/CertificateReminder-<version>-macOS.pkg`
- `artifacts/CertificateReminder-<version>-macOS.dmg`
- `artifacts/Install CertificateReminder.app`
- `artifacts/Install-CertificateReminder.command`
- `CertificateReminder-Distribution/`

Generated build outputs should stay out of Git. `.gitignore` should continue to exclude build artifacts, DMGs, app bundles, app data, examples, and private document/spreadsheet fixtures.

For local testing, unsigned artifacts are acceptable. For sending to a non-technical colleague, unsigned artifacts are not enough because Gatekeeper can block them before any installer script runs.

If generated build artifacts become root-owned after package testing, remove only generated outputs with administrator privileges:

```bash
rm -rf build artifacts CertificateReminder-Distribution
```

Never remove source files, user data, or Desktop handoff folders while cleaning generated artifacts.

## Release Versioning

For a release branch, keep version references aligned across:

- `package.json`
- `electrobun.config.ts`
- `build-dmg.sh`
- `Install-CertificateReminder.command`
- `README.md`
- `USER_GUIDE.md`
- `DISTRIBUTION_README.md`
- colleague-facing Desktop docs copied into `Send-To-Colleague-v<version>`

Before finalizing a release package, search for stale previous-version references in the release files.

Use this style of search, replacing the version numbers:

```bash
rg "8\.0\.0|Send-To-Colleague-v8|CertificateReminder-8"
```

Also check current-version references:

```bash
rg "9\.0\.0|Send-To-Colleague-v9|CertificateReminder-9"
```

Do not update generated artifacts by hand. Update scripts/source docs, run `./build-dmg.sh`, then copy fresh artifacts.

## Git Workflow

- Keep `main` as the public baseline.
- Use release branches such as `release/9.0.0` for deliverable work.
- Commit intentional source/docs/script changes only.
- Do not commit generated folders or private data.
- Preserve user changes. Do not revert files unless the user explicitly asks.
- When pushing release work, push the branch to `origin` and report the branch URL and commit hash.
- After a release is validated, merge the release branch into `main`, run validation on `main`, and push `main`.

## Localhost And Installed App Checks

When validating a running installed app, inspect the process bound to the port first. The v8 investigation found `localhost:3030` was served by the installed macOS app process from:

```text
/Applications/CertificateReminder.app/Contents/MacOS/bun
```

Do not assume the repo dev server is serving `localhost:3030`; confirm with process inspection.

Useful checks:

```bash
lsof -nP -iTCP:3030 -sTCP:LISTEN
plutil -p /Applications/CertificateReminder.app/Contents/Info.plist
curl -i http://localhost:3030/api/categories
```

If `curl` appears to fail inside a restricted tool environment, rerun it outside the sandbox if approval is available. During v9 testing, sandboxed network checks sometimes produced false negatives.

## Packaging Notes

The Desktop handoff folder should mirror the v8 folder format. For v9, use:

```text
/Users/kevin.sabatino/Desktop/Send-To-Colleague-v9.0.0
```

The DMG and installer should come from the current branch build artifacts. The human-facing instruction files can be based on the v8 handoff docs, but must be updated to the current version and filenames.

For v9.0.0, prefer the standard macOS PKG installer for non-technical users:

```text
CertificateReminder-9.0.0-macOS.pkg
```

The previous DMG plus `.command` flow is retained as a fallback, but `.command` files can be blocked by user shell startup prompts such as oh-my-zsh update prompts. Do not make non-technical users run Terminal commands for the normal install path.

If the build script skips `examples/`, that is expected when private examples are intentionally absent from the public repo.

### Signing And Notarization

To produce a package that a non-technical colleague can double-click after receiving it through a zip/download, the release Mac needs:

- A valid Apple Developer ID Application certificate.
- A valid Apple Developer ID Installer certificate.
- A configured `notarytool` keychain profile.

Check available identities:

```bash
security find-identity -v
```

Expected identities look like:

```text
Developer ID Application: <Name> (<Team ID>)
Developer ID Installer: <Name> (<Team ID>)
```

The build script supports:

```bash
export DEVELOPER_ID_APPLICATION="Developer ID Application: <Name> (<Team ID>)"
export DEVELOPER_ID_INSTALLER="Developer ID Installer: <Name> (<Team ID>)"
export NOTARYTOOL_PROFILE="<stored-notarytool-profile>"
./build-dmg.sh
```

Store a notary profile once with:

```bash
xcrun notarytool store-credentials "<stored-notarytool-profile>"
```

After building a real external release, verify:

```bash
pkgutil --check-signature artifacts/CertificateReminder-<version>-macOS.pkg
spctl -a -vv -t install artifacts/CertificateReminder-<version>-macOS.pkg
```

For non-technical release readiness, `pkgutil` must show a Developer ID Installer signature and `spctl` must accept the package. If either check fails, do not tell Kevin the artifact is ready for frictionless sharing.

### Release Checklist For A Future Agent

Use this checklist for every new version.

1. Read `AGENTS.md`, `README.md`, `build-dmg.sh`, `pkg-postinstall.sh`, and `electrobun.config.ts`.
2. Confirm the current branch and working tree:

```bash
git status -sb
git branch --show-current
```

3. Create a release branch if needed:

```bash
git switch -c release/<version>
```

4. Update version references in source/docs/scripts.
5. Run stale-version searches with `rg`.
6. Run tests and build:

```bash
bun run build
bun run test:missing-template
bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts
./build-dmg.sh
```

7. If the target user is non-technical, configure signing and notarization before the final `./build-dmg.sh`.
8. Create or refresh the Desktop handoff folder:

```text
/Users/kevin.sabatino/Desktop/Send-To-Colleague-v<version>
```

9. Copy fresh artifacts from `artifacts/`:

```text
CertificateReminder-<version>-macOS.pkg
CertificateReminder-<version>-macOS.dmg
Install CertificateReminder.app
Install-CertificateReminder.command
```

10. Add/update these human-facing files in the Desktop handoff folder:

```text
INSTALLATION-INSTRUCTIONS.txt
README-FOR-YOU.md
```

11. Test the PKG from a clean state:

```bash
lsof -nP -iTCP:3030 -sTCP:LISTEN
test -e /Applications/CertificateReminder.app && echo exists || echo missing
```

Remove the test install only when needed:

```bash
rm -rf /Applications/CertificateReminder.app
```

If macOS denies deletion, use an administrator-approved delete. Do not delete the Desktop handoff folder.

12. Install the PKG and verify:

```bash
plutil -p /Applications/CertificateReminder.app/Contents/Info.plist
lsof -nP -iTCP:3030 -sTCP:LISTEN
curl -i http://localhost:3030/api/categories
```

The app version must match the release version, and `/api/categories` must return HTTP 200.

13. For external/non-technical sharing, verify Gatekeeper status:

```bash
pkgutil --check-signature artifacts/CertificateReminder-<version>-macOS.pkg
spctl -a -vv -t install artifacts/CertificateReminder-<version>-macOS.pkg
```

14. Clean the local test install if Kevin wants a fresh manual test.
15. Commit intentional source/docs/script changes only.
16. Push the release branch.
17. Merge into `main`, validate again, and push `main`.

### Non-Technical User Install Instruction

Tell users:

1. Unzip `Send-To-Colleague-v<version>.zip`.
2. Open the folder.
3. Double-click `CertificateReminder-<version>-macOS.pkg`.
4. Follow the macOS Installer screens.
5. Wait for the browser to open `http://localhost:3030`.

If macOS blocks the package, the package is probably unsigned or not notarized. If the dialog only offers `Done` and `Move to Bin`, tell the user to click `Done`, then go to System Settings > Privacy & Security > Security and click `Open Anyway` for the package. Apple says this override is available for about an hour after the blocked open attempt. Right-click `Open` can work on some macOS versions/policies, but it is not reliable for unsigned PKGs. This fallback is not the target flow for non-technical distribution.

Do not tell non-technical users to run Terminal commands unless all graphical install options have failed.

### Known Packaging Pitfalls From v9

- Double-clicking `CertificateReminder.app` directly inside the mounted DMG can fail with `Electrobun self-extractor... error: AccessDenied`.
- The app must run from a writable installed location such as `/Applications`.
- `.command` installer files can be interrupted before execution by shell startup prompts like `oh-my-zsh`.
- A PKG made with `pkgbuild --component` can report success without placing the app where expected because of PackageKit bundle behavior.
- The current PKG avoids that by using `pkgbuild --nopayload` and a `postinstall` script that extracts an embedded `CertificateReminder.app.tar.gz` into `/Applications`.
- The PKG postinstall clears quarantine, applies ad-hoc signing, launches as the logged-in console user, and opens `http://localhost:3030`.
- Unsigned/not-notarized DMG and PKG artifacts can be blocked after being downloaded or extracted from a zip.
- v8 relied on a manual quarantine workaround: `xattr -cr CertificateReminder-8.0.0-macOS.dmg && open CertificateReminder-8.0.0-macOS.dmg`.

## Security And Privacy

- This is a public GitHub repo.
- Do not commit personal spreadsheets, Word templates, certificate data, app data, secrets, or local-only examples.
- Keep `.env*`, `data/`, `examples/`, Office documents, spreadsheets, DMGs, app bundles, and build outputs ignored unless the user explicitly decides otherwise.

## Communication With Kevin

- Work step by step and report concrete findings.
- When validating assumptions, give exact paths, branch names, commit hashes, and artifact names.
- Prefer doing the repo/build work directly when the next step is clear.
- Ask only when a choice cannot be safely inferred from the repo or prior discussion.
