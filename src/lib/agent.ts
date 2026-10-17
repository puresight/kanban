const AGENT_KEY = 'kanban-current-agent';

export function getCurrentAgent(): string {
  return localStorage.getItem(AGENT_KEY) || 'user';
}

export function setCurrentAgent(agent: string): void {
  localStorage.setItem(AGENT_KEY, agent);
}

const CONTACTS_KEY = 'kanban-known-contacts';

export function getKnownContacts(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is { id: string; name: string } =>
        typeof c === 'object' && c !== null && typeof (c as { id?: unknown }).id === 'string' && typeof (c as { name?: unknown }).name === 'string'
    );
  } catch {
    return [];
  }
}

export function addKnownContact(contact: { id: string; name: string }): void {
  const existing = getKnownContacts();
  if (existing.some((c) => c.id === contact.id)) return;
  localStorage.setItem(CONTACTS_KEY, JSON.stringify([...existing, contact]));
}
