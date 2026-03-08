# Architecture Deep Dive

> **Back to** [README](../README.md)

---

## Table of Contents
- [System Overview](#system-overview)
- [The Dual-Firebase Split](#the-dual-firebase-split)
- [Data Model](#data-model)
- [Server / Client Boundary](#server--client-boundary)
- [Next.js App Router Patterns](#nextjs-app-router-patterns)
- [Real-Time Data Flow](#real-time-data-flow)
- [Presence System](#presence-system)
- [Component Tree](#component-tree)
- [Hook Architecture](#hook-architecture)

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌─────────────┐    ┌───────────────────────────────┐  │
│  │  Dashboard  │    │       Sheet Editor            │  │
│  │  /          │    │       /sheet/[id]             │  │
│  │             │    │                               │  │
│  │  useAuth    │    │  useAuth  useDocument         │  │
│  │  useDocuments    │  useGridSync  usePresence     │  │
│  └──────┬──────┘    └──────────────┬────────────────┘  │
│         │                          │                    │
└─────────┼──────────────────────────┼────────────────────┘
          │                          │
    ┌─────▼──────────────────────────▼──────┐
    │              Firebase SDK             │
    │  (runs entirely in the browser)       │
    └──────────────┬────────────────────────┘
                   │
      ┌────────────┴────────────┐
      │                         │
┌─────▼──────┐          ┌───────▼──────┐
│ Firestore  │          │     RTDB     │
│            │          │              │
│ Document   │          │ Cell values  │
│ metadata   │          │ Formatting   │
│ Titles     │          │ Presence     │
│ Ownership  │          │ Cursors      │
│ Timestamps │          │              │
└────────────┘          └──────────────┘
```

---

## The Dual-Firebase Split

SheetsLite intentionally uses **two different Firebase products** for different responsibilities. This is not an accident — each database is chosen for what it is genuinely good at.

### Firestore — Document Metadata

| What | Where |
|------|-------|
| Collection | `spreadsheets` |
| Documents | One per spreadsheet |
| Fields | `title`, `ownerId`, `createdAt`, `updatedAt` |

Firestore is used for **slow-moving, structured, query-able metadata**. The dashboard shows all documents owned by the current user, sorted by `updatedAt`. Firestore handles this trivially with a compound index query:

```
collection("spreadsheets")
  .where("ownerId", "==", uid)
  .orderBy("updatedAt", "desc")
```

This type of filtered, ordered query is a first-class feature in Firestore and would be painful to replicate in RTDB.

**Why not Firestore for cells?** Firestore is document-oriented — you'd need one Firestore document per cell (expensive reads), or one giant document per spreadsheet (document size limits, no partial updates, 1-second write-per-document throttle). Neither works for real-time collaborative edits where dozens of cells change per second.

---

### RTDB — Cells and Presence

| What | Path |
|------|------|
| Cell values | `documents/{docId}/cells/{cellId}/value` |
| Cell formatting | `documents/{docId}/cells/{cellId}/{field}` |
| Presence | `documents/{docId}/presence/{uid}` |

RTDB is a **single JSON tree** that supports:

- **Sub-tree listeners** — `onValue(ref(rtdb, 'documents/{id}/cells'))` streams only that spreadsheet's cells, not the entire database.
- **Atomic multi-path updates** — `update(ref, { "A1/value": "foo", "A1/bold": true, "B3/value": "bar" })` applies to three separate locations in one round trip. This is essential for batch formatting.
- **`onDisconnect` hooks** — a server-side instruction to "remove this path if the client disconnects," which powers automatic presence cleanup. Firestore has no equivalent.
- **Sub-millisecond latency** — RTDB is optimized for high-frequency, low-payload writes, not complex queries.

---

## Data Model

### Firestore Schema

```
spreadsheets/
  {docId}:
    title:     "Q4 Budget"
    ownerId:   "uid_abc123"
    createdAt: Timestamp
    updatedAt: Timestamp
```

### RTDB Schema

```
documents/
  {docId}/
    cells/
      A1:
        value:          "=SUM(A2:A5)"
        computedValue:  42            ← not stored; computed client-side
        bold:           true
        italic:         false
        textColor:      "#1a1a1a"
        backgroundColor: "#ffffff"
        fontFamily:     "monospace"
        lastModifiedBy: "uid_abc123"
        timestamp:      1709900000000

    presence/
      {uid}:
        uid:          "uid_abc123"
        displayName:  "Alice"
        cursorColor:  "#FF0000"
        activeCellId: "B4"
        lastActive:   1709900000000
```

> **Note:** `computedValue` is intentionally never persisted. Formula results are always computed on the client from the raw `value` string. Storing derived data would create consistency problems since any upstream cell change would require re-computing and re-saving all downstream cells.

---

## Server / Client Boundary

SheetsLite is deliberately **a fully client-rendered application** hosted on Next.js. There are no API routes, no Server Actions, and no server-side data fetching.

```
layout.tsx          ← Server Component ✅
  │                    (Renders HTML shell, exports Metadata, uses next/font)
  │
  ├── page.tsx      ← "use client" ❌ (needs hooks, Firebase Auth)
  │
  └── sheet/
        [id]/
          page.tsx  ← "use client" ❌ (needs useParams, useAuth, RTDB listeners)
```

### Why everything is a Client Component

Every page needs to:

1. **Subscribe to Firebase Auth state** (`onAuthStateChanged`) — a browser-side persistent connection.
2. **Subscribe to RTDB** (`onValue`) — a WebSocket-based persistent connection to Firebase's servers.
3. **Use React hooks** (`useState`, `useEffect`, `useCallback`) — not available in Server Components.

Pushing any of this to the server would mean:
- Fetching data once (no live updates)
- Managing WebSocket connections inside a serverless function (impossible)
- Shipping auth tokens to the server for every request (unnecessary complexity)

The only true Server Component is `layout.tsx`, which handles static concerns: `<html>`, `<body>`, font loading, and the `metadata` export for SEO.

---

## Next.js App Router Patterns

### File-Based Routing

```
src/app/
  layout.tsx          →  Shared shell for all routes
  page.tsx            →  Route: /
  sheet/
    [id]/
      page.tsx        →  Route: /sheet/:id   (dynamic segment)
```

### Dynamic Route Parameter Reading

```tsx
// sheet/[id]/page.tsx
const params = useParams();
const docId = params.id as string;  // Extracted from URL
```

### Programmatic Navigation

```tsx
const router = useRouter();
router.push(`/sheet/${newDocId}`);  // After creating a document
router.push("/");                   // On route protection failure
```

### Metadata (Server Component only)

```tsx
// layout.tsx — no "use client"
export const metadata: Metadata = {
  title: "SheetsLite",
  description: "A real-time collaborative spreadsheet",
};
```

### Route Protection Pattern

```tsx
// sheet/[id]/page.tsx
useEffect(() => {
  if (!authLoading && !user) {
    router.push("/");   // Redirect unauthenticated users
  }
}, [user, authLoading, router]);
```

---

## Real-Time Data Flow

### Write Path (User edits a cell)

```
User types in cell input
        │
        ▼
onChange() fires → updateCell(cellId, value)
        │
        ├──► Optimistic local state update (instant UI)
        │    setCells(prev => ({ ...prev, [cellId]: { value } }))
        │
        └──► RTDB write (async)
             update(ref(rtdb, `documents/${docId}/cells`), {
               "A1/value": "hello",
               "A1/lastModifiedBy": uid,
               "A1/timestamp": Date.now()
             })
                    │
                    ▼
             RTDB propagates to ALL connected clients
                    │
                    ▼
             onValue() fires on every client
                    │
                    ▼
             setCells(snapshot.val())  →  React re-render
```

### Read Path (Another user edits a cell)

```
Remote user writes to RTDB
        │
        ▼
RTDB pushes delta to local client over WebSocket
        │
        ▼
onValue(cellsRef, handler) fires
        │
        ▼
setCells(snapshot.val())
        │
        ▼
Grid re-renders affected cells
        │
        ▼
evaluateFormula() runs for any cell that starts with "="
(uses the now-updated cells Record as the dependency graph)
```

### Sync State Machine

```
'synced' ──► User types ──► 'syncing' ──► RTDB ack ──► 'synced'
                                     └──► Error  ──► 'error'
```

Sync state is lifted from `useGridSync` up through `Grid` → `SpreadsheetEditor` → `Toolbar`, where it's rendered as a visual indicator.

---

## Presence System

The presence system uses RTDB exclusively and leverages a critical Firebase feature: **`onDisconnect`**.

```
User opens /sheet/[id]
        │
        ▼
usePresence() runs
        │
        ├──► set(presenceRef, { uid, displayName, cursorColor, activeCellId: null })
        │    Writes user entry under documents/{docId}/presence/{uid}
        │
        ├──► onDisconnect(presenceRef).remove()
        │    Registers a server-side instruction:
        │    "If this client's connection drops, delete this path"
        │
        └──► onValue(roomRef, handler)
             Subscribes to all users in the room
             Updates activeUsers state → re-renders avatars + cell borders

User clicks a cell
        │
        ▼
updateCursor(cellId) → set activeCellId in RTDB
        │
        ▼
Every other client sees the update via onValue
        │
        ▼
Grid renders colored border on that cell for the remote user
```

**Why `onDisconnect` matters:** If a user closes their browser tab abruptly (no `beforeunload`, no cleanup), the TCP connection to Firebase is eventually detected as dead (within ~60s). At that point, Firebase's servers execute the pre-registered `onDisconnect` command and remove the user's presence entry. The other clients see this via `onValue` and remove the avatar automatically. No polling, no stale presence data.

---

## Component Tree

```
RootLayout (Server Component)
└── Dashboard / SpreadsheetEditor (Client Components)

SpreadsheetEditor
├── Toolbar
│   ├── Back button → router.push("/")
│   ├── FileSpreadsheet icon + editable title (→ Firestore)
│   ├── Presence avatars (→ usePresence → RTDB)
│   ├── Sync state indicator (← syncState prop)
│   ├── Share button (clipboard)
│   └── Export dropdown (CSV / TSV / JSON → RTDB read → blob download)
│
└── Grid
    ├── Formatting toolbar (Bold, Italic, Font, Text Color, Fill Color)
    └── Spreadsheet table (26 cols × 100 rows)
        ├── Column headers (sticky, drag-to-reorder, click-to-select-column)
        ├── Row numbers (sticky, click-to-select-row, drag-to-resize)
        └── Cell inputs
            ├── Displays: evaluateFormula(rawValue, cells)
            ├── Editing: shows raw formula string
            ├── Remote presence border (colored by user)
            └── Selection highlight (blue range overlay)
```

---

## Hook Architecture

Each hook encapsulates a single responsibility:

| Hook | Responsibility | Firebase product |
|------|---------------|-----------------|
| `useAuth` | Auth state, Google sign-in, sign-out | Firebase Auth |
| `useDocuments` | List + create spreadsheets | Firestore |
| `useDocument` | Single doc metadata + title update | Firestore |
| `useGridSync` | Cell read/write + batch formatting | RTDB |
| `usePresence` | User cursors, active cell broadcast | RTDB |

**Data flows down, events flow up.** All hooks return reactive state — React re-renders are triggered by Firebase subscriptions inside each hook's `useEffect`. Components never talk to Firebase directly; they consume hook APIs.
