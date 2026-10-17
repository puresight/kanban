import Dexie, { type Table } from 'dexie';
import type { Card, CardLane } from './types';
import { DEFAULT_WORKSPACE_ID } from './types';
import { createUlid } from './ulid';

export interface Lane {
  id: string;
  workspaceId: string;
  lane: CardLane;
  wipLimit: number;
  updatedAt: number;
  synced: boolean;
}

export const LANE_WIP_LIMITS: Record<CardLane, number> = {
  core: 3,
  sandbox: 2,
  docs: 4,
};

export class TaskBoardDB extends Dexie {
  cards!: Table<Card, string>;
  lanes!: Table<Lane, string>;

  constructor() {
    super('TaskBoardDB');
    this.version(1).stores({
      cards: 'id, workspaceId, status, lane, priority, updatedAt, isDeleted',
      lanes: 'id, workspaceId, lane',
    });
  }
}

export const db = new TaskBoardDB();

export async function doingCountForLane(lane: CardLane, excludeCardId?: string): Promise<number> {
  const cards = await db.cards.where('isDeleted').equals(0).toArray();
  return cards.filter((c) => c.lane === lane && c.status === 'doing' && c.id !== excludeCardId).length;
}

export async function getLaneWipLimit(lane: CardLane): Promise<number> {
  const record = await db.lanes.where('lane').equals(lane).first();
  return record?.wipLimit ?? LANE_WIP_LIMITS[lane];
}

export async function ensureSeeded(): Promise<void> {
  const existingLanes = await db.lanes.count();
  if (existingLanes === 0) {
    const now = Date.now();
    const lanes: Lane[] = (Object.keys(LANE_WIP_LIMITS) as CardLane[]).map((lane) => ({
      id: `lane-${lane}`,
      workspaceId: DEFAULT_WORKSPACE_ID,
      lane,
      wipLimit: LANE_WIP_LIMITS[lane],
      updatedAt: now,
      synced: false,
    }));
    await db.lanes.bulkPut(lanes);
  }

  const existingCards = await db.cards.count();
  if (existingCards === 0) {
    const now = Date.now();
    const make = (partial: Partial<Card>): Card => ({
      id: createUlid('exo'),
      workspaceId: DEFAULT_WORKSPACE_ID,
      title: '',
      status: 'inbox',
      lane: 'core',
      priority: 'medium',
      intent: '',
      constraints: '',
      notes: [],
      lease: null,
      blocker: null,
      contacts: [],
      linkedEventId: null,
      dueAt: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      synced: false,
      ...partial,
    });

    const seedCards: Card[] = [
      make({
        title: 'Ship offline sync worker',
        status: 'doing',
        lane: 'core',
        priority: 'high',
        intent: 'Batch local mutations and push them to the sync endpoint every 30s.',
        constraints: 'Must survive app reloads mid-batch.\nNever block the UI thread.',
        notes: [{ id: createUlid(), timestamp: now - 3_600_000, author: 'you', text: 'The local database keeps the board in sync with the queue.' }],
        lease: { agent: 'agent:hermes', until: now + 105 * 60 * 1000 },
        contacts: ['contact-monty'],
        dueAt: now + 3 * 86_400_000,
      }),
      make({
        title: 'Rate limit public API',
        status: 'doing',
        lane: 'core',
        priority: 'urgent',
        intent: 'Protect the ingest route with a per-key token bucket.',
        constraints: 'Fail closed if Redis is unreachable.',
        blocker: { by: 'infra-team', reason: 'Waiting on Redis cluster provisioning ticket' },
        contacts: ['contact-dana'],
        dueAt: now + 86_400_000,
      }),
      make({
        title: 'Rewrite onboarding docs',
        status: 'ready',
        lane: 'docs',
        priority: 'medium',
        intent: 'Split the single setup guide into quickstart + reference pages.',
        constraints: '',
        linkedEventId: 'evt-kickoff-01',
        dueAt: now + 7 * 86_400_000,
      }),
      make({
        title: 'Prototype canvas timeline view',
        status: 'inbox',
        lane: 'sandbox',
        priority: 'low',
        intent: 'Spike a canvas-rendered timeline to compare against the DOM version.',
        constraints: 'Time-boxed to one day. Throwaway code.',
      }),
      make({
        title: 'Harden card validation schema',
        status: 'review',
        lane: 'core',
        priority: 'medium',
        intent: 'Zod-parse every inbound sync payload before it touches the DB.',
        constraints: 'Reject unknown fields.',
        notes: [{ id: createUlid(), timestamp: now - 86_400_000, author: 'agent:hermes', text: 'Schema drafted, waiting on review.' }],
      }),
      make({
        title: 'Archive legacy export format',
        status: 'done',
        lane: 'docs',
        priority: 'low',
        intent: 'Retire the CSV export path after v2 JSON export ships.',
        constraints: '',
      }),
    ];

    await db.cards.bulkPut(seedCards);
  }
}
