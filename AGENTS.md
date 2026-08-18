# Agent Operating Notes

This repository contains the source for Certificate Reminder, a macOS desktop app for tracking certificate expirations and sending reminder emails through Microsoft Outlook.

These notes are the source of truth for AI agents working in this repo. Read this file before making changes.

## Current Collaboration Context

- The public GitHub repository is `https://github.com/kevsaba/certificate-reminder`.
- The baseline public release was recovered from the Desktop v8 deliverable/source investigation.
- The v8 product deliverable used for comparison was `/Users/kevin.sabatino/Desktop/Send-To-Colleague-v8.0.0`.
- The recovered v8 source was found under `/Users/kevin.sabatino/Desktop/Important Text Files/Other Projects/CertificatesApp/CertificateReminder.app`.
- Work for the next deliverable is happening on branch `release/9.0.0`.
- The intended v9 handoff folder is `/Users/kevin.sabatino/Desktop/Send-To-Colleague-v9.0.0`.

## Product Goal

The repo must allow a colleague with access to GitHub to reproduce an installable macOS app package like the Desktop `Send-To-Colleague-v8.0.0` folder.

The expected colleague-facing deliverable shape is:

- `CertificateReminder-<version>-macOS.dmg`
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

## Build And Validation

Use Bun, not npm, unless there is a specific reason to do otherwise.

Primary validation commands:

```bash
bun run build
bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts
./build-dmg.sh
```

`./build-dmg.sh` is the main release packaging script. It should do the hard work of producing:

- `artifacts/CertificateReminder-<version>-macOS.dmg`
- `artifacts/Install-CertificateReminder.command`
- `CertificateReminder-Distribution/`

Generated build outputs should stay out of Git. `.gitignore` should continue to exclude build artifacts, DMGs, app bundles, app data, examples, and private document/spreadsheet fixtures.

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

## Git Workflow

- Keep `main` as the public baseline.
- Use release branches such as `release/9.0.0` for deliverable work.
- Commit intentional source/docs/script changes only.
- Do not commit generated folders or private data.
- Preserve user changes. Do not revert files unless the user explicitly asks.
- When pushing release work, push the branch to `origin` and report the branch URL and commit hash.

## Localhost And Installed App Checks

When validating a running installed app, inspect the process bound to the port first. The v8 investigation found `localhost:3030` was served by the installed macOS app process from:

```text
/Applications/CertificateReminder.app/Contents/MacOS/bun
```

Do not assume the repo dev server is serving `localhost:3030`; confirm with process inspection.

## Packaging Notes

The Desktop handoff folder should mirror the v8 folder format. For v9, use:

```text
/Users/kevin.sabatino/Desktop/Send-To-Colleague-v9.0.0
```

The DMG and installer should come from the current branch build artifacts. The human-facing instruction files can be based on the v8 handoff docs, but must be updated to the current version and filenames.

If the build script skips `examples/`, that is expected when private examples are intentionally absent from the public repo.

## Security And Privacy

- This is a public GitHub repo.
- Do not commit personal spreadsheets, Word templates, certificate data, app data, secrets, or local-only examples.
- Keep `.env*`, `data/`, `examples/`, Office documents, spreadsheets, DMGs, app bundles, and build outputs ignored unless the user explicitly decides otherwise.

## Communication With Kevin

- Work step by step and report concrete findings.
- When validating assumptions, give exact paths, branch names, commit hashes, and artifact names.
- Prefer doing the repo/build work directly when the next step is clear.
- Ask only when a choice cannot be safely inferred from the repo or prior discussion.
