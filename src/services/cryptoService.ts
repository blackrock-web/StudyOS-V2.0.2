/**
 * StudyOS Crypto Service — Web Crypto PBKDF2-SHA-256 (offline, no custom crypto).
 * Format: pbkdf2$sha256$iterations$saltB64$hashB64
 * Legacy hashes (argon2_v1_*) are detected for one-time migration on successful login.
 */

const LEGACY_PREFIX = 'argon2_v1_';
const SCHEME = 'pbkdf2';
const DIGEST = 'sha256';
const DEFAULT_ITERATIONS = 310_000; // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // still walk to reduce timing signal on length
    let x = 0;
    for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ 0;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Legacy djb2-style hash (INSECURE) — only for migration verification. */
export function legacyHashString(str: string): string {
  if (!str) return '00000000';
  const salt = 'amanager_secure_offline_salt_2026';
  let hash = 5381;
  const combined = salt + str + salt;
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 33) ^ combined.charCodeAt(i);
      hash = hash & hash;
    }
  }
  return LEGACY_PREFIX + Math.abs(hash).toString(16) + '_' + str.length;
}

export function isLegacyHash(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith(LEGACY_PREFIX);
}

export function isModernHash(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith(SCHEME + '$');
}

export async function hashSecret(
  secret: string,
  options?: { iterations?: number; salt?: Uint8Array }
): Promise<string> {
  if (!secret || typeof secret !== 'string') {
    throw new Error('hashSecret: secret required');
  }
  const iterations = options?.iterations ?? DEFAULT_ITERATIONS;
  const salt =
    options?.salt ??
    (typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(SALT_BYTES))
      : (() => {
          const s = new Uint8Array(SALT_BYTES);
          for (let i = 0; i < SALT_BYTES; i++) s[i] = Math.floor(Math.random() * 256);
          return s;
        })());

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_BYTES * 8
  );

  return [
    SCHEME,
    DIGEST,
    String(iterations),
    toB64(salt),
    toB64(derived),
  ].join('$');
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  if (!secret || !stored) return false;

  // Modern PBKDF2
  if (isModernHash(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 5) return false;
    const iterations = parseInt(parts[2]!, 10);
    if (!Number.isFinite(iterations) || iterations < 1000) return false;
    let salt: Uint8Array;
    try {
      salt = fromB64(parts[3]!);
    } catch {
      return false;
    }
    const candidate = await hashSecret(secret, { iterations, salt });
    return timingSafeEqual(candidate, stored);
  }

  // Legacy migration path
  if (isLegacyHash(stored)) {
    const legacy = legacyHashString(secret);
    return timingSafeEqual(legacy, stored);
  }

  return false;
}

/** Secure random UUID */
export function secureUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const cryptoService = {
  hashSecret,
  verifySecret,
  isLegacyHash,
  isModernHash,
  legacyHashString,
  secureUUID,
  DEFAULT_ITERATIONS,
};
