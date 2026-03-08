# Design Decisions

> **Back to** [README](../README.md)

---

## Table of Contents
- [Decision 1: RTDB over Firestore for Cell Data](#decision-1-rtdb-over-firestore-for-cell-data)
- [Decision 2: Client-Side Formula Evaluation](#decision-2-client-side-formula-evaluation)
- [Decision 3: No CRDT — Last Write Wins for Sync Stability](#decision-3-no-crdt--last-write-wins-for-sync-stability)
- [Other Deliberate Choices](#other-deliberate-choices)

---

## Decision 1: RTDB over Firestore for Cell Data

### The question

Both Firebase Realtime Database (RTDB) and Firestore are real-time databases with client-side SDKs and live subscription support. Why use RTDB for cells?

### What a spreadsheet does under the hood

A 26-column × 100-row grid has **2,600 addressable cells**. In a collaborative session:

- A user might type quickly and produce a write **per keystroke** — potentially 5–10 writes/second.
- Batch formatting (selecting 50 cells and clicking Bold) produces **50 simultaneous writes**.
- Presence (tracking cursor position) produces a write on **every cell click**.

This is a fundamentally different workload from a typical app.

### Why Firestore fails here

| Problem | Details |
|---------|---------|
| **1-write-per-second limit per document** | Firestore throttles writes to a single document at 1/s. A spreadsheet needs far more throughput than that. |
| **No sub-document listeners** | You can't listen to a single field. A Firestore `onSnapshot` delivers the whole document on any change. |
| **Cost model** | Firestore charges per document read. Loading a 100-row grid where every cell is its own document = 2,600 reads on open. |
| **No atomic multi-path writes** | Firestore has transactions and batches, but they lock documents. RTDB's `update()` applies to arbitrary JSON paths atomically with no locking. |
| **No `onDisconnect`** | Firestore has no server-side disconnect hook. Implementing presence cleanup requires Cloud Functions or polling — adding latency and cost. |

### Why RTDB wins here

```
RTDB write for a single cell:
  update(ref(rtdb, `documents/${docId}/cells`), {
    "A1/value": "42",
    "A1/bold": true,
    "B5/value": "hello",
    "C10/backgroundColor": "#ffff00"
  })
  → One round trip. Four separate paths. Atomic. No locking.
```

- **Flat JSON tree** — cells are just paths. No schema, no collections, no document limits.
- **Persistent WebSocket** — RTDB maintains a single socket connection and pushes binary deltas. Firestore uses gRPC streams which are heavier to establish.
- **`onDisconnect` is a superpower** — register a server-side cleanup before anything goes wrong, so presence is auto-removed even on hard browser kills.
- **Sub-tree subscriptions** — `onValue(ref(rtdb, 'documents/abc/cells'))` only streams cell data for that document. Nothing else.

### The right tool for each job

```
Firestore:  "Find all spreadsheets owned by user X, sorted by last modified"
             → Indexed query, structured data, infrequent writes. ✅

RTDB:       "Sync 50 cell values in real time across 5 browser tabs"
             → High-frequency writes, flat data, persistent connections. ✅
```

---

## Decision 2: Client-Side Formula Evaluation

### The question

Why does `lib/formula.ts` run in the browser? Couldn't a server evaluate formulas more reliably?

### How formula evaluation works

Every cell with a `value` starting with `=` is a formula. Evaluating it requires:

1. **Parsing** the formula string (`=SUM(A1:B3)`, `=A1+A2*2`)
2. **Resolving cell references** — looking up the current values of referenced cells
3. **Expanding ranges** — turning `A1:B3` into `["A1", "A2", "A3", "B1", "B2", "B3"]`
4. **Detecting cycles** — `=A1` in A1 itself must return `#CYCLE!`, not an infinite loop
5. **Computing the result**

Step 2 is the critical one: **formula evaluation depends on the current state of all referenced cells.**

### Why the server is the wrong place

```
Server-side evaluation would require:

User types "=SUM(A1:A5)" in B1
          │
          ▼
Send entire cells Record to the server:
{ A1: { value: "10" }, A2: { value: "20" }, ..., A100: { value: "" } }
          │
          ▼ (network round trip: ~50–200ms)
          │
Server evaluates SUM(A1:A5) = 30
          │
          ▼ (another network round trip)
          │
Client displays "30"
```

Total latency per keystroke: **100–400ms**. That's unusably slow for an interactive spreadsheet.

### Why the client is the right place

```
Client-side evaluation:

User types "=SUM(A1:A5)" in B1
          │
          ▼
cells state is already in memory (synced from RTDB)
          │
          ▼ (zero network calls)
          │
evaluateFormula("=SUM(A1:A5)", cells) = 30
          │
          ▼ (immediate)
          │
React re-renders cell with "30"
```

Total latency: **< 1ms**.

The client **always has the full current cell state** because `useGridSync` maintains a `cells: Record<string, CellData>` that is kept in sync with RTDB via `onValue`. Formula evaluation is a pure function over this in-memory state — no network calls required.

### The formula engine

```typescript
// lib/formula.ts

evaluateFormula(formula, cells, visited?)
  → string | number

// Supports:
=SUM(A1:A5)          → sum a range
=SUM(A1, B2, 5)      → sum individual values + literals
=A1+B2*C3            → arbitrary arithmetic with cell refs
=A1                  → simple cell reference
42, "hello"          → passthrough for non-formulas
#CYCLE!              → circular reference detection via visited Set
#ERROR!              → any other evaluation failure
```

The cycle detection uses a `visited: Set<string>` passed through recursive calls. When `getCellValue("A1")` is called and A1's formula references A1 again, the visited set catches it before the call stack explodes.

### Why not a formula library?

A dedicated library (like HyperFormula or formulajs) would add significant bundle weight and support hundreds of functions the app doesn't need. The custom engine covers the required formula set in ~100 lines of TypeScript with zero dependencies.

---

## Decision 3: No CRDT — Last Write Wins for Sync Stability

### The question

Full collaborative editors like Notion or Figma use CRDTs (Conflict-free Replicated Data Types) or Operational Transforms (OT) to merge concurrent edits without conflicts. Why doesn't SheetsLite?

### What CRDTs solve

In a text editor, if Alice types "Hello" and Bob types "World" simultaneously at the same cursor position, a naive "last write wins" produces either "Hello" or "World" — one user's work is destroyed. CRDTs (like Yjs or Automerge) define an algebraic merge function that produces "HelloWorld" every time, regardless of arrival order.

### Why CRDTs are overkill for cells

**A spreadsheet cell is not a text document.** It has a single value — `"42"`, `"=SUM(A1:A5)"`, or `"Revenue Q4"`. When two users edit the **same cell** simultaneously:

- Alice sets A1 to `"100"`
- Bob sets A1 to `"200"`

There is no meaningful merge. The cell can only contain one value. The correct outcome is one of them. Last write wins (determined by `timestamp`) is semantically correct behavior here — the most recent intent wins.

**Concurrent edits to the same cell are rare.** The presence system shows colored borders on cells that other users are currently in. This social signal naturally prevents two users from typing in the same cell at the same time.

### Why CRDT Undo/Redo specifically was skipped

CRDT-based undo in a collaborative context opens a Pandora's box:

**Scenario:** Alice and Bob are both editing.
- Alice types "dogs" in A1 → A1 = "dogs"
- Bob types "cats" in A1 → A1 = "cats"
- Alice hits Ctrl+Z (undo)

What does undo mean here?
- **Option A:** Undo Alice's last action → A1 = "" (but this destroys Bob's "cats" edit)
- **Option B:** Undo to before Alice's "dogs" → A1 = "cats" (but only if we track Bob's edit as "not part of Alice's history")
- **Option C:** Alice's undo only applies to Alice's view, not the shared state

Option C requires a full CRDT with per-user operation logs, vector clocks, and a deterministic merge function. This is effectively re-implementing the Yjs library from scratch — a weeks-long engineering effort that adds:

- **Significant bundle size** (Yjs is ~60KB gzipped)
- **Complex state management** — operation history must be stored and replayed
- **Edge cases** — what happens to undo history when a cell is deleted? When the document is closed?
- **Sync fragility** — CRDT merges can produce unexpected results if a client reconnects after a long offline period

### The chosen trade-off

> **Sync stability > Undo in collaborative mode**

The design accepts that undo is not supported in real-time collaborative sessions. This is the same trade-off made by Google Sheets (which also does not support multi-user collaborative undo — Ctrl+Z only undoes *your own* recent changes in the current session, and even then, only until the session ends).

The "last write wins with timestamp" approach is:
- **Predictable**: the newest change always wins, no surprises
- **Stable**: no merge conflicts, no divergent client states
- **Simple**: no additional libraries, no operation log, no replay mechanism

The `lastModifiedBy` and `timestamp` fields on every cell record *who* last touched a cell and *when*, providing an audit trail even without undo.

---

## Other Deliberate Choices

### Optimistic UI updates

When a user edits a cell or applies formatting, the local state is updated **immediately** via `setCells(...)` *before* the RTDB write completes. The UI feels instant. If the write fails, `syncState` flips to `'error'` and the user is notified. A more conservative approach (wait for server confirmation) would introduce visible lag on every keystroke.

### `computedValue` is never persisted

Formulas are evaluated on read, not on write. Persisting computed values would create a consistency problem: if A1 stores `=B1+1`, and B1 changes, you'd need to re-evaluate and re-save A1 in RTDB. This cascades — any cell that references A1 also needs re-saving. By computing on read from the live `cells` state, this problem disappears entirely.

### Column reordering is local state only

Column reorder (`colOrder` state in `Grid.tsx`) is **not synced to RTDB**. Each user's view of column order is independent. This is intentional: column reordering is a display preference, not a data change. Syncing it would add noise to the RTDB writes and create confusing "why did my columns move?" moments for other collaborators.

### No server-side formula validation

Formulas are stored as raw strings. If a user types `=VLOOKUP(A1, B1:C10, 2)` (an unsupported formula), it evaluates to `#ERROR!` on the client. There is no server-side rejection or validation. This keeps the architecture simple — the server (RTDB) is a dumb datastore; all intelligence is on the client.

### Google Sign-In only

The app supports only Google OAuth, not email/password. This eliminates an entire class of security concerns: password storage, reset flows, brute-force protection. Firebase Auth handles the OAuth flow. The only user data stored in Firestore is `ownerId` (the Firebase `uid`), never emails or tokens.
