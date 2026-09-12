/**
 * Authenticated encryption at rest (AES-256-GCM) for sensitive local payloads.
 * Key material is device-local; Electron main can also wrap via safeStorage when available.
 */

const META_KEY = 'studyos_secure_meta_v1';
const ENC_PREFIX = 'enc:v1:';

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

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(META_KEY);
  if (existing) {
    try {
      const raw = fromB64(existing);
      return crypto.subtle.importKey('raw', raw as unknown as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
    } catch {
      /* regenerate */
    }
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(META_KEY, toB64(exported));
  return key;
}

export async function encryptString(plain: string): Promise<string> {
  if (typeof plain !== 'string') throw new Error('encryptString: string required');
  // Prefer Electron OS keychain when available
  try {
    const desk = (window as unknown as { studyosDesktop?: { encryptSecure?: (s: string) => Promise<string | null> } }).studyosDesktop;
    if (desk?.encryptSecure) {
      const wrapped = await desk.encryptSecure(plain);
      if (wrapped) return ENC_PREFIX + 'os:' + wrapped;
    }
  } catch {
    /* fall through */
  }
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain)
  );
  return ENC_PREFIX + 'gcm:' + toB64(iv) + ':' + toB64(cipher);
}

export async function decryptString(payload: string): Promise<string> {
  if (typeof payload !== 'string' || !payload.startsWith(ENC_PREFIX)) {
    // Plaintext legacy — return as-is for migration
    return payload;
  }
  const rest = payload.slice(ENC_PREFIX.length);
  if (rest.startsWith('os:')) {
    const desk = (window as unknown as { studyosDesktop?: { decryptSecure?: (s: string) => Promise<string | null> } }).studyosDesktop;
    if (!desk?.decryptSecure) throw new Error('OS secure storage unavailable');
    const out = await desk.decryptSecure(rest.slice(3));
    if (out == null) throw new Error('decrypt failed');
    return out;
  }
  if (rest.startsWith('gcm:')) {
    const parts = rest.slice(4).split(':');
    if (parts.length !== 2) throw new Error('malformed ciphertext');
    const iv = fromB64(parts[0]!);
    const data = fromB64(parts[1]!);
    const key = await getOrCreateKey();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, data as unknown as BufferSource);
    return new TextDecoder().decode(plain);
  }
  throw new Error('unknown encryption scheme');
}

export function isEncryptedPayload(v: string): boolean {
  return typeof v === 'string' && v.startsWith(ENC_PREFIX);
}

/** Encrypt JSON object; integrity via GCM auth tag */
export async function encryptJSON(obj: unknown): Promise<string> {
  return encryptString(JSON.stringify(obj));
}

export async function decryptJSON<T = unknown>(payload: string): Promise<T> {
  const plain = await decryptString(payload);
  return JSON.parse(plain) as T;
}

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(`studyos_sec_${key}`);
  } catch {
    return null;
  }
}

export function setItem(key: string, val: string): void {
  try {
    localStorage.setItem(`studyos_sec_${key}`, val);
  } catch (e) {
    console.warn('Failed to save to local storage:', e);
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(`studyos_sec_${key}`);
  } catch (e) {
    console.warn('Failed to remove from local storage:', e);
  }
}

export function clear(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('studyos_sec_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Failed to clear secure storage:', e);
  }
}

export const secureStorage = {
  encryptString,
  decryptString,
  encryptJSON,
  decryptJSON,
  isEncryptedPayload,
  getItem,
  setItem,
  removeItem,
  clear,
};
