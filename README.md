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

## What is this?

SheetsLite is a collaborative spreadsheet editor that runs in the browser. Multiple users can edit the same document simultaneously — changes appear on every connected screen in real time. It supports formulas, rich cell formatting, live presence cursors, and one-click export.

It is a deliberately scoped project. It does not try to replace Google Sheets. Instead, it makes opinionated engineering choices to deliver a rock-solid real-time foundation, and it documents those choices explicitly.

---

## Table of Contents

- [Live Demo](#live-demo)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Features at a Glance](#features-at-a-glance)
- [Key Engineering Decisions](#key-engineering-decisions)
  - [Why RTDB over Firestore for cells](#-why-rtdb-over-firestore-for-cells)
  - [Why formulas run on the client](#-why-formulas-run-on-the-client)
  - [Why there is no Undo / Redo](#-why-there-is-no-undo--redo)
- [Architecture Overview](#architecture-overview)
- [Documentation](#documentation)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)

---

## Live Demo

> Start the development server (see [Getting Started](#getting-started)), open two browser tabs, sign in with different Google accounts, and navigate to the same document. Edits, formatting changes, and cursor positions sync instantly across both tabs.

---

## Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Framework** | Next.js 16 (App Router) | File-based routing, React Server Components for the shell, fast builds |
| **UI** | React 19 + Tailwind CSS v4 | Concurrent rendering, utility-first styling |
| **Language** | TypeScript 5 | End-to-end type safety across Firebase data shapes and component props |
| **Auth** | Firebase Authentication | Google OAuth — zero credential storage |
| **Real-time cells** | Firebase Realtime Database | Low-latency WebSocket sync, `onDisconnect`, atomic multi-path writes |
| **Document metadata** | Firestore | Compound index queries (list docs by owner, sorted by date) |
| **Icons** | Lucide React | Consistent, tree-shakeable SVG icons |

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/spreadsheet-pro.git
cd spreadsheet-pro
npm install
```

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project.
2. Enable **Authentication** → Sign-in method → **Google**.
3. Enable **Firestore Database** (production or test mode).
4. Enable **Realtime Database** (start in test mode for development).
5. In Project Settings → Your apps → Web, copy the config object.

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
```

### 4. Set up Firestore indexes

In the Firebase Console, go to Firestore → Indexes → Add composite index:

- Collection: `spreadsheets`
- Fields: `ownerId ASC`, `updatedAt DESC`

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Features at a Glance

### Spreadsheet Core
- **26 columns × 100 rows** — columns A–Z, rows 1–100
- **Formula engine** — `=SUM(A1:A5)`, cell references, arithmetic, cycle detection (`#CYCLE!`)
- **Cell formatting** — Bold, Italic, Font Family, Text Color, Background Color
- **Multi-cell range selection** — click and drag to select a rectangle, then format in bulk
- **Full column / row selection** — click a column header or row number to select all cells
- **Column resize** — drag the right edge of any column header
- **Row resize** — drag the bottom edge of any row number
- **Column reorder** — drag a column header to a new position

### Real-Time Collaboration
- **Live cell sync** — edits appear on all connected screens instantly via RTDB WebSocket
- **Presence avatars** — see who is in the document with colored initials in the toolbar
- **Live cell cursors** — a colored border shows which cell each collaborator is currently in
- **Auto-disconnect cleanup** — presence is removed automatically when a user closes their tab

### Document Management
- **Google Sign-In** — one click, no passwords
- **Dashboard** — lists all your documents, sorted by last modified, updates in real time
- **Editable title** — click the title in the editor to rename; syncs to Firestore
- **Share** — copies the document URL to clipboard; anyone with the link can collaborate

### Data & Export
- **Sync state indicator** — shows "Saving...", "Saved to cloud", or "Offline"
- **Export CSV** — Excel-compatible, RFC 4180 compliant
- **Export TSV** — tab-separated, ideal for data pipelines
- **Export JSON** — `{ "A1": "value", "B2": "=SUM(A1:A1)" }` key-value format

---

## Key Engineering Decisions

Three significant architectural trade-offs define this project. Here is the summary; full reasoning is in [docs/design-decisions.md](docs/design-decisions.md).

### ⚡ Why RTDB over Firestore for cells

> **TL;DR:** Firestore's write throttle (1/sec per document), per-read cost model, and lack of `onDisconnect` make it the wrong tool for spreadsheet cell sync. RTDB's flat JSON tree, atomic multi-path writes, and persistent WebSocket are purpose-built for this use case.

Firestore is excellent at what it does: structured, query-able, strongly-consistent documents. But a spreadsheet under real-time collaborative use can produce **dozens of writes per second** across hundreds of arbitrarily-addressed cells. Firestore's 1-write-per-second per-document limit alone makes it unviable.

RTDB's `update()` method lets us write to 50 different cell paths in a single atomic round trip — essential for batch formatting. Its `onDisconnect()` hook registers a server-side cleanup instruction before anything goes wrong, so presence is cleaned up even when a user's browser crashes.

```
Firestore structure for cells → One document per cell = 2,600 reads on open
                             OR one giant document = 1/sec write limit, no partial updates

RTDB structure for cells    → Flat JSON tree, sub-tree listener, atomic multi-path writes ✅
```

→ [Full analysis: Decision 1 in design-decisions.md](docs/design-decisions.md#decision-1-rtdb-over-firestore-for-cell-data)

---

### 🧮 Why formulas run on the client

> **TL;DR:** The client already has the full cell state in memory (from the RTDB subscription). Server-side evaluation would add 100–400ms latency per keystroke. Formula evaluation is a pure function over in-memory state — it belongs on the device that holds that state.

Every formula like `=SUM(A1:A5)` requires knowing the current values of A1 through A5. Those values are already available in the `cells` state object maintained by `useGridSync`, which is continuously synchronized from RTDB via a WebSocket. Running `evaluateFormula(formula, cells)` is a synchronous in-memory operation that takes under 1ms.

Sending the cell graph to a server for evaluation would:
- Add a full network round trip (50–200ms minimum) on **every keystroke**
- Require the server to have the current state of all cells — duplicating what the client already has
- Create stale evaluation issues if a cell changes while the request is in flight

The formula engine (`lib/formula.ts`) is a self-contained ~100-line TypeScript module with no external dependencies. It supports ranges, arithmetic, cell references, and cycle detection via a `visited: Set<string>` passed through recursive calls.

→ [Full analysis: Decision 2 in design-decisions.md](docs/design-decisions.md#decision-2-client-side-formula-evaluation)

---

### 🔒 Why there is no Undo / Redo

> **TL;DR:** CRDT-based undo in a live collaborative environment creates a semantic problem that has no clean solution: if Alice undoes a change, should it undo Bob's work that followed? We chose sync stability over undo complexity.

Full collaborative undo requires either:
- **Operational Transforms (OT)** — the algorithm behind Google Docs, complex to implement correctly
- **CRDT with per-user operation logs** — the approach of Yjs/Automerge, adds ~60KB+ to the bundle and significant state management complexity

The problem is not the data structure — it is the **semantics**. In a single-user editor, undo is unambiguous: reverse the last operation. In a multi-user editor:

```
Alice sets A1 → "dogs"     (t=1)
Bob sets A1  → "cats"      (t=2)
Alice hits Ctrl+Z          (t=3)

Should A1 become:
  ""     ? (Alice's undo erases Bob's work)  ← Bad
  "cats" ? (requires Alice's history to be   ← Complex
            Bob-aware)
```

There is no universally correct answer. The decision was to use **last write wins** (highest `timestamp` wins on concurrent writes) and omit undo entirely. Every cell stores `lastModifiedBy` and `timestamp`, providing an audit trail. This is the same trade-off made by Google Sheets, which only supports local-session undo and explicitly does not undo other collaborators' changes.

→ [Full analysis: Decision 3 in design-decisions.md](docs/design-decisions.md#decision-3-no-crdt--last-write-wins-for-sync-stability)

---

## Architecture Overview

```
Browser
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Dashboard (/)          Sheet Editor (/sheet/:id)      │
│   ─────────────          ───────────────────────────    │
│   useAuth                useAuth                        │
│   useDocuments           useDocument  (Firestore)       │
│                          useGridSync  (RTDB cells)      │
│                          usePresence  (RTDB presence)   │
│                                                         │
└──────────────────────────┬──────────────────────────────┘
                           │  Firebase SDK (browser)
                 ┌─────────┴──────────┐
                 │                    │
           Firestore               RTDB
           ─────────               ────
           spreadsheets/           documents/
             {docId}:                {docId}/
               title                  cells/{cellId}/
               ownerId                  value, bold, italic
               createdAt               textColor, fontFamily
               updatedAt               lastModifiedBy, timestamp
                                    presence/{uid}/
                                      displayName, cursorColor
                                      activeCellId, lastActive
```

**Server / Client boundary:**
- `layout.tsx` is the only Server Component — it handles the HTML shell, font loading, and SEO metadata.
- Everything else is `"use client"`. Firebase Auth and RTDB require persistent browser connections (WebSocket/persistent token listener) that cannot run in a serverless server component.
- There are no API routes, no Server Actions, no server-side data fetching. All data flows directly from Firebase to the browser.

→ [Full architecture docs](docs/architecture.md)

---

## Documentation

| Document | Contents |
|----------|---------|
| [docs/architecture.md](docs/architecture.md) | System overview, the dual-Firebase split explained, data models, server/client boundary, App Router patterns, real-time data flow diagrams, presence system, component tree, hook architecture |
| [docs/design-decisions.md](docs/design-decisions.md) | Deep dives on RTDB vs Firestore, client-side formula evaluation, no CRDT/undo, and other deliberate choices |
| [docs/features.md](docs/features.md) | Complete feature reference: auth, grid, formulas, formatting, collaboration, export — plus a table of features intentionally excluded and why |
| [docs/project-structure.md](docs/project-structure.md) | Directory layout and file-by-file explanation of every module |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | RTDB database URL (`https://...firebaseio.com`) |

All variables are prefixed with `NEXT_PUBLIC_` because they are consumed entirely in the browser by the Firebase SDK. They are not secrets — they identify your Firebase project. Firebase Security Rules protect your data.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx           Server Component — HTML shell, font, metadata
│   ├── page.tsx             Dashboard: document list + create
│   └── sheet/[id]/
│       └── page.tsx         Editor: grid + toolbar + route protection
│
├── components/
│   ├── Grid.tsx             Spreadsheet grid, selection, resize, reorder
│   ├── Toolbar.tsx          Title, presence avatars, sync state, share, export
│   └── Navbar.tsx           Dashboard nav with auth controls
│
├── hooks/
│   ├── useAuth.ts           Firebase Auth state + Google sign-in
│   ├── useDocuments.ts      Firestore: list + create documents
│   ├── useDocument.ts       Firestore: single document + title update
│   ├── useGridSync.ts       RTDB: cell read/write + batch formatting
│   └── usePresence.ts       RTDB: publish own cursor, read others'
│
├── lib/
│   ├── firebase.ts          Firebase init (auth, db, rtdb exports)
│   ├── formula.ts           Formula parser: =SUM, arithmetic, cycles
│   ├── export.ts            CSV / TSV / JSON export via blob download
│   └── colors.ts            Presence cursor color palette
│
└── types/
    └── types.ts             AppUser, SpreadsheetDoc, CellData, PresenceData
```

→ [Full file-by-file reference](docs/project-structure.md)
