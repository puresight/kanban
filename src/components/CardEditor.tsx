import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Card, CardLane, CardPriority, CardStatus } from '@/db/types';
import { LANE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/db/types';
import { createUlid, cardStem } from '@/db/ulid';
import { db } from '@/db/database';

interface CardEditorProps {
  card: Card | null;
  onClose: () => void;
}

export function CardEditor({ card, onClose }: CardEditorProps) {
  const isNew = card === null;
  const [title, setTitle] = useState(card?.title ?? '');
  const [status, setStatus] = useState<CardStatus>(card?.status ?? 'inbox');
  const [lane, setLane] = useState<CardLane>(card?.lane ?? 'core');
  const [priority, setPriority] = useState<CardPriority>(card?.priority ?? 'medium');
  const [intent, setIntent] = useState(card?.intent ?? '');
  const [constraints, setConstraints] = useState(card?.constraints ?? '');
  const [noteText, setNoteText] = useState('');
  const [blockerReason, setBlockerReason] = useState(card?.blocker?.reason ?? '');
  const [hasBlocker, setHasBlocker] = useState(card?.blocker != null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stem = card ? cardStem(card.id) : 'new';

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (isNew) {
      const newCard: Card = {
        id: createUlid('exo'),
        workspaceId: 'ws-taskboard-default',
        title: trimmed,
        status,
        lane,
        priority,
        intent,
        constraints,
        notes: [],
        lease: null,
        blocker: hasBlocker && blockerReason.trim() ? { by: 'you', reason: blockerReason.trim() } : null,
        contacts: [],
        linkedEventId: null,
        dueAt: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        synced: false,
      };
      await db.cards.put(newCard);
    } else if (card) {
      await db.cards.update(card.id, {
        title: trimmed,
        status,
        lane,
        priority,
        intent,
        constraints,
        blocker: hasBlocker && blockerReason.trim() ? { by: card.blocker?.by ?? 'you', reason: blockerReason.trim() } : null,
        updatedAt: now,
        synced: false,
      });
    }
    onClose();
  };

  const addNote = async () => {
    const text = noteText.trim();
    if (!text || !card) return;
    const note = { id: createUlid(), timestamp: Date.now(), author: 'you', text };
    await db.cards.update(card.id, { notes: [...card.notes, note], updatedAt: Date.now(), synced: false });
    setNoteText('');
  };

  const removeNote = async (noteId: string) => {
    if (!card) return;
    await db.cards.update(card.id, {
      notes: card.notes.filter((n) => n.id !== noteId),
      updatedAt: Date.now(),
      synced: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={isNew ? 'New card' : 'Edit card'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div className="card-pop relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-glow-md dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{isNew ? 'New Card' : 'Edit Card'}</h2>
            {!isNew && <p className="font-mono text-[11px] text-slate-400">{stem}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to happen?"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <Select value={status} onChange={(v) => setStatus(v as CardStatus)} options={statusOptions} />
            </Field>
            <Field label="Lane">
              <Select value={lane} onChange={(v) => setLane(v as CardLane)} options={laneOptions} />
            </Field>
            <Field label="Priority">
              <Select value={priority} onChange={(v) => setPriority(v as CardPriority)} options={priorityOptions} />
            </Field>
          </div>

          <Field label="Intent">
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
              placeholder="Markdown supported — describe the goal…"
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </Field>

          <Field label="Constraints">
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={2}
              placeholder="Markdown supported — boundaries and rules…"
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </Field>

          {!isNew && (
            <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</h3>
              {card && card.notes.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {card.notes.map((note) => (
                    <li key={note.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{note.author}</span>
                        <button
                          type="button"
                          onClick={() => removeNote(note.id)}
                          className="text-slate-400 transition hover:text-red-500"
                          aria-label="Delete note"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-200">{note.text}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-400">{new Date(note.timestamp).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addNote();
                  }}
                  placeholder="Add a note…"
                  className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => void addNote()}
                  disabled={!noteText.trim()}
                  className="h-9 rounded-lg bg-slate-800 px-3 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  Add
                </button>
              </div>
            </section>
          )}

          {!isNew && (
            <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={hasBlocker}
                  onChange={(e) => setHasBlocker(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-attention-600 focus:ring-attention-600 dark:border-slate-600 dark:bg-slate-800"
                />
                Blocked
              </label>
              {hasBlocker && (
                <input
                  value={blockerReason}
                  onChange={(e) => setBlockerReason(e.target.value)}
                  placeholder="Why is this blocked?"
                  className="mt-2 h-9 w-full rounded-lg border border-attention-400 bg-attention-50 px-3 text-sm text-attention-900 placeholder:text-attention-400 focus:border-attention-600 focus:outline-none dark:border-attention-600 dark:bg-attention-900/40 dark:text-attention-100"
                />
              )}
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!title.trim()}
            className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-40"
          >
            {isNew ? 'Create Card' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusOptions = (Object.keys(STATUS_LABELS) as CardStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }));
const laneOptions = (Object.keys(LANE_LABELS) as CardLane[]).map((l) => ({ value: l, label: LANE_LABELS[l] }));
const priorityOptions = (Object.keys(PRIORITY_LABELS) as CardPriority[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
