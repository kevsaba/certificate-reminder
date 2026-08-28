# Delete Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user delete any category (custom or Excel-derived) from the "Enabled Categories" list, persist those deletions across app restarts and Excel re-uploads, and skip entries in hidden categories when sending emails (with a visible warning).

**Architecture:** One new persistent field `hiddenCategories: string[]` in `AppData`. Backend gains a `DELETE /api/categories` handler and filters hidden entries out of `/api/check`. Frontend adds an × button on each category chip, a confirm dialog, a DELETE call, and a small amber warning line when there are hidden entries.

**Tech Stack:** Bun (backend server + test runner), Next.js 16 + React 19 (frontend), TypeScript, TailwindCSS.

**Spec:** `docs/superpowers/specs/2026-08-28-delete-categories-design.md`.

---

## File Structure

Files created or modified in this plan:

- **Modify** `src/types/index.ts` — add `hiddenCategories?: string[]` to `AppData`; add `skippedHidden?: number` to `CheckResult`.
- **Create** `src/lib/categories.ts` — pure helpers `visibleCategories()` and `countHiddenEntries()`. Shared between frontend and backend so the filter definition lives in one place.
- **Create** `src/lib/__tests__/categories.test.ts` — unit tests for the two helpers.
- **Create** `src/lib/__tests__/scheduler-hidden-categories.test.ts` — integration test that hidden entries are excluded from `checkExpirations`.
- **Modify** `src/bun/index.ts` — extend GET/POST `/api/categories`, add DELETE handler, filter hidden entries out of `/api/check` and return `skippedHidden`.
- **Modify** `src/app/page.tsx` — load `hiddenCategories`, filter `categoryOptions` and Excel upload, add × button + confirm + DELETE call, add "N entries hidden" warning.
- **Modify** `README.md` and `USER_GUIDE.md` — one short paragraph each explaining the new affordance.

Each task below is self-contained: types are stable within a task; later tasks reference names introduced in earlier tasks by exact spelling.

---

## Task 1: Add `hiddenCategories` and `skippedHidden` to types

**Files:**
- Modify: `src/types/index.ts:34-60`

- [ ] **Step 1: Add `skippedHidden` to `CheckResult`**

Edit `src/types/index.ts`. Change the `CheckResult` interface to add one optional field:

```ts
export interface CheckResult {
  timestamp: Date;
  checked: number;
  remindersSent: number;
  emailsSent?: number;      // NEW
  emailsFailed?: number;    // NEW
  skippedHidden?: number;   // NEW: entries filtered out because their category is hidden
  results: Array<{
    email: string;
    category: string;
    expirationDate: string;
    daysRemaining: number;
    status: 'sent' | 'failed' | 'skipped';
  }>;
}
```

- [ ] **Step 2: Add `hiddenCategories` to `AppData`**

In the same file, change the `AppData` interface:

```ts
export interface AppData {
  entries: CertificateEntry[];
  templates: Template[];
  customCategories?: string[];
  hiddenCategories?: string[];   // NEW: normalized (uppercase), sorted, deduped
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bun run build`
Expected: build succeeds with no type errors. If it fails complaining about `CheckResult` or `AppData`, re-check the edits above.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add hiddenCategories and skippedHidden fields"
```

---

## Task 2: Create shared `categories` helper with tests (TDD)

**Files:**
- Create: `src/lib/categories.ts`
- Create: `src/lib/__tests__/categories.test.ts`

The helper centralizes the filter logic. Both the backend (`/api/check`) and the frontend (`page.tsx`) will import from here, so we never end up with two subtly different definitions of "visible" or "hidden".

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/categories.test.ts` with the following contents:

```ts
import { describe, expect, test } from 'bun:test';
import { visibleCategories, countHiddenEntries } from '../categories';
import type { CertificateEntry } from '@/types';

function entry(category: string): CertificateEntry {
  return {
    id: category,
    category,
    expirationDate: new Date('2026-01-01'),
    email: 'user@example.test',
  };
}

describe('visibleCategories', () => {
  test('returns sorted, deduped union of excel and custom when hidden is empty', () => {
    expect(visibleCategories(['B', 'A'], ['C', 'A'], [])).toEqual(['A', 'B', 'C']);
  });

  test('filters out hidden categories present in the excel list', () => {
    expect(visibleCategories(['A', 'B', 'C'], [], ['B'])).toEqual(['A', 'C']);
  });

  test('filters out hidden categories present in the custom list', () => {
    expect(visibleCategories([], ['A', 'B', 'C'], ['B'])).toEqual(['A', 'C']);
  });

  test('hidden wins when the same value appears in custom and hidden', () => {
    // Defensive: the API keeps these disjoint on writes, but the pure
    // filter documents what happens if they ever overlap.
    expect(visibleCategories([], ['FICHA'], ['FICHA'])).toEqual([]);
  });

  test('normalizes case: hidden matches regardless of casing in inputs', () => {
    expect(visibleCategories(['ficha'], [], ['FICHA'])).toEqual([]);
  });
});

describe('countHiddenEntries', () => {
  test('returns 0 when hidden is empty', () => {
    expect(countHiddenEntries([entry('FICHA'), entry('EPIS')], [])).toBe(0);
  });

  test('counts entries whose base category matches a hidden entry', () => {
    const entries = [
      entry('FICHA - 2025'),
      entry('FICHA - 2024'),
      entry('EPIS - 2025'),
      entry('APTO - 2025'),
    ];
    expect(countHiddenEntries(entries, ['FICHA'])).toBe(2);
  });

  test('matches after base-category extraction and normalization', () => {
    // FORMACION should be normalized to TELEFORMACION by extractBaseCategory
    const entries = [entry('FORMACION - 2025'), entry('TELEFORMACION - 2024')];
    expect(countHiddenEntries(entries, ['TELEFORMACION'])).toBe(2);
  });

  test('is case-insensitive on the hidden list', () => {
    const entries = [entry('FICHA - 2025')];
    expect(countHiddenEntries(entries, ['ficha'])).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `bun test src/lib/__tests__/categories.test.ts`
Expected: FAIL with an error like `Cannot find module '../categories'`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/categories.ts`:

```ts
import { extractBaseCategory } from './expiration';
import type { CertificateEntry } from '@/types';

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

export function visibleCategories(
  excelDerived: string[],
  custom: string[],
  hidden: string[],
): string[] {
  const hiddenSet = new Set(hidden.map(normalize));
  const union = new Set<string>();
  for (const value of excelDerived) union.add(normalize(value));
  for (const value of custom) union.add(normalize(value));
  return Array.from(union)
    .filter((value) => !hiddenSet.has(value))
    .sort();
}

export function countHiddenEntries(
  entries: CertificateEntry[],
  hidden: string[],
): number {
  if (hidden.length === 0) return 0;
  const hiddenSet = new Set(hidden.map(normalize));
  let count = 0;
  for (const entry of entries) {
    const baseCategory = normalize(extractBaseCategory(entry.category));
    if (hiddenSet.has(baseCategory)) count++;
  }
  return count;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `bun test src/lib/__tests__/categories.test.ts`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/__tests__/categories.test.ts
git commit -m "feat(categories): add visibleCategories and countHiddenEntries helpers"
```

---

## Task 3: Extend `GET /api/categories` and `POST /api/categories`

**Files:**
- Modify: `src/bun/index.ts:154-197`

The existing handler already reads `AppData` and returns `customCategories`. We extend it to also return `hiddenCategories`, and to un-hide a category on POST when it's added back.

- [ ] **Step 1: Update the GET branch**

In `src/bun/index.ts`, locate the `/api/categories` handler (around line 154-197) and replace the inside of the `try` block up to and including the POST branch with:

```ts
const existingData = loadAppData();
const customCategories = existingData?.customCategories || [];
const hiddenCategories = existingData?.hiddenCategories || [];

if (method === 'GET') {
  return new Response(JSON.stringify({ customCategories, hiddenCategories }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

if (method === 'POST') {
  const body = await req.json();
  const category = typeof body.category === 'string'
    ? normalizeTemplateType(body.category)
    : '';

  if (!category) {
    return new Response(JSON.stringify({ error: 'Category name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedCustom = Array.from(new Set([...customCategories, category])).sort();
  const updatedHidden = hiddenCategories.filter((value) => value !== category);

  saveAppData({
    entries: existingData?.entries || [],
    templates: existingData?.templates || [],
    customCategories: updatedCustom,
    hiddenCategories: updatedHidden,
  });

  return new Response(JSON.stringify({
    customCategories: updatedCustom,
    hiddenCategories: updatedHidden,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Note the additions vs. the existing code: the response also carries `hiddenCategories`, POST removes the added category from `hiddenCategories`, and both branches source both lists from the same `existingData` read.

- [ ] **Step 2: Verify the build still passes**

Run: `bun run build`
Expected: build succeeds. If there's a TypeScript error about `hiddenCategories` on `AppData`, re-check Task 1.

- [ ] **Step 3: Smoke-test the endpoint by hand**

Run: `bun src/bun/index.ts &` then in another shell:
```bash
curl -s http://localhost:3030/api/categories
```
Expected response shape:
```json
{"customCategories": [...], "hiddenCategories": []}
```

Kill the background bun with: `pkill -f 'bun src/bun/index.ts'`

- [ ] **Step 4: Commit**

```bash
git add src/bun/index.ts
git commit -m "feat(api): return hiddenCategories from /api/categories and un-hide on POST"
```

---

## Task 4: Add `DELETE /api/categories` handler

**Files:**
- Modify: `src/bun/index.ts` (inside the same `/api/categories` block edited in Task 3)

- [ ] **Step 1: Add the DELETE branch**

Inside the `/api/categories` handler (right after the POST branch closes, before the `catch`), add:

```ts
if (method === 'DELETE') {
  const body = await req.json();
  const category = typeof body.category === 'string'
    ? normalizeTemplateType(body.category)
    : '';

  if (!category) {
    return new Response(JSON.stringify({ error: 'Category name is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedCustom = customCategories.filter((value) => value !== category);
  const updatedHidden = Array.from(new Set([...hiddenCategories, category])).sort();

  saveAppData({
    entries: existingData?.entries || [],
    templates: existingData?.templates || [],
    customCategories: updatedCustom,
    hiddenCategories: updatedHidden,
  });

  return new Response(JSON.stringify({
    customCategories: updatedCustom,
    hiddenCategories: updatedHidden,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Verify the build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 3: Smoke-test DELETE by hand**

Start the server: `bun src/bun/index.ts &`
Then:
```bash
curl -s -X DELETE http://localhost:3030/api/categories \
  -H 'Content-Type: application/json' \
  -d '{"category":"TESTCAT"}'
```
Expected: 200 with a JSON body containing `hiddenCategories: ["TESTCAT"]`.

Repeat the call — it should still return 200 (idempotent). Then GET:
```bash
curl -s http://localhost:3030/api/categories
```
Expected: `hiddenCategories` still contains `TESTCAT`.

Now POST to re-add:
```bash
curl -s -X POST http://localhost:3030/api/categories \
  -H 'Content-Type: application/json' \
  -d '{"category":"TESTCAT"}'
```
Expected: `customCategories` contains `TESTCAT`, `hiddenCategories` is empty (un-hide on add).

Clean up: `pkill -f 'bun src/bun/index.ts'`

Remove the test entry from `~/Library/Application Support/CertificateReminder/data/app-data.json` if desired, or leave it — it will not affect any real data.

- [ ] **Step 4: Commit**

```bash
git add src/bun/index.ts
git commit -m "feat(api): add DELETE /api/categories handler"
```

---

## Task 5: Filter hidden entries in `/api/check` and return `skippedHidden`

**Files:**
- Modify: `src/bun/index.ts:199-249` (the `/api/check` handler)

- [ ] **Step 1: Add the import for `countHiddenEntries`**

At the top of `src/bun/index.ts`, add the import:

```ts
import { countHiddenEntries } from '../lib/categories';
import { extractBaseCategory } from '../lib/expiration';
import { normalizeTemplateType } from '../lib/word';
```

(The `normalizeTemplateType` import is already present via the top-of-file imports from `../lib/word` — leave it. Only add `countHiddenEntries` and `extractBaseCategory` if not already imported. Check with: `grep "extractBaseCategory\|countHiddenEntries" src/bun/index.ts`.)

- [ ] **Step 2: Filter hidden entries and compute `skippedHidden`**

Inside the `/api/check` handler, after `const appData = loadAppData();` and the empty-entries guard, but **before** `const templates = appData.templates || [];`, add:

```ts
const hiddenCategories = appData.hiddenCategories || [];
const hiddenSet = new Set(hiddenCategories.map((value) => normalizeTemplateType(value)));
const visibleEntries = appData.entries.filter((entry) => {
  const baseCategory = normalizeTemplateType(extractBaseCategory(entry.category));
  return !hiddenSet.has(baseCategory);
});
const skippedHidden = appData.entries.length - visibleEntries.length;
```

Then change the call to `checkExpirations` to use `visibleEntries` instead of `appData.entries`:

```ts
const result = await checkExpirations(visibleEntries, templates, {
  channels: { email: true },
  enabledCategories,
});
```

Then change the response JSON to include `skippedHidden`:

```ts
return new Response(JSON.stringify({
  success: true,
  result: {
    ...result,
    emailsSent: (result as any).emailsSent || 0,
    emailsFailed: (result as any).emailsFailed || 0,
    skippedHidden,
  },
}), {
  headers: { 'Content-Type': 'application/json' },
});
```

- [ ] **Step 3: Verify the build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 4: Verify existing scheduler test still passes**

Run: `bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts`
Expected: all tests pass. (This confirms we haven't broken the existing pipeline.)

- [ ] **Step 5: Commit**

```bash
git add src/bun/index.ts
git commit -m "feat(api): filter hidden categories out of /api/check"
```

---

## Task 6: Integration test — hidden categories skipped end-to-end

**Files:**
- Create: `src/lib/__tests__/scheduler-hidden-categories.test.ts`

This test exercises the same pre-filter used by the bun handler. We simulate the filter step and then assert that `checkExpirations` receives only visible entries.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/scheduler-hidden-categories.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { checkExpirations } from '../scheduler';
import { countHiddenEntries } from '../categories';
import { extractBaseCategory } from '../expiration';
import { normalizeTemplateType } from '../word';
import type { CertificateEntry, Template } from '@/types';

const templates: Template[] = [
  { type: 'FICHA', html: '<p>FICHA [NAME] [DATE]</p>' },
  { type: 'EPIS', html: '<p>EPIS [NAME] [DATE]</p>' },
];

function entry(dni: string, category: string, expirationDate: string): CertificateEntry {
  return {
    id: `${dni}_${category}`,
    dni,
    category,
    expirationDate: new Date(expirationDate),
    email: `${dni.toLowerCase()}@example.test`,
  };
}

function filterHidden(entries: CertificateEntry[], hidden: string[]): CertificateEntry[] {
  const hiddenSet = new Set(hidden.map((v) => normalizeTemplateType(v)));
  return entries.filter((e) => !hiddenSet.has(normalizeTemplateType(extractBaseCategory(e.category))));
}

describe('hidden categories are excluded from checkExpirations', () => {
  const entries = [
    entry('A', 'FICHA - 2024', '2025-01-01'),
    entry('A', 'EPIS - 2024', '2025-01-01'),
    entry('B', 'FICHA - 2024', '2025-01-01'),
  ];

  test('countHiddenEntries counts entries in hidden categories', () => {
    expect(countHiddenEntries(entries, ['FICHA'])).toBe(2);
  });

  test('after filtering, checkExpirations does not emit sent results for hidden categories', async () => {
    const visible = filterHidden(entries, ['FICHA']);
    const result = await checkExpirations(visible, templates, { channels: { email: false } });
    const sentCategories = result.results
      .filter((r) => r.status === 'sent')
      .map((r) => extractBaseCategory(r.category));
    expect(sentCategories).not.toContain('FICHA');
    expect(sentCategories).toContain('EPIS');
  });

  test('empty hidden list leaves entries untouched', () => {
    expect(filterHidden(entries, []).length).toBe(entries.length);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `bun test src/lib/__tests__/scheduler-hidden-categories.test.ts`
Expected: all 3 tests pass. (The helpers already exist from Task 2; the scheduler already works. This test just verifies the composition.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/scheduler-hidden-categories.test.ts
git commit -m "test: hidden categories are excluded from scheduler results"
```

---

## Task 7: Frontend state, fetch, and derived filter

**Files:**
- Modify: `src/app/page.tsx:26-79`

- [ ] **Step 1: Add `hiddenCategories` state**

In `src/app/page.tsx`, right after the existing `customCategories` state (around line 27), add:

```tsx
const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
```

- [ ] **Step 2: Update `categoryOptions` to filter out hidden**

Locate the `categoryOptions` `useMemo` (around lines 30-35). Replace it with:

```tsx
const categoryOptions = useMemo(() => {
  const hiddenSet = new Set(hiddenCategories);
  return Array.from(new Set([
    ...entries.map(entry => extractBaseCategory(entry.category).toUpperCase()),
    ...customCategories,
  ]))
    .filter(category => !hiddenSet.has(category))
    .sort();
}, [entries, customCategories, hiddenCategories]);
```

- [ ] **Step 3: Load `hiddenCategories` alongside `customCategories`**

Locate the `loadCustomCategories` effect (around lines 63-79). Rename and expand it:

```tsx
useEffect(() => {
  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.customCategories)) {
          setCustomCategories(data.customCategories);
        }
        if (Array.isArray(data.hiddenCategories)) {
          setHiddenCategories(data.hiddenCategories);
        }
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  loadCategories();
}, []);
```

- [ ] **Step 4: Filter the Excel-upload categories against `hiddenCategories`**

Locate `handleExcelUpload` (around lines 81-113). Change the `uploadedCategories` computation so hidden ones don't end up in `enabledCategories`:

```tsx
const hiddenSet = new Set(hiddenCategories);
const uploadedCategories = Array.from(
  new Set(uploadedEntries.map(entry => extractBaseCategory(entry.category).toUpperCase()))
)
  .filter(category => !hiddenSet.has(category))
  .sort();
```

- [ ] **Step 5: Verify the build**

Run: `bun run build`
Expected: build succeeds. Common gotcha: forgetting to include `hiddenCategories` in the `useCallback` deps for `handleExcelUpload`. If ESLint warns, add `hiddenCategories` to the dep array.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): load hiddenCategories and exclude them from options"
```

---

## Task 8: Frontend delete button, confirm dialog, DELETE call

**Files:**
- Modify: `src/app/page.tsx` (in the `addCustomCategory` region and inside the category chip render)

- [ ] **Step 1: Add a `deleteCategory` handler**

In `src/app/page.tsx`, right after `addCustomCategory` (around lines 235-263), add:

```tsx
const deleteCategory = async (category: string) => {
  const confirmed = window.confirm(
    `Delete category '${category}'? Entries in this category will be skipped when sending emails.`
  );
  if (!confirmed) return;

  try {
    const response = await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Failed to delete category');
      return;
    }

    if (Array.isArray(data.customCategories)) {
      setCustomCategories(data.customCategories);
    }
    if (Array.isArray(data.hiddenCategories)) {
      setHiddenCategories(data.hiddenCategories);
    }
    setEnabledCategories(current => current.filter(enabled => enabled !== category));
  } catch (error) {
    console.error('Failed to delete category:', error);
    alert('Failed to delete category');
  }
};
```

- [ ] **Step 2: Add the × button inside each category chip**

Locate the `categoryOptions.map` block (around lines 470-483). Replace the `<label>` with:

```tsx
{categoryOptions.map(category => (
  <div
    key={category}
    className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-black bg-white"
  >
    <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
      <input
        type="checkbox"
        checked={enabledCategories.includes(category)}
        onChange={() => toggleCategory(category)}
        className="h-4 w-4 rounded border-gray-300 text-green-600"
      />
      <span className="truncate">{category}</span>
    </label>
    <button
      type="button"
      onClick={() => deleteCategory(category)}
      title={`Delete '${category}'`}
      aria-label={`Delete category ${category}`}
      className="flex-shrink-0 text-gray-400 hover:text-red-500 text-lg leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"
    >
      ×
    </button>
  </div>
))}
```

The chip changes from `<label>` to `<div>` because we now have two clickable children (the checkbox label and the × button); the label is nested inside so clicking the text still toggles the checkbox.

- [ ] **Step 3: Verify the build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): add delete button on category chips"
```

---

## Task 9: Frontend "N entries hidden" warning banner

**Files:**
- Modify: `src/app/page.tsx` (add derived count + banner render)

- [ ] **Step 1: Add the import for `countHiddenEntries`**

At the top of `src/app/page.tsx`, add:

```tsx
import { countHiddenEntries } from '@/lib/categories';
```

- [ ] **Step 2: Compute the skipped count**

Right after the `categoryOptions` `useMemo`, add:

```tsx
const skippedHiddenCount = useMemo(
  () => countHiddenEntries(entries, hiddenCategories),
  [entries, hiddenCategories],
);
```

- [ ] **Step 3: Render the warning above the category grid**

Locate the "Enabled Categories" card (around lines 443-513). Right after the header row (the block containing `<h3>Enabled Categories</h3>` and the Enable All / Disable All buttons) and **before** `<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">`, insert:

```tsx
{skippedHiddenCount > 0 && (
  <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    ⚠ {skippedHiddenCount} {skippedHiddenCount === 1 ? 'entry is' : 'entries are'} in hidden categories and will be skipped. Re-add a category to include them.
  </div>
)}
```

- [ ] **Step 4: Verify the build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): show warning for entries hidden by deleted categories"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `bun run dev`
Expected: server logs `Server running on http://localhost:3030`. A browser opens to the app.

- [ ] **Step 2: Baseline check**

Upload the same Excel file that Marta uses (or any Excel with at least 2 different categories). Confirm the categories appear in the "Enabled Categories" grid. Confirm no warning banner is showing.

- [ ] **Step 3: Delete a custom category**

Click "Add Category", type `TEST_CUSTOM`, hit Enter. Confirm it appears. Click the × button on it. Confirm dialog fires. Click OK. Confirm the chip disappears.

Refresh the page. Confirm `TEST_CUSTOM` is still gone.

- [ ] **Step 4: Delete an Excel-derived category**

Click × on one of the Excel-derived categories (e.g., `FICHA`). Confirm dialog fires; click OK. Confirm the chip disappears and the amber warning banner shows a non-zero count.

Refresh the page. Confirm the chip is still gone, the warning still shows.

Re-upload the same Excel. Confirm the chip is still gone, the warning still shows.

- [ ] **Step 5: Re-add the hidden category**

Type the deleted category into the "New category" input (e.g., `FICHA`), hit Add. Confirm the chip reappears, the warning disappears, and it's already checked in the enabled list.

- [ ] **Step 6: Verify skip on send**

Delete `FICHA` again. Click "Send Email Reminders". Watch the console / result summary. Entries with `FICHA` should not have emails sent. The API response includes `skippedHidden > 0` (visible in the browser's network tab under `/api/check`).

- [ ] **Step 7: Stop the dev server**

Close the browser tab and Ctrl+C the `bun run dev` process.

- [ ] **Step 8: If anything above failed**

Do not proceed to Task 11. Report the failure with the exact reproduction steps, revisit the failing task, and fix.

---

## Task 11: Update user-facing docs

**Files:**
- Modify: `README.md`
- Modify: `USER_GUIDE.md`

- [ ] **Step 1: Add a paragraph to `README.md`**

Find a place near the existing feature description (search for "categories" — if there's a features section, add a bullet there; otherwise add it right after the "What The App Does" section). Add:

```markdown
- **Delete categories:** Click the × on any category chip in the "Enabled Categories" grid to remove it. Deleted categories persist across restarts and Excel re-uploads. Entries in a deleted category are skipped when sending emails, and a small warning above the grid shows how many are being skipped. To bring a category back, type it into the "New category" input and click Add.
```

- [ ] **Step 2: Add a paragraph to `USER_GUIDE.md`**

Same content, rephrased slightly to fit the guide's tone. Add it to whichever section describes managing categories:

```markdown
### Removing a category

Each category chip has a small × on the right. Click it to remove the category. You'll be asked to confirm. Removed categories stay hidden even after restarting the app or uploading a new Excel file. If entries in your Excel belong to a removed category, you'll see an amber warning line telling you how many are being skipped. To restore a removed category, use the "New category" input at the bottom of the section.
```

- [ ] **Step 3: Verify the docs build/render**

Run: `bun run build`
Expected: build succeeds. (No doc-specific build step; the goal is to catch any Markdown that accidentally broke something else.)

- [ ] **Step 4: Commit**

```bash
git add README.md USER_GUIDE.md
git commit -m "docs: describe the delete-category affordance"
```

---

## Task 12: Full test sweep before merging

**Files:** none (verification only)

- [ ] **Step 1: Run the full validation set from `AGENTS.md`**

```bash
bun run build
bun run test:missing-template
bun test src/lib/__tests__/scheduler-consentimiento-renuncia.test.ts
bun test src/lib/__tests__/categories.test.ts
bun test src/lib/__tests__/scheduler-hidden-categories.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 2: Check for stale-version references**

```bash
rg "9\.0\.0|Send-To-Colleague-v9|CertificateReminder-9"
```

Expected output: only the expected references in `package.json`, `electrobun.config.ts`, `build-dmg.sh`, `Install-CertificateReminder.command`, `README.md`, `USER_GUIDE.md`, `DISTRIBUTION_README.md`. No unexpected hits.

If a version bump is planned as part of this feature (e.g., 9.1.0), that's a separate change — do it after this feature is confirmed working and follow `AGENTS.md` "Release Versioning".

- [ ] **Step 3: Report ready for release**

Summarize to Kevin: what was implemented, which files changed, which tests were run, and what he should do next (test on his machine, then re-package via `./build-dmg.sh` for Marta).
