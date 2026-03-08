# Features Reference

> **Back to** [README](../README.md)

---

## Table of Contents
- [Authentication](#authentication)
- [Document Management](#document-management)
- [The Grid](#the-grid)
- [Cell Editing](#cell-editing)
- [Formula Engine](#formula-engine)
- [Cell Formatting](#cell-formatting)
- [Real-Time Collaboration](#real-time-collaboration)
- [Export](#export)
- [Toolbar and UI Shell](#toolbar-and-ui-shell)
- [Features Intentionally Not Included](#features-intentionally-not-included)

---

## Authentication

| Feature | Details |
|---------|---------|
| **Provider** | Google OAuth via Firebase Auth |
| **Sign-in flow** | `signInWithPopup` — a standard Google OAuth popup |
| **Session persistence** | Firebase SDK handles token refresh automatically |
| **Route protection** | `/sheet/[id]` redirects unauthenticated users to `/` |
| **User identity** | `uid`, `displayName`, `email`, `photoURL` from Google profile |
| **Presence color** | A random color from a palette is assigned per session for cursor identification |

---

## Document Management

### Dashboard (`/`)

- Lists all spreadsheets owned by the signed-in user, ordered by most recently modified.
- Real-time: the list updates instantly if a document title changes in another tab.
- Shows a thumbnail placeholder and the last-modified date for each document.

### Create

- "Blank Spreadsheet" button creates a new Firestore document with title `"Untitled Spreadsheet"` and redirects to `/sheet/{newDocId}`.

### Editable Title

- Clicking the title in the editor toolbar makes it editable in-place.
- On blur (clicking away), the new title is saved to Firestore via `updateDoc`.
- The dashboard list updates in real time because it's subscribed to Firestore snapshots.

---

## The Grid

The grid is a **26-column × 100-row** spreadsheet (columns A–Z, rows 1–100), rendered as an HTML `<table>` with frozen headers.

### Frozen Headers

- Column headers (A, B, C…) are `position: sticky; top: 0` — always visible when scrolling down.
- Row numbers (1, 2, 3…) are `position: sticky; left: 0` — always visible when scrolling right.
- The top-left origin cell is `position: sticky; top: 0; left: 0; z-index: 40` — frozen in the corner.

### Column Resize

Drag the right edge of any column header to resize that column. The resize handle is a `2px` wide hit target that expands visibly on hover. Minimum column width: `50px`.

### Row Resize

Drag the bottom edge of any row number to resize that row. Minimum row height: `32px`.

### Column Reorder

Drag-and-drop column headers to reorder columns. The dragged column becomes semi-transparent while dragging. Column reorder is a local display preference and is **not synced** across users.

### Full-Row / Full-Column Selection

- Click a column header → selects the entire column (all 100 rows in that column).
- Click a row number → selects the entire row (all 26 columns in that row).

---

## Cell Editing

### Single-Cell Edit

- **Single click**: selects a cell, updates the cursor broadcast, and shows the cell as "focused" with a blue border.
- **Double-click**: enters edit mode. The input shows the raw formula string (e.g., `=SUM(A1:A5)`) instead of the computed value.
- **Blur (click away)**: exits edit mode. The cell switches back to showing the computed value.

### Range Selection

- **Click and drag**: selects a rectangular range of cells. The selection is rendered as a blue-tinted overlay with a blue border on the anchor cell.
- **Click a column header**: selects all cells in that column.
- **Click a row number**: selects all cells in that row.

Range selections are used for batch formatting — applying Bold to a 10-cell selection writes to all 10 cells in one RTDB `update()` call.

---

## Formula Engine

The formula engine lives in `lib/formula.ts` and runs entirely in the browser.

### Supported Syntax

```
Literal values
  42          → number
  hello       → string (not a formula)

Cell references
  =A1         → value of cell A1
  =A1+B2      → arithmetic with two cells

Arithmetic
  =A1+B2-C3   → addition, subtraction
  =A1*B2      → multiplication
  =A1/B2      → division
  =(A1+B2)*C3 → parentheses

SUM function
  =SUM(A1:A5)         → sum a contiguous range
  =SUM(A1:C3)         → sum a 2D range
  =SUM(A1, B2, C3)    → sum individual cells
  =SUM(A1:A3, B5, 10) → mix of ranges, cells, and literals

Error values
  #CYCLE!     → circular reference detected
  #ERROR!     → any other evaluation failure (division by zero, etc.)
```

### How Cycle Detection Works

Every evaluation call carries a `visited: Set<string>` of cell IDs currently on the call stack. Before evaluating a referenced cell, the engine checks if that cell is already in `visited`. If so, it throws `#CYCLE!` immediately, unwinding the call stack cleanly.

```
A1 = "=B1"
B1 = "=A1"

evaluateFormula("=B1", cells)
  → getCellValue("B1", cells, visited={"A1"})
    → evaluateFormula("=A1", cells, visited={"A1"})
      → getCellValue("A1", cells, visited={"A1", "B1"})
        → "A1" is in visited → throw "#CYCLE!"
```

---

## Cell Formatting

All formatting is stored in RTDB alongside the cell value and is synced in real time to all collaborators.

| Property | Type | Effect |
|----------|------|--------|
| `bold` | `boolean` | `font-weight: bold` |
| `italic` | `boolean` | `font-style: italic` |
| `textColor` | `string` (hex) | `color: #rrggbb` |
| `backgroundColor` | `string` (hex) | `background-color: #rrggbb` |
| `fontFamily` | `string` | `font-family: sans-serif \| serif \| monospace` |

### Formatting Toolbar

The formatting controls are embedded at the top of the grid:

- **Bold** button — toggles bold for all selected cells
- **Italic** button — toggles italic for all selected cells
- **Font family** dropdown — Sans Serif / Serif / Monospace
- **Text color picker** — native `<input type="color">`
- **Fill color picker** — native `<input type="color">`

All formatting operations use **optimistic UI** — local state is updated immediately, then the RTDB write happens asynchronously. The sync state indicator reflects the write status.

### Batch Formatting

Selecting a range and clicking Bold sends a single RTDB `update()` call with all selected cell IDs, which is atomic and efficient.

---

## Real-Time Collaboration

### Presence Avatars

Every user currently viewing a document appears as a colored avatar in the toolbar. The avatar shows the first letter of the user's display name. Hovering over an avatar shows the full name in a tooltip.

### Live Cell Cursors

When a user clicks a cell, a colored border appears around that cell for all other collaborators. The border color matches the user's avatar color. This allows multiple users to see exactly which cells their collaborators are working in.

### Automatic Disconnect Cleanup

When a user closes their browser tab, navigates away, or loses their internet connection, their presence entry is automatically removed from RTDB. This is handled by Firebase's `onDisconnect` server-side hook — no polling required.

### Conflict Resolution

When two users write to different cells simultaneously, there is no conflict. When they write to the **same cell** simultaneously, the write with the higher `timestamp` wins (last write wins). The `lastModifiedBy` field records who made the most recent change.

---

## Export

Access the Export menu via the Export button in the toolbar.

### CSV (`.csv`)

Standard comma-separated format. Compatible with Microsoft Excel, Google Sheets, Apple Numbers, and any data tool. Special characters (commas, quotes, newlines) in cell values are properly escaped per RFC 4180.

### TSV (`.tsv`)

Tab-separated values. Preferred for data pipelines, shell scripts, and tools where values might contain commas. Same escaping rules as CSV but with tabs as separators.

### JSON (`.json`)

Exports the non-empty cells as a JSON object keyed by cell ID:

```json
{
  "A1": "Name",
  "B1": "Score",
  "A2": "Alice",
  "B2": "95",
  "A3": "Bob",
  "B3": "=SUM(A2:A2)"
}
```

Note: JSON export stores raw formula strings, not computed values. This allows the data to be re-imported into a formula-aware tool without losing formula intent.

### How Export Works

Export reads directly from RTDB (`get(ref(rtdb, ...))`) — a one-time fetch, not a live subscription. The data is converted to the target format in memory, wrapped in a `Blob`, and triggered as a browser download via a temporary `<a>` element click.

---

## Toolbar and UI Shell

### Sync State Indicator

| State | Icon | Text |
|-------|------|------|
| `synced` | ☁ (green) | Saved to cloud |
| `syncing` | ↻ (spinning blue) | Saving... |
| `error` | ✕ (red) | Offline |

Sync state originates in `useGridSync`, is lifted as a prop through `Grid` → `SpreadsheetEditor` → `Toolbar`.

### Share Button

Copies the current page URL to the clipboard. The button briefly switches to a green "Link Copied!" state for 2 seconds to confirm the action.

Any user who opens the URL and is signed in can view and edit the spreadsheet in real time.

> **Note:** There is currently no role-based access control. Anyone with the URL and a Google account can edit. This is by design for a collaborative prototype — production hardening would add permission scopes.

---

## Features Intentionally Not Included

These features were evaluated and deliberately excluded. See [Design Decisions](./design-decisions.md) for the full reasoning behind the three most significant choices.

| Feature | Why excluded |
|---------|-------------|
| **Undo / Redo** | CRDT undo in a multi-user context creates semantic ambiguity and sync instability. Last-write-wins is more predictable. See [Design Decision 3](./design-decisions.md#decision-3-no-crdt--last-write-wins-for-sync-stability). |
| **Server-side formula evaluation** | Would add 100–400ms latency per keystroke. The client always has the full cell state via RTDB. See [Design Decision 2](./design-decisions.md#decision-2-client-side-formula-evaluation). |
| **Row sorting / filtering** | Adds significant state management complexity (sort order, filter state) without a clear sync story for collaborative mode. |
| **Cell merge** | Merged cells break the simple row×column coordinate model and complicate range selection, formula resolution, and export. |
| **More formula functions** | `AVERAGE`, `MAX`, `MIN`, `IF`, `VLOOKUP`, etc. are not implemented. The engine is extensible — these can be added to `lib/formula.ts`. |
| **Comment / annotation system** | Would require a separate Firestore sub-collection with threaded replies — a significant feature scope. |
| **Version history** | Requires storing write logs, not just current state. RTDB is not designed for this; it would need Firestore. |
| **Permission/share settings** | No read-only or comment-only modes. Currently, having the URL gives full edit access. |
| **Offline mode / local persistence** | No IndexedDB or service worker. The app requires a live internet connection. |
| **Mobile / touch support** | The grid relies on mouse events (`onMouseDown`, `onMouseEnter`). Touch events are not handled. |
| **Infinite / virtual grid** | The grid renders all 2,600 cells at once. Virtual scrolling (only rendering visible rows) would improve performance for large datasets. |
