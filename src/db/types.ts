export type CardStatus = 'inbox' | 'ready' | 'doing' | 'review' | 'done';
export type CardLane = 'core' | 'sandbox' | 'docs';
export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CardNote {
  id: string;
  timestamp: number;
  author: string;
  text: string;
}

export interface CardLease {
  agent: string;
  until: number;
}

export interface CardBlocker {
  by: string;
  reason: string;
}

export interface Card {
  id: string;
  workspaceId: string;
  title: string;
  status: CardStatus;
  lane: CardLane;
  priority: CardPriority;
  intent: string;
  constraints: string;
  notes: CardNote[];
  lease: CardLease | null;
  blocker: CardBlocker | null;
  contacts: string[];
  linkedEventId: string | null;
  dueAt: number | null;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
  synced: boolean;
}

export const DEFAULT_WORKSPACE_ID = 'ws-taskboard-default';

export const STATUS_ORDER: CardStatus[] = ['inbox', 'ready', 'doing', 'review', 'done'];

export const STATUS_LABELS: Record<CardStatus, string> = {
  inbox: 'Inbox',
  ready: 'Ready',
  doing: 'Doing',
  review: 'Review',
  done: 'Done',
};

export const LANE_LABELS: Record<CardLane, string> = {
  core: 'Core',
  sandbox: 'Sandbox',
  docs: 'Docs',
};

export const PRIORITY_ORDER: CardPriority[] = ['urgent', 'high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<CardPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
