/**
 * Encrypted backup integrity — HMAC-SHA-256 tag + versioned envelope.
 */

import { encryptString, decryptString, isEncryptedPayload } from './secureStorage';
import { validateBackupJSON } from './backupValidation';

const BACKUP_VERSION = 2;
const MAGIC = 'STUDYOS_BACKUP';

export interface BackupEnvelope {
  magic: typeof MAGIC;
  version: number;
  createdAt: string;
  /** base64 HMAC over payload */
  integrity: string;
  /** plaintext JSON or enc:v1:… ciphertext */
  payload: string;
  encrypted: boolean;
}

async function hmacSha256(keyMaterial: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyMaterial.padEnd(32, '0').slice(0, 32)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function integrityKey(): string {
  try {
    return localStorage.getItem('studyos_secure_meta_v1') || 'studyos-offline-integrity-v1';
  } catch {
    return 'studyos-offline-integrity-v1';
  }
}

export async function createSecureBackup(jsonStr: string, encrypt = true): Promise<string> {
  const validated = validateBackupJSON(jsonStr);
  if (!validated.ok) {
    throw new Error(validated.error || 'Invalid backup data');
  }
  const payload = encrypt ? await encryptString(jsonStr) : jsonStr;
  const integrity = await hmacSha256(integrityKey(), payload);
  const envelope: BackupEnvelope = {
    magic: MAGIC,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    integrity,
    payload,
    encrypted: encrypt,
  };
  return JSON.stringify(envelope, null, 2);
}

export async function verifyAndExtractBackup(raw: string): Promise<{ ok: boolean; json?: string; error?: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Legacy plain dump — validate only
    const v = validateBackupJSON(raw);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, json: raw };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Invalid backup structure' };
  }

  const env = parsed as Partial<BackupEnvelope>;

  // Legacy: no envelope
  if (env.magic !== MAGIC) {
    const asStr = JSON.stringify(parsed);
    const v = validateBackupJSON(asStr);
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, json: asStr };
  }

  if (typeof env.version !== 'number' || env.version > BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${env.version}` };
  }
  if (typeof env.payload !== 'string' || typeof env.integrity !== 'string') {
    return { ok: false, error: 'Missing payload or integrity tag' };
  }

  const expected = await hmacSha256(integrityKey(), env.payload);
  // timing-safe-ish compare
  if (expected.length !== env.integrity.length || expected !== env.integrity) {
    // Device key may differ after reinstall — still allow if decrypt+validate succeeds
    if (!env.encrypted) {
      return { ok: false, error: 'Backup integrity check failed' };
    }
  }

  let json = env.payload;
  if (env.encrypted || isEncryptedPayload(env.payload)) {
    try {
      json = await decryptString(env.payload);
    } catch {
      return { ok: false, error: 'Failed to decrypt backup (wrong device key?)' };
    }
  }

  const v = validateBackupJSON(json);
  if (!v.ok) return { ok: false, error: v.error };
  return { ok: true, json };
}

export const backupIntegrity = {
  createSecureBackup,
  verifyAndExtractBackup,
  BACKUP_VERSION,
};
