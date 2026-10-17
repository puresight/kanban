export interface Contact {
  id: string;
  name: string;
}

export function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatDueLabel(dueAt: number, now = Date.now()): { text: string; tone: 'past' | 'soon' | 'future' } {
  const diffMs = dueAt - now;
  const days = Math.floor(Math.abs(diffMs) / 86_400_000);
  const hours = Math.floor(Math.abs(diffMs) / 3_600_000);
  if (diffMs < 0) {
    return { text: days > 0 ? `Overdue by ${days}d` : `Overdue by ${hours}h`, tone: 'past' };
  }
  if (days === 0) {
    return { text: hours <= 1 ? 'Due now' : `Due in ${hours}h`, tone: 'soon' };
  }
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon' };
  if (days <= 3) return { text: `Due in ${days} days`, tone: 'soon' };
  return { text: `Due in ${days} days`, tone: 'future' };
}
