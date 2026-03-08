# Project Structure

> **Back to** [README](../README.md)

---

## Directory Overview

```
spreadsheet-lite/
├── docs/                        ← Documentation (you are here)
│   ├── architecture.md          ← System architecture & data flow
│   ├── design-decisions.md      ← Why RTDB, client formulas, no CRDT
│   ├── features.md              ← Full feature & non-feature reference
│   └── project-structure.md    ← This file
│
├── public/                      ← Static assets (Next.js default)
│
├── src/
│   ├── app/                     ← Next.js App Router pages
│   │   ├── layout.tsx           ← Root layout (Server Component)
│   │   ├── page.tsx             ← Dashboard route: /
│   │   ├── globals.css          ← Global Tailwind CSS
│   │   └── sheet/
│   │       └── [id]/
│   │           └── page.tsx     ← Editor route: /sheet/:id
│   │
│   ├── components/              ← UI Components (Client Components)
│   │   ├── Grid.tsx             ← The spreadsheet grid
│   │   ├── Toolbar.tsx          ← Editor top bar
│   │   └── Navbar.tsx           ← Dashboard navigation bar
│   │
│   ├── hooks/                   ← Custom React hooks (Firebase bindings)
│   │   ├── useAuth.ts           ← Firebase Auth state
│   │   ├── useDocuments.ts      ← Firestore: list & create spreadsheets
│   │   ├── useDocument.ts       ← Firestore: single document metadata
│   │   ├── useGridSync.ts       ← RTDB: cell read/write/formatting
│   │   └── usePresence.ts       ← RTDB: user cursors & active cells
│   │
│   ├── lib/                     ← Pure utility modules
│   │   ├── firebase.ts          ← Firebase SDK initialization
│   │   ├── formula.ts           ← Formula parser & evaluator
│   │   ├── export.ts            ← CSV / TSV / JSON export logic
│   │   └── colors.ts            ← Presence cursor color palette
│   │
│   └── types/
│       └── types.ts             ← TypeScript interfaces
│
├── next.config.ts               ← Next.js configuration
├── tsconfig.json                ← TypeScript configuration
├── eslint.config.mjs            ← ESLint configuration
├── postcss.config.mjs           ← PostCSS / Tailwind configuration
└── package.json                 ← Dependencies & scripts
```

---

## File-by-File Reference

### `src/app/layout.tsx` — Root Layout

The only true **Server Component** in the project. Responsibilities:
- Wraps all pages in `<html>` and `<body>` tags.
- Loads the Inter font via `next/font/google` (font bytes are self-hosted by Next.js at build time — no Google Fonts network calls at runtime).
- Exports `metadata` (page title, description) for SEO and browser tab title.

**Why Server Component?** It handles only static concerns. No Firebase, no hooks, no browser APIs.

---

### `src/app/page.tsx` — Dashboard

Client Component. The home route (`/`). Shows:
- Login prompt for unauthenticated users.
- Document gallery for authenticated users.
- "Blank Spreadsheet" creation button.

Hooks used: `useAuth`, `useDocuments`.

---

### `src/app/sheet/[id]/page.tsx` — Spreadsheet Editor

Client Component. The editor route (`/sheet/:id`). Responsibilities:
- Extracts `docId` from the URL via `useParams()`.
- Route protection: redirects to `/` if not authenticated.
- Lifts `syncState` between `Grid` (producer) and `Toolbar` (consumer).
- Renders loading/error states.

Hooks used: `useAuth`, `useDocument`.

---

### `src/components/Grid.tsx` — The Grid

The most complex component in the project. All spreadsheet interaction lives here.

**State managed locally (not synced):**
- `selectedCell` — the active cell ID
- `editingCell` — the cell currently in edit mode (shows raw formula)
- `selectionStart` / `selectionEnd` — defines the rectangular selection range
- `isSelecting` — true while mouse button is held during range selection
- `colWidths` — per-column pixel widths (default: 150px)
- `rowHeights` — per-row pixel heights (default: 32px)
- `colOrder` — current visual order of column indices (supports drag-to-reorder)
- `draggedColIndex` — which column is being dragged
- `resizing` — active resize operation metadata

**External state (from hooks):**
- `cells` from `useGridSync` — the RTDB-synced cell data map
- `activeUsers` from `usePresence` — other users' cursor positions

**Key rendering logic:**
- Each cell renders an `<input>` element. In non-edit mode, `readOnly` is set and `value` is the formula result. In edit mode, `value` is the raw formula string.
- Cell backgrounds come from `cells[cellId]?.backgroundColor`.
- Remote user presences are rendered as absolutely-positioned colored `<div>` borders stacked over the cell.
- Selection highlights are also absolutely-positioned `<div>`s layered via `z-index`.

---

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
