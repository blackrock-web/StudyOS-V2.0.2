/**
 * Progressive login rate limiting + temporary account lockout (offline).
 * State is localStorage-only — no network.
 */

const STORAGE_KEY = 'studyos_auth_rate_v1';

export interface RateLimitState {
  /** username(lower) → failure records */
  failures: Record<string, { count: number; firstAt: number; lockedUntil: number }>;
  globalFailures: number;
  globalWindowStart: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const BASE_LOCK_MS = 60 * 1000; // 1 minute base
const MAX_LOCK_MS = 30 * 60 * 1000; // 30 minutes
const GLOBAL_MAX = 30; // across all usernames in window

function load(): RateLimitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { failures: {}, globalFailures: 0, globalWindowStart: Date.now() };
    const parsed = JSON.parse(raw) as RateLimitState;
    if (!parsed || typeof parsed !== 'object') {
      return { failures: {}, globalFailures: 0, globalWindowStart: Date.now() };
    }
    return {
      failures: parsed.failures || {},
      globalFailures: parsed.globalFailures || 0,
      globalWindowStart: parsed.globalWindowStart || Date.now(),
    };
  } catch {
    return { failures: {}, globalFailures: 0, globalWindowStart: Date.now() };
  }
}

function save(state: RateLimitState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — drop oldest */
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function lockDurationMs(failureCount: number): number {
  // progressive: 1m, 2m, 4m, 8m… capped
  const exp = Math.min(failureCount - MAX_ATTEMPTS, 8);
  const ms = BASE_LOCK_MS * Math.pow(2, Math.max(0, exp));
  return Math.min(ms, MAX_LOCK_MS);
}

export interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs: number;
  remainingAttempts: number;
  message?: string;
}

export function checkLoginAllowed(username: string): RateLimitCheck {
  const key = (username || '').toLowerCase().trim() || '_unknown';
  const state = load();
  const now = Date.now();

  // Reset global window
  if (now - state.globalWindowStart > WINDOW_MS) {
    state.globalFailures = 0;
    state.globalWindowStart = now;
    save(state);
  }

  if (state.globalFailures >= GLOBAL_MAX) {
    const retry = WINDOW_MS - (now - state.globalWindowStart);
    return {
      allowed: false,
      retryAfterMs: Math.max(0, retry),
      remainingAttempts: 0,
      message: 'Too many login attempts. Try again later.',
    };
  }

  const rec = state.failures[key];
  if (rec && rec.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterMs: rec.lockedUntil - now,
      remainingAttempts: 0,
      message: `Account temporarily locked. Retry in ${Math.ceil((rec.lockedUntil - now) / 1000)}s.`,
    };
  }

  // Clear stale window
  if (rec && now - rec.firstAt > WINDOW_MS) {
    delete state.failures[key];
    save(state);
    return { allowed: true, retryAfterMs: 0, remainingAttempts: MAX_ATTEMPTS };
  }

  const count = rec?.count || 0;
  return {
    allowed: true,
    retryAfterMs: 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - count),
  };
}

export function recordLoginFailure(username: string): RateLimitCheck {
  const key = (username || '').toLowerCase().trim() || '_unknown';
  const state = load();
  const now = Date.now();

  if (now - state.globalWindowStart > WINDOW_MS) {
    state.globalFailures = 0;
    state.globalWindowStart = now;
  }
  state.globalFailures += 1;

  let rec = state.failures[key];
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    rec = { count: 0, firstAt: now, lockedUntil: 0 };
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + lockDurationMs(rec.count);
  }
  state.failures[key] = rec;
  save(state);

  if (rec.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterMs: rec.lockedUntil - now,
      remainingAttempts: 0,
      message: `Too many failed attempts. Locked for ${Math.ceil((rec.lockedUntil - now) / 1000)}s.`,
    };
  }
  return {
    allowed: true,
    retryAfterMs: 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - rec.count),
    message: `Invalid credentials. ${Math.max(0, MAX_ATTEMPTS - rec.count)} attempt(s) left.`,
  };
}

export function recordLoginSuccess(username: string): void {
  const key = (username || '').toLowerCase().trim();
  if (!key) return;
  const state = load();
  delete state.failures[key];
  save(state);
}

export function clearRateLimits(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const rateLimitService = {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  clearRateLimits,
  MAX_ATTEMPTS,
};
