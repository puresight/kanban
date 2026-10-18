import { useCallback, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { useLiveQuery } from 'dexie-react-hooks';
import { Header, type QuickFilter } from '@/components/Header';
import { Board } from '@/components/Board';
import { CardEditor } from '@/components/CardEditor';
import { CardInspector } from '@/components/CardInspector';
import { db, ensureSeeded } from '@/db/database';
import type { Card, CardLane } from '@/db/types';
import { cardToMarkdown, downloadFile, markdownToCard } from '@/lib/cardFile';
import { getCurrentAgent, getKnownContacts, setCurrentAgent } from '@/lib/agent';
import type { Contact } from '@/lib/contacts';
import { useTheme } from '@/hooks/useTheme';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Download, X } from 'lucide-react';

export default function App() {
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  const [laneFilter, setLaneFilter] = useState<CardLane | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [search, setSearch] = useState('');
  const [editorCard, setEditorCard] = useState<Card | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [inspectCardId, setInspectCardId] = useState<string | null>(null);
  const [newDefaults, setNewDefaults] = useState<{ status: Card['status']; lane: CardLane }>({ status: 'inbox', lane: 'core' });
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    void ensureSeeded().then(() => setReady(true));
  }, []);

  useEffect(() => {
    setCurrentAgent(getCurrentAgent());
    const known = getKnownContacts();
    setContacts(
      known.length > 0
        ? known
        : [
            { id: 'contact-monty', name: 'Monty' },
            { id: 'contact-dana', name: 'Dana Reeves' },
            { id: 'contact-alex', name: 'Alex Kim' },
          ]
    );
  }, []);

  const cards = useLiveQuery(
    () => db.cards.where('isDeleted').equals(0).toArray(),
    [ready],
    undefined
  );
  const lanes = useLiveQuery(() => db.lanes.toArray(), [ready], undefined);
  const inspectCard = useLiveQuery(
    () => (inspectCardId ? db.cards.get(inspectCardId) : undefined),
    [inspectCardId]
  );

  const currentAgent = getCurrentAgent();

  const filtered = useMemo(() => {
    let list = cards ?? [];
    if (quickFilter === 'my-leases') {
      list = list.filter((c) => c.lease && c.lease.until > Date.now() && c.lease.agent === currentAgent);
    } else if (quickFilter === 'blocked') {
      list = list.filter((c) => c.blocker !== null);
    }
    if (laneFilter !== 'all') list = list.filter((c) => c.lane === laneFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.intent.toLowerCase().includes(q) ||
          c.constraints.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cards, quickFilter, laneFilter, search, currentAgent]);

  const openNewCard = (status: Card['status'] = 'inbox', lane: CardLane = laneFilter === 'all' ? 'core' : laneFilter) => {
    setNewDefaults({ status, lane });
    setEditorCard(null);
    setEditorOpen(true);
  };

  const openEditCard = (card: Card) => {
    setInspectCardId(card.id);
  };

  const quickMove = async (card: Card, direction: 1 | -1) => {
    const order: Card['status'][] = ['inbox', 'ready', 'doing', 'review', 'done'];
    const idx = order.indexOf(card.status);
    const next = order[Math.min(order.length - 1, Math.max(0, idx + direction))];
    if (next === card.status) return;
    await db.cards.update(card.id, { status: next, updatedAt: Date.now(), synced: false });
  };

  const exportAll = useCallback(async () => {
    const all = (cards ?? []).filter((c) => !c.isDeleted);
    if (all.length === 0) return;
    const zip = new JSZip();
    for (const card of all) {
      zip.file(`${card.id}.md`, cardToMarkdown(card));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadFile(blob, `board-backup-${new Date().toISOString().slice(0, 10)}.zip`);
  }, [cards]);

  const importFiles = useCallback(async (files: FileList) => {
    let imported = 0;
    let skipped = 0;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.md')) {
        skipped++;
        continue;
      }
      try {
        const raw = await file.text();
        const card = markdownToCard(raw, `exo-${crypto.randomUUID()}`);
        if (!card) {
          skipped++;
          continue;
        }
        await db.cards.put(card);
        imported++;
      } catch {
        skipped++;
      }
    }
    setImportFeedback(
      imported > 0 ? `Imported ${imported} card${imported === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}` : `Nothing imported (${skipped} file${skipped === 1 ? '' : 's'} skipped)`
    );
    setTimeout(() => setImportFeedback(null), 4000);
  }, []);

  return (
    <div className="min-h-screen">
      <Header
        laneFilter={laneFilter}
        onLaneFilterChange={setLaneFilter}
        quickFilter={quickFilter}
        onQuickFilterChange={setQuickFilter}
        search={search}
        onSearchChange={setSearch}
        onNewCard={() => openNewCard()}
        onExportAll={() => void exportAll()}
        onImportFiles={(files) => void importFiles(files)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onInstall={canInstall ? () => void promptInstall() : undefined}
      />

      <main className="mx-auto w-full max-w-7xl">
        {importFeedback && (
          <div className="mx-4 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800 sm:mx-6">
            {importFeedback}
          </div>
        )}

        {cards === undefined && !ready ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" aria-label="Loading board" />
          </div>
        ) : (
          <Board
            cards={filtered}
            lanes={lanes ?? []}
            laneFilter={laneFilter}
            onEdit={openEditCard}
            onQuickMove={quickMove}
            onNewCard={openNewCard}
          />
        )}
      </main>

      {canInstall && !installed && !installBannerDismissed && (
        <div className="install-pop fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 sm:inset-x-auto sm:right-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Download className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Install Task Board</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Add to your home screen for a full-screen, offline app.</p>
          </div>
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="h-10 shrink-0 rounded-xl bg-indigo-600 px-3.5 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setInstallBannerDismissed(true)}
            aria-label="Dismiss install prompt"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {inspectCardId && inspectCard && (
        <CardInspector card={inspectCard} contacts={contacts} onClose={() => setInspectCardId(null)} />
      )}

      {editorOpen && (
        <CardEditor
          card={editorCard}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
