/**
 * Strict backup import validation — size, depth, type, allowlist keys.
 * Prevents prototype pollution and malformed payload corruption.
 */

export const BACKUP_LIMITS = {
  maxBytes: 25 * 1024 * 1024, // 25 MB
  maxDepth: 12,
  maxArrayLength: 50_000,
  maxObjectKeys: 5_000,
  maxStringLength: 2_000_000,
} as const;

const ALLOWED_ROOT_KEYS = new Set([
  'settings',
  'exams',
  'resources',
  'lectures',
  'syllabus',
  'tasks',
  'flashcards',
  'pdfs',
  'browserLogs',
  'mockTests',
  'activityLogs',
  'scratchpadNotes',
  'projects',
  'mcqs',
  'mistakes',
  'exportedAt',
  'version',
  'schemaVersion',
]);

export interface BackupValidationResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function walk(
  value: unknown,
  depth: number,
  path: string
): string | null {
  if (depth > BACKUP_LIMITS.maxDepth) {
    return `Max depth exceeded at ${path}`;
  }
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'string') {
    if ((value as string).length > BACKUP_LIMITS.maxStringLength) {
      return `String too long at ${path}`;
    }
    return null;
  }
  if (t === 'number' || t === 'boolean') return null;
  if (t !== 'object') {
    return `Unsupported type ${t} at ${path}`;
  }
  if (Array.isArray(value)) {
    if (value.length > BACKUP_LIMITS.maxArrayLength) {
      return `Array too large at ${path}`;
    }
    for (let i = 0; i < value.length; i++) {
      const err = walk(value[i], depth + 1, `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (!isPlainObject(value)) {
    // Reject Date, Map, objects with null prototype pollution vectors that aren't plain
    // Allow only plain objects
    try {
      const keys = Object.keys(value as object);
      if (keys.length > BACKUP_LIMITS.maxObjectKeys) {
        return `Too many keys at ${path}`;
      }
      for (const k of keys) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
          return `Forbidden key "${k}" at ${path}`;
        }
        const err = walk((value as Record<string, unknown>)[k], depth + 1, `${path}.${k}`);
        if (err) return err;
      }
      return null;
    } catch {
      return `Invalid object at ${path}`;
    }
  }
  const keys = Object.keys(value);
  if (keys.length > BACKUP_LIMITS.maxObjectKeys) {
    return `Too many keys at ${path}`;
  }
  for (const k of keys) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      return `Forbidden key "${k}" at ${path}`;
    }
    const err = walk(value[k], depth + 1, `${path}.${k}`);
    if (err) return err;
  }
  return null;
}

/**
 * Parse and validate a backup JSON string. Returns sanitized plain data or error.
 */
export function validateBackupJSON(jsonStr: string): BackupValidationResult {
  if (typeof jsonStr !== 'string') {
    return { ok: false, error: 'Backup must be a string' };
  }
  if (jsonStr.length > BACKUP_LIMITS.maxBytes) {
    return { ok: false, error: `Backup exceeds ${BACKUP_LIMITS.maxBytes} byte limit` };
  }
  if (!jsonStr.trim()) {
    return { ok: false, error: 'Empty backup' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: 'Corrupted JSON — parse failed' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'Backup root must be a plain object' };
  }

  // Reject unknown root keys (strict allowlist)
  for (const key of Object.keys(parsed)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return { ok: false, error: `Forbidden root key: ${key}` };
    }
    if (!ALLOWED_ROOT_KEYS.has(key)) {
      return { ok: false, error: `Unknown backup property rejected: ${key}` };
    }
  }

  const walkErr = walk(parsed, 0, 'root');
  if (walkErr) {
    return { ok: false, error: walkErr };
  }

  // Soft schema: array fields must be arrays when present
  const arrayFields = [
    'exams',
    'resources',
    'lectures',
    'syllabus',
    'tasks',
    'flashcards',
    'pdfs',
    'browserLogs',
    'mockTests',
    'activityLogs',
    'scratchpadNotes',
    'projects',
    'mcqs',
    'mistakes',
  ];
  for (const f of arrayFields) {
    if (f in parsed && parsed[f] !== undefined && !Array.isArray(parsed[f])) {
      return { ok: false, error: `Field "${f}" must be an array` };
    }
  }
  if (parsed.settings !== undefined && parsed.settings !== null && !isPlainObject(parsed.settings)) {
    return { ok: false, error: 'Field "settings" must be an object' };
  }

  // Duplicate id detection for tasks
  if (Array.isArray(parsed.tasks)) {
    const ids = new Set<string>();
    for (const t of parsed.tasks as { id?: string }[]) {
      if (t && typeof t === 'object' && typeof t.id === 'string') {
        if (ids.has(t.id)) {
          return { ok: false, error: `Duplicate task id: ${t.id}` };
        }
        ids.add(t.id);
      }
    }
  }

  return { ok: true, data: parsed };
}
