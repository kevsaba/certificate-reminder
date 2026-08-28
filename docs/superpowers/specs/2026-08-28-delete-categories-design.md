# Delete Categories — Design

**Date:** 2026-08-28
**Status:** Approved for planning
**Author:** Kevin (with Claude assistance)

## Motivation

The Certificate Reminder app lets the user manage a list of categories used to
filter which certificate entries get email reminders. Categories today come from
two sources:

1. **Excel-derived** — extracted from the uploaded Excel via
   `extractBaseCategory(entry.category).toUpperCase()`. These rotate naturally
   when a new Excel is uploaded.
2. **Custom** — added manually by the user via the "Add Category" input,
   persisted in `AppData.customCategories` in
   `~/Library/Application Support/CertificateReminder/data/app-data.json`.

There is no way to remove either kind. The custom list grows unbounded over
time; Excel-derived entries can't be excluded from the visible list except by
uploading a different Excel. The colleague using the app (Marta) has asked for
a way to delete categories so the list stays manageable.

## Goal

Let the user delete any category shown in the "Enabled Categories" grid —
custom or Excel-derived — and have that deletion persist across app restarts
and Excel re-uploads. Deleted categories can be brought back at any time via
the existing "Add Category" input.

Entries in the Excel whose category is deleted are skipped when sending emails,
and the UI shows a small warning line indicating how many entries were skipped
this way.

## Non-goals

- No separate "trash" / undo UI. Re-adding a category uses the existing input.
- No visual badges distinguishing "custom" vs "Excel-derived" categories in the
  UI.
- No changes to how Word templates are managed. Templates for a hidden category
  are kept as-is and simply become unused; if the category is re-added later,
  the template still works.
- No batch delete / multi-select.
- No changes to the Excel or Word parsing pipelines.

## Design

### Data model

Extend the existing `AppData` interface in `src/types/index.ts` with one new
optional field:

```ts
export interface AppData {
  entries: CertificateEntry[];
  templates: Template[];
  customCategories?: string[];
  hiddenCategories?: string[];   // NEW: normalized, uppercase, sorted
}
```

- Values are normalized through the same
  `normalizeTemplateType(...).toUpperCase()` pipeline the codebase already
  uses, so `"perfil biocidas"` and `"PERFIL_BIOCIDAS"` cannot be stored as two
  different entries.
- A missing field is treated as `[]`. No migration script is needed — the app
  reads existing JSON with the field absent and writes it back with the field
  present the next time the state changes.
- The array is deduped and sorted every time it is written, matching the
  existing convention for `customCategories`.

### Backend API (`src/bun/index.ts`)

The existing `/api/categories` handler is extended:

**GET `/api/categories`** — response body becomes:

```json
{ "customCategories": [...], "hiddenCategories": [...] }
```

**POST `/api/categories`** — behavior is unchanged for the caller, with one
internal addition: when a category is added, it is also removed from
`hiddenCategories` in the same write. Response body includes both lists.

**DELETE `/api/categories`** — new handler:

- Request body: `{ "category": "SOMETHING" }`.
- Normalize input the same way POST does.
- If the normalized value is empty → 400 with
  `{ "error": "Category name is required" }`.
- Remove the value from `customCategories` if present.
- Add the value to `hiddenCategories` (deduped, sorted).
- Save `AppData` and return `{ customCategories, hiddenCategories }` with 200.
- The operation is idempotent: deleting a category that is neither custom nor
  known succeeds and returns the updated (still-idempotent) state.

**`/api/check`** — no request-shape change. Server-side logic changes:

- Load `hiddenCategories` from `AppData`.
- Filter `entries` to exclude those whose `extractBaseCategory(entry.category).toUpperCase()` is in `hiddenCategories`.
- Count how many entries were filtered → `skippedHidden`.
- Pass the filtered list into `checkExpirations`, then combine with the
  existing `enabledCategories` filter as today.
- Include `skippedHidden` in the response `result` object.

The existing `enabledCategories` gating (checkbox-driven, per-run) keeps
working. Hidden filtering runs **first**; enabled filtering runs **second**.

### Frontend (`src/app/page.tsx`)

State additions:

- `hiddenCategories: string[]` alongside the existing `customCategories`.
- On mount, `GET /api/categories` returns both lists; set both from the
  response.

Derived state:

- `categoryOptions = Array.from(new Set([...excelDerived, ...customCategories]))`
  `.filter(c => !hiddenCategories.includes(c)).sort()`.
- `skippedHiddenCount = entries.filter(e => hiddenCategories.includes(extractBaseCategory(e.category).toUpperCase())).length`.

Excel upload path (`handleExcelUpload`) must also filter the uploaded Excel
categories against `hiddenCategories` before calling
`setEnabledCategories(...)`. Otherwise a hidden Excel-derived category would
end up enabled but not visible, and the Send button would try to include it
on the next run.

UI changes to the "Enabled Categories" section:

- Each category chip (the `<label>` in the grid) gets a small **×** button on
  the right side. Click →
  1. `window.confirm("Delete category 'FOO'? Entries in this category will be skipped when sending emails.")`.
  2. If confirmed: `fetch('/api/categories', { method: 'DELETE', body: JSON.stringify({ category }) })`.
  3. On success: replace local `customCategories` and `hiddenCategories` from
     the response, and remove the deleted category from `enabledCategories`.
  4. On failure: `alert(data.error || 'Failed to delete category')`.
- When `skippedHiddenCount > 0`, render a subtle amber warning **above** the
  category grid:
  `⚠ N entries in hidden categories will be skipped. Re-add a category to include them.`

No new components are needed. All changes fit inside `page.tsx`.

### Shared helper

Extract the filter logic into a new file `src/lib/categories.ts` so it can be
unit-tested without the bun server:

```ts
export function visibleCategories(
  excelDerived: string[],
  custom: string[],
  hidden: string[],
): string[] { ... }

export function countHiddenEntries(
  entries: CertificateEntry[],
  hidden: string[],
): number { ... }
```

Both the frontend (`page.tsx`) and the backend (`bun/index.ts`) import from
this helper so the definitions of "visible" and "hidden" stay in one place.

## Edge cases

- **Empty category name in DELETE** → 400, same shape as POST validation.
- **DELETE for an unknown category** → succeeds idempotently. Server writes
  the value into `hiddenCategories` in case a future Excel upload introduces
  it.
- **Deleting a category that is currently enabled** → the client immediately
  removes it from `enabledCategories` so the enabled-count and Send button
  state stay consistent.
- **Re-uploading an Excel that contains a hidden category** → the category
  stays hidden. The warning line updates its count based on the new entries.
- **Word templates for a hidden category** → left untouched. If the category
  is re-added later, the template continues to work. No orphan/dead-code risk
  because templates are keyed by category name.
- **Concurrent writes** → not a concern. This is a single-user local app; the
  existing code does read → modify → write with no locking, and DELETE follows
  the same pattern.
- **Old app-data.json without `hiddenCategories`** → treated as `[]` on read;
  the field is written on next save.

## Testing

### New unit tests

1. **`src/lib/__tests__/categories.test.ts`**
   Pure logic tests for `visibleCategories` and `countHiddenEntries`:
   - Empty hidden list returns the union of Excel + custom, sorted, deduped.
   - Hidden overlaps custom → hidden wins, custom is filtered out. (The API
     write-side keeps them disjoint; this test documents the filter's
     defensive behavior if they ever overlap.)
   - Hidden overlaps Excel-derived → hidden wins.
   - `countHiddenEntries` returns the correct count with a mix of hidden
     and visible categories, and 0 when hidden is empty.

2. **`src/lib/__tests__/scheduler-hidden-categories.test.ts`**
   Extends the existing scheduler test approach:
   - Entries with a hidden category are skipped and not passed to
     `checkExpirations`.
   - `skippedHidden` count is correct.
   - Interaction with `enabledCategories` is correct (hidden filtered first,
     then enabled).

### Existing tests to re-verify

- `bun run test:missing-template`
- `bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts`

### Manual QA on the dev server

- Upload Excel with 3 categories → all appear in the grid.
- Add custom category `TEST_A` → appears in the list.
- Delete `TEST_A` → confirm dialog fires; the chip disappears; refresh the
  page → still gone.
- Delete an Excel-derived category `PRL` → chip disappears; warning line
  shows `⚠ N entries in hidden categories will be skipped.`; refresh the
  page → still gone; re-upload the same Excel → still gone; warning still
  shows.
- Re-add `PRL` via the input → un-hides; warning disappears; chip is back
  and enabled by default.
- Click "Send Email Reminders" while a category is hidden → skipped entries
  do not receive emails; the summary block shows the effect (via
  `skippedHidden` returned from `/api/check`).

## Rollout

- Ship as part of the next patch release (probably v9.1.0 given the recent
  v9.0.0 fix release).
- No migration needed; existing installs will pick up the empty field on
  their next state write.
- Update `README.md` and `USER_GUIDE.md` with one short paragraph explaining
  the delete affordance and the skipped-entries warning.
- Follow the existing release process in `AGENTS.md` (release branch,
  version bump, `./build-dmg.sh`, Desktop handoff folder, PKG install
  verification).
