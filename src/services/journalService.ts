/**
 * Crash-safe journaling for critical writes (tasks, settings, backups).
 * Write-ahead log in localStorage; recover on startup.
 */

const JOURNAL_KEY = 'studyos_wal_v1';
const MAX_ENTRIES = 40;

export type JournalOp =
  | { op: 'set'; key: string; value: string; prev?: string | null }
  | { op: 'remove'; key: string; prev?: string | null };

export interface JournalEntry {
  id: string;
  ts: number;
  domain: 'tasks' | 'notes' | 'settings' | 'backup' | 'accounts' | 'other';
  ops: JournalOp[];
  committed: boolean;
}

function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJournal(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries.slice(-5)));
    } catch {
      /* ignore */
    }
  }
}

function secureId(): string {
  return 'j-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Begin a transaction: snapshot previous values, apply ops, mark committed.
 * On crash mid-flight, recoverPending rolls back uncommitted entries.
 */
export function runTransaction(
  domain: JournalEntry['domain'],
  mutate: () => JournalOp[]
): void {
  const ops = mutate();
  if (!ops.length) return;

  // Enrich with previous values for rollback
  const enriched: JournalOp[] = ops.map((op) => {
    if (op.op === 'set' || op.op === 'remove') {
      let prev: string | null = null;
      try {
        prev = localStorage.getItem(op.key);
      } catch {
        prev = null;
      }
      return { ...op, prev };
    }
    return op;
  });

  const entry: JournalEntry = {
    id: secureId(),
    ts: Date.now(),
    domain,
    ops: enriched,
    committed: false,
  };

  const journal = loadJournal();
  journal.push(entry);
  saveJournal(journal);

  try {
    for (const op of enriched) {
      if (op.op === 'set') {
        localStorage.setItem(op.key, op.value);
      } else if (op.op === 'remove') {
        localStorage.removeItem(op.key);
      }
    }
    entry.committed = true;
    // rewrite last entry as committed
    const j2 = loadJournal();
    const idx = j2.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      j2[idx] = entry;
      saveJournal(j2);
    }
  } catch (err) {
    // Rollback
    for (const op of enriched) {
      try {
        if (op.prev == null) localStorage.removeItem(op.key);
        else localStorage.setItem(op.key, op.prev);
      } catch {
        /* ignore */
      }
    }
    const j3 = loadJournal().filter((e) => e.id !== entry.id);
    saveJournal(j3);
    throw err;
  }
}

/** On app start: roll back any uncommitted journal entries */
export function recoverPendingJournals(): { rolledBack: number } {
  const journal = loadJournal();
  let rolledBack = 0;
  const remaining: JournalEntry[] = [];

  for (const entry of journal) {
    if (entry.committed) {
      remaining.push(entry);
      continue;
    }
    // Rollback incomplete transaction
    for (const op of entry.ops || []) {
      try {
        if (op.prev == null) localStorage.removeItem(op.key);
        else localStorage.setItem(op.key, op.prev);
      } catch {
        /* ignore */
      }
    }
    rolledBack++;
  }

  // Keep only recent committed for audit; drop rolled-back
  saveJournal(remaining.slice(-MAX_ENTRIES));
  return { rolledBack };
}

export function getJournalStats(): { total: number; uncommitted: number } {
  const j = loadJournal();
  return {
    total: j.length,
    uncommitted: j.filter((e) => !e.committed).length,
  };
}

export const journalService = {
  runTransaction,
  recoverPendingJournals,
  getJournalStats,
};
