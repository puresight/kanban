import { useMemo, useState } from 'react';
import { CardItem } from './CardItem';
import type { Card, CardLane } from '@/db/types';
import { STATUS_LABELS, STATUS_ORDER } from '@/db/types';
import type { Lane } from '@/db/database';

const WIP_TRACKED_STATUS = 'doing';

function formatRemaining(until: number): string | undefined {
  const ms = until - Date.now();
  if (ms <= 0) return undefined;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

interface BoardProps {
  cards: Card[];
  lanes: Lane[];
  laneFilter: CardLane | 'all';
  onEdit: (card: Card) => void;
  onQuickMove: (card: Card, direction: 1 | -1) => void;
  onNewCard: (status: Card['status'], lane: CardLane) => void;
}

export function Board({ cards, lanes, laneFilter, onEdit, onQuickMove, onNewCard }: BoardProps) {
  const [mobileColumn, setMobileColumn] = useState<Card['status']>('inbox');

  const grouped = useMemo(() => {
    const map = new Map<Card['status'], Card[]>();
    for (const status of STATUS_ORDER) map.set(status, []);
    for (const card of cards) {
      map.get(card.status)?.push(card);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const rank = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
        if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
        return a.id.localeCompare(b.id);
      });
    }
    return map;
  }, [cards]);

  const laneLimit = (lane: CardLane) => lanes.find((l) => l.lane === lane)?.wipLimit ?? null;

  return (
    <>
      {/* Mobile: segmented column switcher */}
      <div className="no-scrollbar sticky top-[116px] z-20 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100/95 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setMobileColumn(status)}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
              mobileColumn === status
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'
            }`}
          >
            {STATUS_LABELS[status]}
            <span
              className={`rounded-full px-1.5 text-[10px] font-semibold ${
                mobileColumn === status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {grouped.get(status)?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Mobile: single visible column */}
      <div className="px-3 py-3 md:hidden">
        <Column
          status={mobileColumn}
          cards={grouped.get(mobileColumn) ?? []}
          laneFilter={laneFilter}
          laneLimit={laneLimit}
          onEdit={onEdit}
          onQuickMove={onQuickMove}
          onNewCard={onNewCard}
        />
      </div>

      {/* Desktop: full grid */}
      <div className="hidden md:grid md:grid-cols-5 md:gap-4 md:px-6 md:py-4">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            cards={grouped.get(status) ?? []}
            laneFilter={laneFilter}
            laneLimit={laneLimit}
            onEdit={onEdit}
            onQuickMove={onQuickMove}
            onNewCard={onNewCard}
          />
        ))}
      </div>
    </>
  );
}

function Column({
  status,
  cards,
  laneFilter,
  laneLimit,
  onEdit,
  onQuickMove,
  onNewCard,
}: {
  status: Card['status'];
  cards: Card[];
  laneFilter: CardLane | 'all';
  laneLimit: (lane: CardLane) => number | null;
  onEdit: (card: Card) => void;
  onQuickMove: (card: Card, direction: 1 | -1) => void;
  onNewCard: (status: Card['status'], lane: CardLane) => void;
}) {
  const isDoing = status === WIP_TRACKED_STATUS;

  // WIP accounting: when a single lane is shown, compare against that lane's limit.
  // When all lanes are shown, compare against the sum of all limits.
  const wipInfo = useMemo(() => {
    if (!isDoing) return null;
    const targetLanes: CardLane[] = laneFilter === 'all' ? ['core', 'sandbox', 'docs'] : [laneFilter];
    const limit = targetLanes.reduce((sum, lane) => sum + (laneLimit(lane) ?? 0), 0);
    const count = cards.length;
    return { count, limit, over: count > limit, at: count === limit };
  }, [isDoing, cards, laneFilter, laneLimit]);

  const headerAccent = wipInfo
    ? wipInfo.over
      ? 'border-t-red-500 bg-gradient-to-b from-red-50 to-transparent dark:from-red-950/40'
      : wipInfo.at
        ? 'border-t-amber-500 bg-gradient-to-b from-amber-50 to-transparent dark:from-amber-950/40'
        : 'border-t-indigo-400 bg-gradient-to-b from-indigo-50 to-transparent dark:from-indigo-950/30'
    : 'border-t-slate-300 dark:border-t-slate-700';

  return (
    <section
      className={`flex min-h-0 flex-col rounded-2xl border border-t-4 border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40 ${headerAccent}`}
    >
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{STATUS_LABELS[status]}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            wipInfo?.over
              ? 'bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-950 dark:text-red-300 dark:ring-red-800'
              : wipInfo?.at
                ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800'
                : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {wipInfo ? `${wipInfo.count}/${wipInfo.limit}` : cards.length}
        </span>
      </header>

      {wipInfo?.over && (
        <p className="mx-3 mb-2 rounded-lg bg-red-100 px-2 py-1.5 text-[11px] font-semibold text-red-800 ring-1 ring-red-300 dark:bg-red-950 dark:text-red-300 dark:ring-red-800">
          WIP limit exceeded ({wipInfo.count}/{wipInfo.limit}) — finish work before pulling more.
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">No cards</p>
            <button
              type="button"
              onClick={() => onNewCard(status, laneFilter === 'all' ? 'core' : laneFilter)}
              className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              + Add a card
            </button>
          </div>
        ) : (
          cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onEdit={onEdit}
              onQuickMove={onQuickMove}
              leaseRemaining={card.lease ? formatRemaining(card.lease.until) : undefined}
            />
          ))
        )}
      </div>
    </section>
  );
}
