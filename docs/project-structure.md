# 📁 Project Structure

> **[Back to README](../README.md)**

---

## Directory Overview

```
spreadsheet-lite/
├── docs/                        ← Architecture, decisions, features (you are here)
└── src/
    ├── app/                     ← Next.js App Router pages
    │   ├── layout.tsx           ← Root layout (Server Component — html/body/fonts only)
    │   ├── page.tsx             ← Dashboard route: /
    │   ├── globals.css          ← Tailwind + custom scrollbar utilities
    │   └── sheet/[id]/page.tsx  ← Editor route: /sheet/:id
    ├── components/              ← All UI components (Client Components)
    │   ├── Grid.tsx             ← ⭐ The spreadsheet engine — most complex file
    │   ├── Toolbar.tsx          ← Editor top bar: title, sync state, avatars, export
    │   └── Navbar.tsx           ← Dashboard nav: logo, user avatar, sign-out
    ├── hooks/                   ← Firebase bindings as custom React hooks
    │   ├── useAuth.ts           ← Firebase Auth state
    │   ├── useDocuments.ts      ← Firestore: list + create spreadsheets
    │   ├── useDocument.ts       ← Firestore: single document metadata + updateTitle
    │   ├── useGridSync.ts       ← RTDB: full cell map, updateCell, updateFormat, syncState
    │   └── usePresence.ts       ← RTDB: activeUsers map, updateCursor, onDisconnect cleanup
    ├── lib/                     ← Pure utility modules (no React, no Firebase side-effects)
    │   ├── firebase.ts          ← Firebase SDK initialization (Auth + Firestore + RTDB)
    │   ├── formula.ts           ← ⭐ Recursive formula parser + cycle detection
    │   ├── export.ts            ← CSV / TSV / JSON export — reads in-memory cells map
    │   └── colors.ts            ← Presence cursor color palette
    └── types/
        └── types.ts             ← AppUser, SpreadsheetDoc, CellData, PresenceData
```

---

## Key Files In Depth

### `Grid.tsx` — The Heart of the App

All spreadsheet interaction lives in one file. Here's what it manages:

**Local state (UI-only, not synced to Firebase):**

| State | Purpose |
|-------|---------|
| `selectedCell` | The active cell ID string (e.g., `"B3"`) |
| `editingCell` | Which cell is in edit mode (shows raw formula) |
| `selectionStart / End` | The two corners of the rectangular bounding-box selection |
| `isSelecting` | `true` while mouse button is held during drag-selection |
| `colWidths` | Per-column pixel widths `Record<number, number>` |
| `rowHeights` | Per-row pixel heights `Record<number, number>` |
| `colOrder` | Visual ordering of column indices — supports drag-to-reorder |
| `resizing` | Active resize metadata: `{ type, index, startPos, startSize }` |

**External state (from hooks):**
- `cells` from `useGridSync` — the RTDB-synced `Record<cellId, CellData>` map
- `activeUsers` from `usePresence` — map of other users and their `activeCellId`

**Rendering model:**
- Every cell is an `<input readOnly>` in non-edit mode (value = computed result)
- In edit mode, `readOnly` is removed and value = raw formula string
- Remote user presence = absolutely-positioned `<div>` with `borderColor = user.cursorColor`
- Selection highlight = absolutely-positioned `<div>` with `bg-blue-500/10`

---

### `lib/formula.ts` — The Formula Engine

<details>
<summary><b>Show: evaluation pipeline</b></summary>

```
Input: "=SUM(A1:A5)"
  1. Detect leading "=" → it's a formula
  2. Parse: identify function name "SUM", argument "A1:A5"
  3. Expand range: "A1:A5" → ["A1", "A2", "A3", "A4", "A5"]
  4. Resolve each cell: look up cells["A1"].value, recursively evaluate if formula
  5. Cycle check: if cellId is in `visited` Set → return "#CYCLE!"
  6. Sum the resolved values → return result
```

</details>

- Supports: `SUM(range)`, cell refs, `+`, `-`, `*`, `/`, `()`
- Cycle detection: visited-set passed through every recursive call
- Lives in `lib/` (no React imports) — pure function, easily unit-testable

---

### `useGridSync.ts` — The RTDB Bridge

- Subscribes to `onValue(ref(rtdb, 'documents/{docId}/cells'))` on mount
- Exposes `cells: Record<string, CellData>` — the source of truth for the entire grid
- `updateCell(cellId, value)` — single path write
- `updateFormat(cellIds[], formatObj)` — resolves to an atomic multi-path `update()` call
- Tracks `syncState`: `'syncing' | 'synced' | 'error'` — lifted to Toolbar via `setSyncState` prop

---

### `usePresence.ts` — The Multiplayer Layer

- On mount: writes user presence node + registers `onDisconnect().remove()`
- `updateCursor(cellId)` — writes `activeCellId` to RTDB presence on every cell click
- Subscribes to all sibling presence nodes — `activeUsers` map updates in real time
- On unmount: manually calls `remove()` to clean up presence immediately (don't wait for disconnect)

---

## Architectural Principle

> **Every hook owns exactly one concern. No hook imports another hook.**

`Grid.tsx` composes `useGridSync` and `usePresence` at the component level. The grid knows about both. Neither hook knows about the other. This makes each hook independently testable and replaceable.


### `src/components/Toolbar.tsx` — Editor Toolbar

Renders the top bar of the editor. Receives:
- `document` — current spreadsheet metadata (title, etc.)
- `updateTitle` — callback to save title to Firestore
- `docId` — for presence and export
- `syncState` — `'synced' | 'syncing' | 'error'`

Also independently consumes `usePresence` to display active user avatars.

---

### `src/components/Navbar.tsx` — Dashboard Navbar

Renders the top bar of the dashboard. Shows the app logo and:
- A "Sign in" button (unauthenticated)
- User avatar, name, and "Sign out" button (authenticated)

---

### `src/hooks/useAuth.ts` — Auth Hook

Wraps `onAuthStateChanged`. Returns:
- `user: AppUser | null` — current user (enriched with a random `cursorColor`)
- `loading: boolean` — true until the first auth state is known
- `loginWithGoogle()` — triggers Google OAuth popup
- `logout()` — calls `signOut(auth)`

---

### `src/hooks/useDocuments.ts` — Document List Hook

Wraps a Firestore `onSnapshot` query. Returns:
- `documents: SpreadsheetDoc[]` — live list of user's spreadsheets
- `loading: boolean`
- `createDocument()` — creates a new Firestore document, returns its ID

---

### `src/hooks/useDocument.ts` — Single Document Hook

Wraps a Firestore `onSnapshot` for one document. Returns:
- `document: SpreadsheetDoc | null`
- `loading: boolean`
- `updateTitle(newTitle)` — updates the Firestore document

---

### `src/hooks/useGridSync.ts` — Cell Sync Hook

The core real-time sync hook. Wraps RTDB operations. Returns:
- `cells: Record<string, CellData>` — always-current cell state
- `updateCell(cellId, value)` — writes a single cell value
- `updateFormat(cellIds[], format)` — batch-writes formatting to multiple cells

Both write functions use **optimistic updates**: local state is updated before the async RTDB write.

---

### `src/hooks/usePresence.ts` — Presence Hook

Manages the current user's presence and reads all others'. Returns:
- `activeUsers: Record<string, PresenceData>` — all users currently in the document
- `updateCursor(cellId)` — broadcasts the current user's active cell

Uses `onDisconnect(presenceRef).remove()` to ensure cleanup on disconnect.

---

### `src/lib/firebase.ts` — Firebase Init

Initializes the Firebase app once (guards against hot-reload re-initialization in development) and exports three services:

```typescript
export const auth  = getAuth(app);      // Firebase Authentication
export const db    = getFirestore(app); // Firestore (metadata)
export const rtdb  = getDatabase(app);  // RTDB (cells + presence)
```

---

### `src/lib/formula.ts` — Formula Engine

Pure functions, no side effects, no imports from Firebase or React. See [Features → Formula Engine](./features.md#formula-engine) for the full reference.

Key functions:
- `evaluateFormula(formula, cells, visited?)` — the public API
- `getCellValue(cellId, cells, visited)` — recursively resolves cell dependencies
- `expandRange(start, end)` — converts `"A1:B3"` to an array of cell IDs

---

### `src/lib/export.ts` — Export Utilities

Contains `exportData(docId, title, format)`. Reads cell data from RTDB (one-time `get()`), serializes to the target format, and triggers a browser download.

See [Features → Export](./features.md#export) for supported formats.

---

### `src/lib/colors.ts` — Cursor Colors

A small palette of 8 hex colors used for presence cursor assignment. A random color is selected via `getRandomColor()` when a user signs in and stored on the `AppUser` object for the lifetime of the session.

---

### `src/types/types.ts` — TypeScript Interfaces

| Interface | Used for |
|-----------|---------|
| `AppUser` | Authenticated user (extends Firebase user with `cursorColor`) |
| `SpreadsheetDoc` | Firestore document metadata |
| `CellData` | RTDB cell (value + formatting + audit fields) |
| `PresenceData` | RTDB presence entry per user per document |
