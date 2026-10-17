import type { Card, CardBlocker, CardLease, CardStatus, CardLane, CardPriority } from '../db/types';
import { STATUS_LABELS, LANE_LABELS } from '../db/types';

export function escapeYaml(value: string): string {
  if (/[:#\[\]{}&*!|>'"%@`,]/.test(value) || value.trim() !== value || value === '') {
    return JSON.stringify(value);
  }
  return value;
}

export function unescapeYaml(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

export function cardToMarkdown(card: Card): string {
  const lines: string[] = [
    '---',
    `id: ${escapeYaml(card.id)}`,
    `title: ${escapeYaml(card.title)}`,
    `status: ${card.status}`,
    `lane: ${card.lane}`,
    `priority: ${card.priority}`,
    card.lease
      ? `lease:\n  agent: ${escapeYaml(card.lease.agent)}\n  until: ${card.lease.until}`
      : 'lease: null',
    card.blocker
      ? `blocker:\n  by: ${escapeYaml(card.blocker.by)}\n  reason: ${escapeYaml(card.blocker.reason)}`
      : 'blocker: null',
    `createdAt: ${card.createdAt}`,
    `updatedAt: ${card.updatedAt}`,
    '---',
    '',
    '## Intent',
    card.intent.trim() || '_(none)_',
    '',
    '## Constraints',
    card.constraints.trim() || '_(none)_',
    '',
    '## Notes',
  ];
  for (const note of card.notes) {
    lines.push(`- **${escapeYaml(note.author)}** (${formatTimestamp(note.timestamp)}): ${note.text}`);
  }
  if (card.notes.length === 0) lines.push('_(none)_');
  return lines.join('\n') + '\n';
}

export function parseFrontmatterBlock(raw: string): { meta: Record<string, string>; body: string } | null {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (!match) return null;
  const meta: Record<string, string> = {};
  let currentKey: string | null = null;
  for (const line of match[1].split('\n')) {
    const nested = /^  (\w+):\s*(.*)$/.exec(line);
    if (nested && currentKey) {
      meta[`${currentKey}.${nested[1]}`] = unescapeYaml(nested[2]);
      continue;
    }
    const top = /^(\w+):\s*(.*)$/.exec(line);
    if (top) {
      currentKey = top[1];
      meta[top[1]] = unescapeYaml(top[2]);
    }
  }
  return { meta, body: match[2] };
}

function section(body: string, name: string): string {
  const pattern = new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'm');
  const match = pattern.exec(body);
  if (!match) return '';
  return match[1].trim();
}

function cleanSection(body: string, name: string): string {
  const text = section(body, name);
  if (!text || text === '_(none)_') return '';
  return text;
}

export function markdownToCard(raw: string, fallbackId: string): Card | null {
  const parsed = parseFrontmatterBlock(raw);
  if (!parsed) return null;
  const { meta, body } = parsed;

  const title = meta['title']?.trim();
  if (!title) return null;

  const statusRaw = (meta['status'] || 'inbox').toLowerCase();
  const status: CardStatus = (Object.keys(STATUS_LABELS) as CardStatus[]).includes(statusRaw as CardStatus)
    ? (statusRaw as CardStatus)
    : 'inbox';

  const laneRaw = (meta['lane'] || 'core').toLowerCase();
  const lane: CardLane = (Object.keys(LANE_LABELS) as CardLane[]).includes(laneRaw as CardLane)
    ? (laneRaw as CardLane)
    : 'core';

  const priorityRaw = (meta['priority'] || 'medium').toLowerCase();
  const priority: CardPriority = (['low', 'medium', 'high', 'urgent'] as CardPriority[]).includes(priorityRaw as CardPriority)
    ? (priorityRaw as CardPriority)
    : 'medium';

  const now = Date.now();
  const createdAt = Number(meta['createdAt']) || now;
  const updatedAt = Number(meta['updatedAt']) || now;

  let lease: CardLease | null = null;
  if (meta['lease.agent'] && meta['lease.until'] && meta['lease'] !== 'null') {
    lease = { agent: meta['lease.agent'], until: Number(meta['lease.until']) || 0 };
    if (lease.until <= now) lease = null;
  }

  let blocker: CardBlocker | null = null;
  if (meta['blocker.by'] && meta['blocker.reason'] && meta['blocker'] !== 'null') {
    blocker = { by: meta['blocker.by'], reason: meta['blocker.reason'] };
  }

  const notes: Card['notes'] = [];
  const notesSection = section(body, 'Notes');
  if (notesSection && notesSection !== '_(none)_') {
    for (const line of notesSection.split('\n')) {
      const noteMatch = /^[-*]\s+\*\*(.+?)\*\*\s*\((.+?)\):\s*(.*)$/.exec(line.trim());
      if (noteMatch) {
        const ts = Date.parse(noteMatch[2]);
        notes.push({
          id: crypto.randomUUID(),
          timestamp: Number.isNaN(ts) ? now : ts,
          author: noteMatch[1],
          text: noteMatch[3],
        });
      }
    }
  }

  const id = meta['id']?.trim() || fallbackId;

  return {
    id,
    workspaceId: 'ws-taskboard-default',
    title,
    status,
    lane,
    priority,
    intent: cleanSection(body, 'Intent'),
    constraints: cleanSection(body, 'Constraints'),
    notes,
    lease,
    blocker,
    contacts: [],
    linkedEventId: null,
    dueAt: null,
    createdAt,
    updatedAt,
    isDeleted: false,
    synced: false,
  };
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
