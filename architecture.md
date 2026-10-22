# Kanban Application Architecture Specification

## 0. Status: Done vs. TODO

### Done (Prompted & Architected)

- **Storage & Schema Foundations:**
- Local-first persistence engine implemented using Dexie.js (`iLifeKanbanDB`) with tables for `cards` and `lanes`.
- Time-sortable ULID-based string identifiers (e.g., `exo-01jk8v49h2b7m9x0z1q`) paired with `workspaceId`, `createdAt`, `updatedAt`, `isDeleted` (soft delete tombstone), and `synced` flags.
- Default lane configuration with configurable WIP limits (`core`: 3, `sandbox`: 2, `docs`: 4) and sample cards demonstrating normal, active lease, and blocked states.

- **Board UI & Interaction Architecture:**
- 5-column linear pipeline: `Inbox`, `Ready`, `Doing`, `Review`, and `Done`.
- Desktop horizontal layout and responsive mobile swipeable/segmented column views.
- Live WIP limit indicators on the `Doing` column (e.g., "Doing 2/3") with visual warning highlights when limits are reached or breached.
- Card components with stem ID display, lane pills, priority badges, active lease countdowns, and high-contrast `[BLOCKED by ...]: [reason]` banners.

- **Card Inspector & Markdown Log Engine:**
- Slide-over inspection drawer with status, lane, and priority controls.
- Structured Markdown rendering and inline editing for `## Intent` and `## Constraints` sections.
- Out-of-band worker lease management interface to claim and release cards with duration countdowns.
- Blocker management interface to set or clear external blocker attributions (`by`) and rationales (`reason`).
- Append-only chronological activity log stream (`## Notes`) appending entries with timestamp, author, and note body.

- **Interoperability & Data Portability:**
- Individual card Markdown export formatting structured YAML frontmatter and Markdown body sections (`## Intent`, `## Constraints`, `## Notes`) to `{id}.md`.
- Bulk export/backup packaging active cards into downloadable file archives.
- Drag-and-drop card import parsing `.md` cards directly into IndexedDB.
- Suite linkage stubs for connecting tasks to CRM Contact UUIDs and Calendar Event dates.
- Generic naming and branding ("Kanban Board" / "Task Board") without hardcoded vendor or suite terms.

- **System Tokens & Theming:**
- Material 3 container surfaces, high-contrast badges, full dark-mode styling, and 48px touch targets.

### TODO (Implementation Remaining)

- **Cloudflare Edge Deployment:**
- Cloudflare Worker API router using Hono (`/api/cards`, `/api/lanes`, `/api/sync`) to serve assets and JSON endpoints.
- Cloudflare D1 SQLite relational schema migration and indexing.

- **Sync & Lease Reconciliation:**
- Background bidirectional delta-synchronization matching local changes (`synced === 0`) to D1.
- Edge lease reconciliation ensuring expired worker leases are released cleanly across multi-client sessions.

- **Central SSO Handshake:**
- Middleware reading root domain HttpOnly cookies (`.domain.cc`) to enforce workspace tenant boundaries (`workspace_id`).

- **Active Suite Entity Handshakes:**
- Live cross-database queries linking task cards to active CRM contact records (`iLifeCRMDB`) and Calendar milestone deadlines (`iLifeCalendarDB`).

- **Automated Housekeeping Routines:**
- Archival automation moving completed tasks older than 7 days to `archive/<YYYY>/` and pruning stale cards older than 30 days into compact connector records.

---

## 1. System Overview

The Kanban application is an edge-native, local-first workflow execution tool designed for human developers and autonomous AI agents. It prioritizes work-in-progress (WIP) constraints, time-sortable collision-free task addressing, explicit blocker tracking, and zero-context-switch repository interoperability.

The application functions completely offline inside the browser using IndexedDB via Dexie.js as its primary datastore, with planned bidirectional synchronization targeting Cloudflare Workers and Cloudflare D1.

---

## 2. Data Models & Schemas

### Client-Side IndexedDB Schema (TypeScript / Dexie.js)

```typescript
import Dexie, { type Table } from "dexie";

export type TaskStatus = "inbox" | "ready" | "doing" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface KanbanBlocker {
  by: string; // e.g., "upstream:repo#97" or "card:exo-01jk..."
  reason: string;
}

export interface KanbanLease {
  agent: string; // e.g., "human:user" or "agent:runner"
  until: number; // Timestamp ms
}

export interface KanbanNote {
  id: string;
  timestamp: number;
  author: string;
  text: string;
}

export interface KanbanCard {
  id: string; // ULID stem (e.g., "exo-01jk8v49h2b7m9x0z1q")
  workspaceId: string;
  title: string;
  status: TaskStatus;
  lane: string; // e.g., "core", "sandbox", "docs"
  priority: TaskPriority;

  // Structured Markdown Sections
  intent: string; // ## Intent (Markdown body)
  constraints?: string; // ## Constraints
  notes: KanbanNote[]; // ## Notes (append-only timeline)

  // Agent Leases & Blocker Tracking
  lease?: KanbanLease | null;
  blocker?: KanbanBlocker | null;

  // Cross-App Suite Linkage Stubs
  linkedContactIds?: string[]; // CRM Contact UUIDs
  linkedEventId?: string; // Calendar Event UUID or timestamp

  createdAt: number;
  updatedAt: number;
  isDeleted: boolean; // Soft delete tombstone
  synced: number; // 0 = pending sync, 1 = synced
}

export interface KanbanLaneConfig {
  id: string; // e.g., "core"
  name: string;
  color: string;
  wipLimitDoing: number; // Maximum cards permitted in 'doing'
}

export class KanbanDatabase extends Dexie {
  cards!: Table<KanbanCard, string>;
  lanes!: Table<KanbanLaneConfig, string>;

  constructor() {
    super("iLifeKanbanDB");
    this.version(1).stores({
      cards:
        "id, workspaceId, status, lane, priority, updatedAt, isDeleted, synced, [workspaceId+status]",
      lanes: "id, name",
    });
  }
}

export const kanbanDb = new KanbanDatabase();
```

### Relational D1 Schema (Cloudflare SQLite)

```sql
CREATE TABLE kanban_lanes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    wip_limit_doing INTEGER NOT NULL DEFAULT 3,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE kanban_cards (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('inbox', 'ready', 'doing', 'review', 'done')),
    lane TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    intent TEXT NOT NULL,
    constraints TEXT,
    notes JSON DEFAULT '[]',
    lease JSON,
    blocker JSON,
    linked_contact_ids JSON DEFAULT '[]',
    linked_event_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    is_deleted INTEGER NOT NULL DEFAULT 0,
    synced INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_kanban_cards_lookup ON kanban_cards(workspace_id, status, lane, is_deleted);
CREATE INDEX idx_kanban_cards_updated ON kanban_cards(workspace_id, updated_at);

```

---

## 3. Workflow Rules & WIP Limit Enforcement

### The 5-Column Progression Pipeline

1. **Inbox:** Initial capture point for untriaged bugs, ideas, and feature requests.
2. **Ready:** Triaged tasks with clear acceptance criteria and defined constraints, ready for implementation.
3. **Doing:** Active implementation work. Strictly governed by the lane's WIP limit. Taking a worker lease transitions cards here.
4. **Review:** Verification stage. Autonomous agents stop at this boundary to allow human inspection or automated integration testing.
5. **Done:** Completed and verified tasks.

### WIP Enforcement Logic

- Every lane configures an integer `wipLimitDoing`.
- Transitioning a card into `doing` (either via manual move or via claiming a worker lease) calculates:
  `activeDoingCount = count(cards WHERE lane == targetLane AND status == 'doing' AND isDeleted == false)`
- If `activeDoingCount >= lane.wipLimitDoing`, the UI raises a visual constraint warning and prevents accidental moves unless explicitly overridden.

### Worker Leases & Blocker Semantics

- **Leases:** Avoid merge collisions and duplicate work when multiple workers or agents run simultaneously. Leases store `{ agent, until }`. Expired leases are visually flagged for claiming or release.
- **Blockers:** When external dependencies stall progress, the card stores `{ by, reason }`. Blocked cards render with warning banners and filter chips regardless of their active column.

---

## 4. In-Repo Interoperability & File Structure

The web application maintains 1:1 format compatibility with Git-tracked Markdown task files (`exo-<ulid>.md`).

### Card Markdown Format

```markdown
---
id: exo-01jk8v49h2b7m9x0z1q
title: Add Bubblewrap sandbox enforcement for preflight
status: doing
lane: core
priority: high
lease:
  agent: human:monty
  until: 1776854400000
blocker: null
createdAt: 1776840000000
updatedAt: 1776847200000
---

## Intent

Implement unprivileged namespace isolation for tool validation steps.

## Constraints

Must execute on Linux kernels without requiring elevated root privileges.

## Notes

- 2026-10-22T06:00:00Z [human:monty]: Verified bwrap flags against atomic host testbed.
```

### Export & Import Engine

- **Single Card Export:** Serializes active database fields into `{id}.md` with YAML frontmatter.
- **Batch Import:** Reads uploaded or dropped `.md` files, parses frontmatter and section headers, and inserts or updates records in `iLifeKanbanDB` using the filename ULID as the primary key.

---

## 5. Cross-Suite Integration Contracts

- **CRM Contacts Linkage:**
- Cards support an array of `linkedContactIds`. Detail views render contact chips (initials, name) and resolve against the CRM database to associate work with specific individuals or stakeholders.

- **Calendar Linkage:**
- Cards track `linkedEventId`. Scheduled deadlines or milestone target dates surface in the Calendar application as actionable time blocks.

- **Chat Linkage:**
- Messages in the Chat application embed task cards using the task stem ID (`exo-...`), rendering real-time status chips and one-tap navigation directly into the board inspector.
