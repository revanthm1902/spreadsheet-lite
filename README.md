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

SheetsLite is a browser-based collaborative spreadsheet. Multiple users can edit the same document simultaneously — every keystroke, format change, and cursor move appears on all connected screens in real time.

It's a deliberately scoped project. Not a Google Sheets replacement — a clean real-time foundation with every architectural choice documented.

---

## 📚 Docs

<table>
<tr>
<td align="center" width="25%">
<a href="docs/architecture.md">
<br/>
<b>🏗️ Architecture</b>
</a>
<br/><sub>System design, dual-Firebase split,<br/>data flow, component tree</sub>
</td>
<td align="center" width="25%">
<a href="docs/design-decisions.md">
<br/>
<b>🧠 Design Decisions</b>
</a>
<br/><sub>Why RTDB, client formulas,<br/>no CRDT undo — with full reasoning</sub>
</td>
<td align="center" width="25%">
<a href="docs/features.md">
<br/>
<b>✨ Features</b>
</a>
<br/><sub>What's built, what's intentionally<br/>excluded and why</sub>
</td>
<td align="center" width="25%">
<a href="docs/project-structure.md">
<br/>
<b>📁 Project Structure</b>
</a>
<br/><sub>Every file explained —<br/>hooks, components, lib</sub>
</td>
</tr>
</table>

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 — App Router, file-based routing |
| UI | React 19 + Tailwind CSS v4 |
| Language | TypeScript 5 |
| Auth | Firebase Authentication (Google OAuth) |
| Real-time cells | **Firebase Realtime Database** — WebSocket sync, `onDisconnect`, atomic multi-path writes |
| Document metadata | **Firestore** — compound index queries (owner + sort by date) |
| Icons | Lucide React |

---

## Getting Started

```bash
git clone https://github.com/revanthm1902/spreadsheet-lite.git
cd spreadsheet-lite
npm install
```

**Firebase setup:**
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Google**
3. Enable **Firestore Database**
4. Enable **Realtime Database**
5. Add a Firestore composite index: `spreadsheets` collection → `ownerId ASC, updatedAt DESC`

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

---

## Features

**Spreadsheet**
- 26 × 100 grid (A–Z, rows 1–100) with frozen headers
- Formulas: `=SUM(A1:A5)`, cell references, arithmetic, `#CYCLE!` detection
- Cell formatting: Bold, Italic, Font Family, Text Color, Fill Color
- Click-drag range selection, full row/column select, batch formatting
- Column resize, row resize, drag-to-reorder columns

**Collaboration**
- Live cell sync across all connected browsers via RTDB WebSocket
- Presence avatars showing who's in the document
- Colored cell borders showing each user's active cell
- Auto-cleanup when a user disconnects (RTDB `onDisconnect`)

**Documents**
- Google Sign-In, one click
- Dashboard listing all your spreadsheets, sorted by last modified
- Inline title editing, synced to Firestore
- Share button — copies URL to clipboard

**Export**
- CSV (Excel-compatible), TSV, JSON — triggered as browser download

---

## Key Decisions

Three choices most define the architecture. Short version here — full reasoning in [docs/design-decisions.md](docs/design-decisions.md).

### ⚡ RTDB over Firestore for cells

Firestore throttles writes to **1 per second per document** and charges per read. A 26×100 grid = 2,600 cells; a batch format operation touches 50+ paths at once. RTDB's `update()` writes to arbitrary JSON paths atomically in one round trip. Its `onDisconnect` hook automatically removes presence data even on hard browser closes — Firestore has no equivalent.

### 🧮 Formulas run on the client

`useGridSync` keeps the full cell state in memory via a live RTDB subscription. Evaluating `=SUM(A1:A5)` is a synchronous in-memory call — under 1ms. Sending cells to a server for evaluation would add a full network round trip (~100–400ms) on every keystroke, for no benefit.

### 🔒 No CRDT Undo/Redo

Collaborative undo has no clean semantic. If Alice undoes her edit after Bob has built on it, does Bob's work survive? CRDT undo (Yjs/Automerge) resolves this but adds ~60KB+ bundle, per-user operation logs, and complex merge edge cases. We use **last write wins** — the newest `timestamp` wins. Cells store `lastModifiedBy` + `timestamp` as an audit trail. This is the same trade-off Google Sheets makes.
