import { useEffect, useRef, useState } from 'react';
import { Download as DownloadIcon, FolderUp, Monitor, Moon, MoreVertical, Plus, Smartphone, Sun } from 'lucide-react';
import type { ThemeMode } from '@/hooks/useTheme';
import type { CardLane } from '@/db/types';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'System', icon: Monitor },
];

export type QuickFilter = 'all' | 'my-leases' | 'blocked';

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'my-leases', label: 'My Leases' },
  { id: 'blocked', label: 'Blocked' },
];

const LANE_TABS: { id: CardLane | 'all'; label: string }[] = [
  { id: 'all', label: 'All Lanes' },
  { id: 'core', label: 'Core' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'docs', label: 'Docs' },
];

interface HeaderProps {
  laneFilter: CardLane | 'all';
  onLaneFilterChange: (lane: CardLane | 'all') => void;
  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onNewCard: () => void;
  onExportAll: () => void;
  onImportFiles: (files: FileList) => void;
  onInstall?: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export function Header({
  laneFilter,
  onLaneFilterChange,
  quickFilter,
  onQuickFilterChange,
  search,
  onSearchChange,
  onNewCard,
  onExportAll,
  onImportFiles,
  onInstall,
  themeMode,
  onThemeModeChange,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importZoneRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  useEffect(() => {
    const zone = importZoneRef.current;
    if (!zone) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) setDragActive(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer?.files.length) onImportFiles(e.dataTransfer.files);
    };
    zone.addEventListener('dragover', onDragOver);
    zone.addEventListener('dragleave', onDragLeave);
    zone.addEventListener('drop', onDrop);
    return () => {
      zone.removeEventListener('dragover', onDragOver);
      zone.removeEventListener('dragleave', onDragLeave);
      zone.removeEventListener('drop', onDrop);
    };
  }, [onImportFiles]);

  return (
    <div ref={importZoneRef}>
      {dragActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/70 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-white/10 px-10 py-8 text-center">
            <FolderUp className="mx-auto h-10 w-10 text-indigo-200" aria-hidden />
            <p className="mt-3 text-lg font-semibold text-white">Drop .md files to import cards</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Task <span className="text-indigo-600 dark:text-indigo-400">Board</span>
            </h1>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onNewCard}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.97]"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">New Card</span>
                <span className="sm:hidden">New</span>
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Board menu"
                  aria-expanded={menuOpen}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <MoreVertical className="h-4 w-4" aria-hidden />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-12 z-40 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onExportAll();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <DownloadIcon className="h-4 w-4" aria-hidden /> Export All Cards (.zip)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <FolderUp className="h-4 w-4" aria-hidden /> Import Cards (.md)
                    </button>
                    {onInstall && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onInstall();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Smartphone className="h-4 w-4" aria-hidden /> Install App
                      </button>
                    )}
                  </div>
                )}
              </div>

              <ThemeToggle mode={themeMode} onChange={onThemeModeChange} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search titles, IDs, intent…"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {QUICK_FILTERS.map((f) => (
              <Chip key={f.id} active={quickFilter === f.id} onClick={() => onQuickFilterChange(f.id)}>
                {f.label}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-slate-200 dark:bg-slate-700" aria-hidden />
            {LANE_TABS.map((t) => (
              <Chip key={t.id} active={laneFilter === t.id} onClick={() => onLaneFilterChange(t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,text/markdown"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onImportFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium ring-1 transition ${
        active
          ? 'bg-indigo-600 text-white ring-indigo-600'
          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function ThemeToggle({ mode, onChange }: { mode: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
    >
      {THEME_OPTIONS.map(({ mode: m, label, icon: Icon }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => onChange(m)}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
              active
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
