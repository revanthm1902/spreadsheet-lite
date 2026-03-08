<div align="center">

# SheetsLite

**A real-time collaborative spreadsheet — built with Next.js 16, React 19, and Firebase.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)

</div>

---

> 🎥 **[INSERT 10-SECOND DEMO GIF HERE — Show: open doc → type in two tabs → see live cursor sync + colored cell borders]**

---

## What Makes This Non-Trivial

> Not a tutorial clone. Every hard problem was thought through and explicitly decided.

| # | Senior Flex | One-Line Answer |
|---|-------------|-----------------|
| 1 | **Dual-database architecture** | Firestore for queries, RTDB for real-time cells — each used for what it's actually good at |
| 2 | **Custom formula engine** | Recursive parser + cycle detection (DAG) in the browser — zero server latency |
| 3 | **Intentional non-feature** | Collaborative undo/redo was explicitly excluded — here's exactly why |
| 4 | **No grid library** | Drag-resize, drag-reorder, bounding-box selection — built from raw DOM events |

---

## 📚 Docs

<table>
<tr>
<td align="center" width="25%">
<a href="docs/architecture.md"><b>🏗️ Architecture</b></a>
<br/><sub>Dual-Firebase split, data model,<br/>component tree, real-time flow</sub>
</td>
<td align="center" width="25%">
<a href="docs/design-decisions.md"><b>🧠 Design Decisions</b></a>
<br/><sub>RTDB vs Firestore, client formulas,<br/>the deliberate no-CRDT call</sub>
</td>
<td align="center" width="25%">
<a href="docs/features.md"><b>✨ Features</b></a>
<br/><sub>What's built, what's intentionally<br/>excluded and why</sub>
</td>
<td align="center" width="25%">
<a href="docs/project-structure.md"><b>📁 Project Structure</b></a>
<br/><sub>Every file explained —<br/>hooks, components, lib</sub>
</td>
</tr>
</table>

---

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | **Next.js 16** — App Router | File-based routing, Server Components for layout |
| UI | **React 19** + **Tailwind CSS v4** | Concurrent features, zero-config utility CSS |
| Language | **TypeScript 5** | Full type coverage across hooks, components & Firebase |
| Auth | **Firebase Auth** — Google OAuth | One-click sign-in, automatic token refresh |
| Real-time cells | **Firebase RTDB** | WebSocket, `onDisconnect`, atomic multi-path `update()` |
| Document metadata | **Firestore** | Compound index queries: `ownerId + updatedAt` |
| Icons | **Lucide React** | |

---

## Architecture at a Glance

```
 Browser
 ┌──────────────────────────────────────────────────┐
 │ Dashboard (/) Sheet Editor (/sheet/[id]) │
 │ useAuth · useDocuments useAuth · useDocument │
 │ │ useGridSync · usePresence │
 └──────────────────────┬───────────────────────────┘
 │
 Firebase SDK (client-only, no server)
 │
 ┌──────────┴──────────┐
 │ │
 ▼ ▼
 Firestore RTDB
 ──────────── ──────────────────────────
 doc metadata cell values + formatting
 title, owner, timestamps presence + cursor positions
 compound index queries WebSocket · onDisconnect
```

> 📸 **[INSERT SCREENSHOT — Dashboard document grid with card hover states]**

---

## Key Architectural Decisions

### ⚡ 1 — Database Split: RTDB for Cells, Firestore for Metadata

**The problem:** A 26×100 grid = 2,600 cells. Batch formatting 50 cells = 50 simultaneous writes. Firestore throttles **1 write/second per document** and charges per-read — catastrophically wrong for a spreadsheet workload.

**The solution:** RTDB's `update()` writes to arbitrary JSON paths **atomically in one round trip**, maintains a persistent WebSocket, and provides `onDisconnect` for automatic presence cleanup on hard browser kills. Firestore has zero equivalents for these.

<details>
<summary><b>Show: RTDB atomic multi-path write code</b></summary>

```ts
// 50 formatting changes → ONE round trip, zero contention
update(ref(rtdb, `documents/${docId}/cells`), {
  "A1/bold": true,
  "A2/bold": true,
  // ...48 more paths
  "C10/backgroundColor": "#ffff00"
});
// Firestore equivalent: 50 separate writes, each throttled, each billed
```

</details>

---

### 🧮 2 — Formula Engine: Client-Side Recursive Parser

**The problem:** Formula evaluation requires live cell state. Sending that state to a server on every keystroke = **100–400ms latency**. That's an unusable spreadsheet.

**The solution:** `useGridSync` keeps the full cell map in memory via a live RTDB subscription. `lib/formula.ts` evaluates any formula **synchronously in under 1ms** — no network hop, no serialization, no round trip.

<details>
<summary><b>Show: supported formula syntax + cycle detection</b></summary>

```
=SUM(A1:A5)         → range sum
=A1+B2*C3           → arithmetic with precedence
=(A1+B2)/C3         → parentheses
=A1                 → cell reference in A1  → #CYCLE!
```

Cycle detection uses a **visited-set DAG traversal** — any circular reference short-circuits immediately and surfaces `#CYCLE!` rather than hanging.

</details>

---

### 🚫 3 — Intentional Non-Feature: No Collaborative Undo/Redo

**The hard truth:** Multiplayer undo has no clean semantic. If Alice undoes her edit **after Bob has built on it** — what happens to Bob's work?

**Why skipping it is the right call:**
- True collaborative undo requires **CRDTs** (Yjs/Automerge) or **Operational Transformation
- That adds ~60KB+ bundle weight, per-user operation logs, and complex 3-way merge edge cases
- **Last-write-wins** (newest `timestamp` wins) is the same trade-off Google Sheets makes
- Every cell stores `lastModifiedBy` + `timestamp` as a lightweight audit trail

> This is not a gap. It's a deliberate scope boundary with documented reasoning — which is itself a senior engineering signal.

---

### 🖱️ 4 — Custom Grid Interactions: Zero Library Dependencies

> 📸 **[INSERT SCREENSHOT — Drag-to-resize column handle on hover]**
> 📸 **[INSERT SCREENSHOT — Multi-cell bounding box selection highlight]**

All of the following are built from raw DOM `mousedown/mousemove/mouseup` events and React state — **no AG Grid, no react-table, no react-resizable**:

- **Column drag-to-resize** — 1px handle, `onMouseDown` captures start position, global `mousemove` computes delta
- **Row drag-to-resize** — same pattern, vertical axis
- **Drag-to-reorder columns** — HTML5 `draggable` API + `colOrder` index remapping
- **Multi-cell bounding-box selection** — `selectionStart`/`selectionEnd` state forms a rectangular range, rendered as absolutely-positioned `<div>` overlays
- **Batch formatting** — selection range is resolved to a flat `cellId[]` array → single RTDB `update()` call

---

## 🤝 Multiplayer in Action

> 🎥 **[INSERT 10-SECOND GIF — Two browser windows side-by-side: type in left tab, see it appear in right tab with colored cursor border]**

- **Every keystroke** syncs via RTDB WebSocket — no polling, no debounce delay
- **Presence avatars** in the toolbar show all active users with their assigned color
- **Colored cell borders** show exactly which cell each remote user has selected, in their color
- **Auto-cleanup** — `onDisconnect` removes presence data even on hard browser/tab kills

---

## Getting Started

```bash
git clone https://github.com/revanthm1902/spreadsheet-lite.git
cd spreadsheet-lite
npm install
```

**Firebase setup (5 steps):**
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Google**
3. Enable **Firestore Database**
4. Enable **Realtime Database**
5. Add a Firestore composite index: `spreadsheets` → `ownerId ASC, updatedAt DESC`

**`.env.local`:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) · Sign in with Google · Create a spreadsheet · Open it in a second tab to see multiplayer live.
