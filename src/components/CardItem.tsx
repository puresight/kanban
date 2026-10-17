import type { Card, CardLane } from '@/db/types';
import { LANE_LABELS, PRIORITY_LABELS } from '@/db/types';
import { cardStem } from '@/db/ulid';

const PRIORITY_STYLES: Record<Card['priority'], string> = {
  low: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  medium: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900',
  high: 'bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-900',
  urgent: 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900',
};

const LANE_STYLES: Record<CardLane, string> = {
  core: 'bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900',
  sandbox: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  docs: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
};

interface CardItemProps {
  card: Card;
  onEdit: (card: Card) => void;
  onQuickMove: (card: Card, direction: 1 | -1) => void;
  leaseRemaining?: string;
}

export function CardItem({ card, onEdit, onQuickMove, leaseRemaining }: CardItemProps) {
  return (
    <article className="card-pop group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
      <button type="button" onClick={() => onEdit(card)} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 rounded-xl">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{cardStem(card.id)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${PRIORITY_STYLES[card.priority]}`}>
            {PRIORITY_LABELS[card.priority]}
          </span>
        </div>

        <h3 className="mt-1.5 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">{card.title}</h3>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${LANE_STYLES[card.lane]}`}>
            {LANE_LABELS[card.lane]}
          </span>
          {card.notes.length > 0 && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{card.notes.length} note{card.notes.length > 1 ? 's' : ''}</span>
          )}
        </div>

        {card.lease && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-900">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            Leased: {card.lease.agent}
            {leaseRemaining ? ` (expires in ${leaseRemaining})` : ''}
          </div>
        )}

        {card.blocker && (
          <div className="blocker-pulse mt-2 rounded-lg bg-amber-100 px-2 py-1.5 text-[11px] font-semibold leading-snug text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800">
            [BLOCKED by {card.blocker.by}]: {card.blocker.reason}
          </div>
        )}
      </button>

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 opacity-100 transition dark:border-slate-800 md:opacity-0 md:group-hover:opacity-100">
        <QuickArrow direction={-1} disabled={card.status === 'inbox'} onClick={() => onQuickMove(card, -1)} />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {card.status}
        </span>
        <QuickArrow direction={1} disabled={card.status === 'done'} onClick={() => onQuickMove(card, 1)} />
      </div>
    </article>
  );
}

function QuickArrow({ direction, disabled, onClick }: { direction: 1 | -1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direction === 1 ? 'Move card forward' : 'Move card back'}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
        {direction === 1 ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        )}
      </svg>
    </button>
  );
}
