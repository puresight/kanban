import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  CalendarClock,
  Check,
  ChevronLeft,
  Copy,
  Download,
  Hourglass,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  ShieldAlert,
  Timer,
  UserPlus,
  X,
} from 'lucide-react';
import { db, doingCountForLane, getLaneWipLimit } from '@/db/database';
import type { Card, CardLane, CardPriority, CardStatus } from '@/db/types';
import { LANE_LABELS, PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER } from '@/db/types';
import { cardStem } from '@/db/ulid';
import { cardToMarkdown, downloadFile } from '@/lib/cardFile';
import { addKnownContact, getKnownContacts, setCurrentAgent } from '@/lib/agent';
import { contactInitials, formatDueLabel, type Contact } from '@/lib/contacts';
import { Markdown } from './Markdown';

interface CardInspectorProps {
  card: Card;
  contacts: Contact[];
  onClose: () => void;
}

const NOTE_AUTHOR_KEY = 'kanban-current-agent';

function getCurrentAgent(): string {
  return localStorage.getItem(NOTE_AUTHOR_KEY) || 'user';
}

function resolveContactName(id: string, contacts: Contact[]): string {
  return contacts.find((c) => c.id === id)?.name ?? id;
}

function formatCountdown(until: number): string {
  const ms = until - Date.now();
  if (ms <= 0) return 'expired';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m remaining`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m remaining`;
}

const PRIORITY_STYLES: Record<CardPriority, string> = {
  low: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  medium: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900',
  high: 'bg-momentum-100 text-momentum-900 ring-momentum-200 dark:bg-momentum-900 dark:text-momentum-100 dark:ring-momentum-600',
  urgent: 'bg-attention-100 text-attention-900 ring-attention-200 dark:bg-attention-900 dark:text-attention-100 dark:ring-attention-600',
};

const LANE_PILL_STYLES: Record<CardLane, string> = {
  core: 'bg-indigo-100 text-indigo-700 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800',
  sandbox: 'bg-momentum-100 text-momentum-900 ring-momentum-200 dark:bg-momentum-900 dark:text-momentum-100 dark:ring-momentum-600',
  docs: 'bg-attention-100 text-attention-900 ring-attention-200 dark:bg-attention-900 dark:text-attention-100 dark:ring-attention-600',
};

export function CardInspector({ card, contacts, onClose }: CardInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<CardStatus>(card.status);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [leaseAgent, setLeaseAgent] = useState('');
  const [leaseHours, setLeaseHours] = useState('2');
  const [leasePromptOpen, setLeasePromptOpen] = useState(false);
  const [blockerBy, setBlockerBy] = useState('');
  const [blockerReason, setBlockerReason] = useState('');
  const [blockerFormOpen, setBlockerFormOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [tick, setTick] = useState(0);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [eventField, setEventField] = useState(card.linkedEventId ?? '');
  const [dueDateInput, setDueDateInput] = useState(
    card.dueAt ? new Date(card.dueAt - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : ''
  );
  const [dueTimeInput, setDueTimeInput] = useState('17:00');
  const eventInputRef = useRef<HTMLInputElement>(null);

  // Live-refresh countdown timers.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeLease = card.lease && card.lease.until > Date.now() ? card.lease : null;

  const patch = async (updates: Partial<Card>) => {
    await db.cards.update(card.id, { ...updates, updatedAt: Date.now(), synced: false });
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(card.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (e.g. insecure context); silently ignore
    }
  };

  const exportMarkdown = () => {
    const blob = new Blob([cardToMarkdown(card)], { type: 'text/markdown;charset=utf-8' });
    downloadFile(blob, `${card.id}.md`);
  };

  const changeStatus = async (next: CardStatus) => {
    setStatusError(null);
    if (next === card.status) return;
    if (next === 'doing' && card.status !== 'doing') {
      const limit = await getLaneWipLimit(card.lane);
      const count = await doingCountForLane(card.lane, card.id);
      if (count >= limit) {
        setStatusError(`WIP limit reached for ${LANE_LABELS[card.lane]} (${count}/${limit}). Finish work before pulling more.`);
        return;
      }
    }
    setStatus(next);
    await patch({ status: next });
  };

  const takeLease = async () => {
    const agent = leaseAgent.trim();
    if (!agent) return;
    setCurrentAgent(agent);
    const hours = Math.max(0.5, Math.min(24, parseFloat(leaseHours) || 2));
    const until = Date.now() + hours * 3_600_000;
    const updates: Partial<Card> = { lease: { agent, until } };
    if (card.status !== 'doing') {
      const limit = await getLaneWipLimit(card.lane);
      const count = await doingCountForLane(card.lane, card.id);
      if (count < limit) {
        updates.status = 'doing';
        setStatus('doing');
      }
    }
    await patch(updates);
    await appendNote(`${agent} claimed a lease for ${hours}h`, agent);
    setLeasePromptOpen(false);
    setLeaseAgent('');
    setLeaseHours('2');
  };

  const releaseLease = async () => {
    if (!activeLease) return;
    await patch({ lease: null });
    await appendNote(`${activeLease.agent} released the lease`, getCurrentAgent());
  };

  const markBlocked = async () => {
    const by = blockerBy.trim();
    const reason = blockerReason.trim();
    if (!by || !reason) return;
    await patch({ blocker: { by, reason } });
    await appendNote(`Blocked by ${by}: ${reason}`, getCurrentAgent());
    setBlockerFormOpen(false);
    setBlockerBy('');
    setBlockerReason('');
  };

  const unblock = async () => {
    if (!card.blocker) return;
    const wasBy = card.blocker.by;
    await patch({ blocker: null });
    await appendNote(`Unblocked (was blocked by ${wasBy})`, getCurrentAgent());
  };

  const appendNote = async (text: string, author?: string) => {
    const note = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      author: author || getCurrentAgent(),
      text,
    };
    const fresh = await db.cards.get(card.id);
    await db.cards.update(card.id, {
      notes: [...(fresh?.notes ?? []), note],
      updatedAt: Date.now(),
      synced: false,
    });
  };

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    await appendNote(text);
    setNoteText('');
  };

  const addContact = async (contact: Contact) => {
    if (card.contacts.includes(contact.id)) return;
    addKnownContact(contact);
    setContactPickerOpen(false);
    await patch({ contacts: [...card.contacts, contact.id] });
    await appendNote(`Linked contact: ${contact.name}`, getCurrentAgent());
  };

  const removeContact = async (id: string) => {
    const name = resolveContactName(id, contacts);
    await patch({ contacts: card.contacts.filter((c) => c !== id) });
    await appendNote(`Unlinked contact: ${name}`, getCurrentAgent());
  };

  const createAndLinkContact = async () => {
    const name = newContactName.trim();
    if (!name) return;
    await addContact({ id: `contact-${crypto.randomUUID().slice(0, 8)}`, name });
    setNewContactName('');
  };

  const saveEventLink = async () => {
    const eventId = eventField.trim() || null;
    let dueAt = card.dueAt;
    if (dueDateInput) {
      const [y, m, d] = dueDateInput.split('-').map(Number);
      const [hh, mm] = dueTimeInput.split(':').map(Number);
      dueAt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 17, mm ?? 0).getTime();
    } else if (!eventId) {
      dueAt = null;
    }
    await patch({ linkedEventId: eventId, dueAt });
    await appendNote(
      eventId
        ? `Linked calendar event ${eventId}${dueAt ? ` (due ${new Date(dueAt).toLocaleString()})` : ''}`
        : dueAt
          ? `Set due date ${new Date(dueAt).toLocaleString()}`
          : 'Cleared calendar link',
      getCurrentAgent()
    );
  };

  const clearEventLink = async () => {
    setEventField('');
    setDueDateInput('');
    await patch({ linkedEventId: null, dueAt: null });
    await appendNote('Cleared calendar link', getCurrentAgent());
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Card inspector">
      <button type="button" aria-label="Close inspector" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />

      {/* Full-screen sheet on mobile, right slide-over on desktop */}
      <div className="absolute inset-x-0 bottom-0 top-14 flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-glow-md animate-[drawer-in_200ms_ease-out] dark:bg-slate-900 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[480px] sm:rounded-none sm:rounded-l-2xl">
        {/* Header bar */}
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 sm:hidden"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => void copyId()}
            title="Copy card ID"
            className="group flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-mono text-xs text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <span className="truncate">{cardStem(card.id)}</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-momentum-600" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" aria-hidden />
            )}
          </button>

          <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${PRIORITY_STYLES[card.priority]}`}>
            {PRIORITY_LABELS[card.priority]}
          </span>

          <button
            type="button"
            onClick={exportMarkdown}
            title="Export card as Markdown"
            aria-label="Export card as Markdown"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
          >
            <Download className="h-4 w-4" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-tick={tick}>
          <h2 className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">{card.title}</h2>

          {/* Status selector with WIP validation + lane pills */}
          <div className="mt-4 space-y-3">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Column</span>
              <select
                value={status}
                onChange={(e) => void changeStatus(e.target.value as CardStatus)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {statusError && (
                <p className="mt-1.5 rounded-lg bg-attention-100 px-2 py-1.5 text-[11px] font-semibold text-attention-900 ring-1 ring-attention-400 dark:bg-attention-900 dark:text-attention-100 dark:ring-attention-600">
                  {statusError}
                </p>
              )}
            </div>

            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Lane</span>
              <div className="flex gap-1.5">
                {(Object.keys(LANE_LABELS) as CardLane[]).map((lane) => {
                  const active = card.lane === lane;
                  return (
                    <button
                      key={lane}
                      type="button"
                      onClick={() => void patch({ lane })}
                      className={`h-9 rounded-full px-3 text-xs font-medium ring-1 transition ${
                        active
                          ? LANE_PILL_STYLES[lane]
                          : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
                      }`}
                    >
                      {LANE_LABELS[lane]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Markdown sections with edit toggles */}
          <MarkdownSection
            label="Intent"
            placeholder="Primary specification, background, and goals…"
            source={card.intent}
            onSave={(value) => void patch({ intent: value })}
          />
          <MarkdownSection
            label="Constraints"
            placeholder="Boundaries, forbidden tools, invariants…"
            source={card.constraints}
            onSave={(value) => void patch({ constraints: value })}
          />

          {/* Worker lease module */}
          <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Timer className="h-3.5 w-3.5" aria-hidden /> Worker Lease
            </h3>
            {activeLease ? (
              <div className="mt-2">
                <div className="flex items-center gap-2 rounded-lg bg-momentum-50 px-3 py-2 ring-1 ring-momentum-200 dark:bg-momentum-900/60 dark:ring-momentum-600">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-momentum-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-momentum-600" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-momentum-900 dark:text-momentum-100">{activeLease.agent}</p>
                    <p className="text-[11px] text-momentum-600 dark:text-momentum-200">{formatCountdown(activeLease.until)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void releaseLease()}
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <LockOpen className="h-3.5 w-3.5" aria-hidden /> Release Lease
                </button>
              </div>
            ) : leasePromptOpen ? (
              <div className="mt-2 space-y-2">
                <input
                  value={leaseAgent}
                  onChange={(e) => setLeaseAgent(e.target.value)}
                  placeholder="Agent name (e.g. human:monty)"
                  autoFocus
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={leaseHours}
                    onChange={(e) => setLeaseHours(e.target.value)}
                    className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">hours</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void takeLease()}
                    disabled={!leaseAgent.trim()}
                    className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                  >
                    <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Take Lease
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeasePromptOpen(false)}
                    className="h-9 rounded-lg px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLeasePromptOpen(true)}
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-momentum-600 px-3 text-xs font-medium text-white transition hover:bg-momentum-400"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden /> Take Lease
              </button>
            )}
          </section>

          {/* Blocker management */}
          <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Blocker
            </h3>
            {card.blocker ? (
              <div className="mt-2">
                <div className="blocker-pulse rounded-lg bg-attention-100 px-3 py-2.5 ring-1 ring-attention-400 dark:bg-attention-900 dark:ring-attention-600">
                  <p className="text-xs font-bold uppercase tracking-wide text-attention-900 dark:text-attention-100">
                    [BLOCKED by {card.blocker.by}]
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-snug text-attention-900 dark:text-attention-100">{card.blocker.reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void unblock()}
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-momentum-600 px-3 text-xs font-medium text-white transition hover:bg-momentum-400"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> Unblock
                </button>
              </div>
            ) : blockerFormOpen ? (
              <div className="mt-2 space-y-2">
                <input
                  value={blockerBy}
                  onChange={(e) => setBlockerBy(e.target.value)}
                  placeholder="Blocked by (PR, dependency, card ID…)"
                  autoFocus
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-attention-600 focus:outline-none focus:ring-2 focus:ring-attention-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <textarea
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this blocked?"
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-attention-600 focus:outline-none focus:ring-2 focus:ring-attention-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void markBlocked()}
                    disabled={!blockerBy.trim() || !blockerReason.trim()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-attention-600 px-3 text-xs font-medium text-white transition hover:bg-attention-400 disabled:opacity-40"
                  >
                    <Ban className="h-3.5 w-3.5" aria-hidden /> Mark Blocked
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockerFormOpen(false)}
                    className="h-9 rounded-lg px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBlockerFormOpen(true)}
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-attention-100 px-3 text-xs font-medium text-attention-900 ring-1 ring-attention-400 transition hover:bg-attention-200 dark:bg-attention-900 dark:text-attention-100 dark:ring-attention-600"
              >
                <Ban className="h-3.5 w-3.5" aria-hidden /> Mark Blocked
              </button>
            )}
          </section>

          {/* Linked contacts */}
          <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <UserPlus className="h-3.5 w-3.5" aria-hidden /> Linked Contacts
              <button
                type="button"
                onClick={() => setContactPickerOpen((o) => !o)}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add Contact
              </button>
            </h3>

            {card.contacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {card.contacts.map((id) => {
                  const name = resolveContactName(id, contacts);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                        {contactInitials(name)}
                      </span>
                      {name}
                      <button
                        type="button"
                        onClick={() => void removeContact(id)}
                        aria-label={`Remove ${name}`}
                        className="text-slate-400 transition hover:text-red-500"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {contactPickerOpen && (
              <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
                {contacts.filter((c) => !card.contacts.includes(c.id)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {contacts
                      .filter((c) => !card.contacts.includes(c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => void addContact(c)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition hover:ring-indigo-400 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[9px] font-bold text-white dark:bg-slate-600">
                            {contactInitials(c.name)}
                          </span>
                          {c.name}
                        </button>
                      ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    ref={eventInputRef}
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void createAndLinkContact();
                    }}
                    placeholder="New contact name…"
                    className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => void createAndLinkContact()}
                    disabled={!newContactName.trim()}
                    className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Calendar milestone link */}
          <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Calendar Milestone
            </h3>

            {(card.linkedEventId || card.dueAt) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {card.dueAt && <DueChip dueAt={card.dueAt} />}
                {card.linkedEventId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    {card.linkedEventId}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void clearEventLink()}
                  className="text-[11px] font-medium text-slate-400 underline underline-offset-2 transition hover:text-red-500"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <input
                value={eventField}
                onChange={(e) => setEventField(e.target.value)}
                placeholder="Event ID…"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="date"
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
              />
              <input
                type="time"
                value={dueTimeInput}
                onChange={(e) => setDueTimeInput(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
              />
              <button
                type="button"
                onClick={() => void saveEventLink()}
                className="h-9 rounded-lg bg-slate-800 px-3 text-xs font-medium text-white transition hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                Link
              </button>
            </div>
          </section>

          {/* Append-only note log */}
          <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Hourglass className="h-3.5 w-3.5" aria-hidden /> Activity Log
              <span className="ml-auto font-mono text-[10px] normal-case text-slate-400">{card.notes.length} entries</span>
            </h3>

            <ul className="mt-2 space-y-0">
              {card.notes.length === 0 && (
                <li className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  No activity yet.
                </li>
              )}
              {useMemo(() => [...card.notes].sort((a, b) => a.timestamp - b.timestamp), [card.notes]).map((note, idx, arr) => (
                <li key={note.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {idx < arr.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200 dark:bg-slate-700" aria-hidden />}
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-400 ring-4 ring-white dark:ring-slate-900" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{note.author}</span>
                      <span className="font-mono text-[10px] text-slate-400">{new Date(note.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{note.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitNote();
                }}
                placeholder={`Log an entry as ${getCurrentAgent()}…`}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void submitNote()}
                disabled={!noteText.trim()}
                className="h-10 shrink-0 rounded-lg bg-slate-800 px-4 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                Add Note
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DueChip({ dueAt }: { dueAt: number }) {
  const { text, tone } = formatDueLabel(dueAt);
  const styles = {
    past: 'bg-attention-100 text-attention-900 ring-attention-400 dark:bg-attention-900 dark:text-attention-100 dark:ring-attention-600',
    soon: 'bg-momentum-100 text-momentum-900 ring-momentum-200 dark:bg-momentum-900 dark:text-momentum-100 dark:ring-momentum-600',
    future: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  }[tone];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1">
      <span className={styles}>{text}</span>
      <span className="font-mono text-[10px] text-slate-400">{new Date(dueAt).toLocaleDateString()}</span>
    </span>
  );
}

function MarkdownSection({ label, placeholder, source, onSave }: { label: string; placeholder: string; source: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source);

  useEffect(() => {
    if (!editing) setDraft(source);
  }, [source, editing]);

  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</h3>
        <button
          type="button"
          onClick={() => {
            if (editing) {
              onSave(draft);
              setEditing(false);
            } else {
              setDraft(source);
              setEditing(true);
            }
          }}
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-800"
        >
          {editing ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Pencil className="h-3.5 w-3.5" aria-hidden />}
          {editing ? 'Save' : 'Edit'}
        </button>
      </div>
      <div className="mt-1.5">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            placeholder={placeholder}
            autoFocus
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <Markdown source={source} />
        )}
      </div>
    </section>
  );
}
