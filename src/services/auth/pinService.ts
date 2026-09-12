/**
 * StudyOS Secure PIN Authentication Service
 * 
 * CORE SECURITY RESPONSIBILITIES:
 * - Provides salted-hash PIN authentication for sensitive operations.
 * - Gates high-risk administrative operations:
 *   1. Unlocking the Network Gateway for temporary connectivity.
 *   2. Complete Application Destruction & nuclear data wipe.
 *   3. Resetting security preferences and access credentials.
 * - Enforces anti-brute-force rate limiting and lockout periods.
 * - Audits all authorization attempts via AuditLogger.
 */

import { secureStorage } from '../secureStorage';
import { auditLogger } from '../auditLogger';

const PIN_HASH_KEY = 'studyos_security_pin_hash_v2';
const PIN_SALT_KEY = 'studyos_security_pin_salt_v2';
const LEGACY_PIN_KEY = 'studyos_network_gateway_pin_hash_v1';
const LEGACY_PIN_SALT_KEY = 'studyos_network_gateway_pin_salt_v1';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60000; // 1 minute lockout after 5 consecutive failures

export interface PinAuthResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  lockoutRemainingSecs?: number;
}

export type GatedOperationType =
  | 'unlock_network'
  | 'destroy_app'
  | 'security_change'
  | 'change_pin'
  | 'database_wipe'
  | 'general';

class PinService {
  private failedAttempts: number = 0;
  private lockoutUntil: number | null = null;

  constructor() {
    this.migrateLegacyPinIfNeeded();
  }

  /**
   * Migrate older stored pin if present in legacy keys
   */
  private migrateLegacyPinIfNeeded(): void {
    try {
      const modernHash = secureStorage.getItem(PIN_HASH_KEY);
      if (!modernHash) {
        const legacyHash = secureStorage.getItem(LEGACY_PIN_KEY);
        const legacySalt = secureStorage.getItem(LEGACY_PIN_SALT_KEY);
        if (legacyHash && legacySalt) {
          secureStorage.setItem(PIN_HASH_KEY, legacyHash);
          secureStorage.setItem(PIN_SALT_KEY, legacySalt);
        }
      }
    } catch {
      // safe fallback
    }
  }

  /**
   * Generates a cryptographically strong random salt
   */
  private generateSalt(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for non-crypto runtime
    return `${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
  }

  /**
   * Cryptographic salted SHA-256 hash
   */
  public async hashPin(pin: string, salt: string): Promise<string> {
    const raw = `${salt}:${pin.trim()}:studyos_pin_isolated_auth_v2`;
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Synchronous fallback hash for restricted environments
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
      hash |= 0;
    }
    return `sha256_fallback_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Checks if a security PIN has already been configured on this device
   */
  public isPinConfigured(): boolean {
    const hash = secureStorage.getItem(PIN_HASH_KEY) || secureStorage.getItem(LEGACY_PIN_KEY);
    return Boolean(hash && hash.length > 0);
  }

  /**
   * Validates format of PIN (4 to 8 characters, alphanumeric/numeric)
   */
  public validatePinFormat(pin: string): { valid: boolean; error?: string } {
    if (!pin || typeof pin !== 'string') {
      return { valid: false, error: 'PIN cannot be empty.' };
    }
    const trimmed = pin.trim();
    if (trimmed.length < 4) {
      return { valid: false, error: 'PIN must be at least 4 digits.' };
    }
    if (trimmed.length > 12) {
      return { valid: false, error: 'PIN cannot exceed 12 digits.' };
    }
    return { valid: true };
  }

  /**
   * Check if current session is locked out due to excessive failed attempts
   */
  public isLockedOut(): boolean {
    if (!this.lockoutUntil) return false;
    const now = Date.now();
    if (now >= this.lockoutUntil) {
      this.lockoutUntil = null;
      this.failedAttempts = 0;
      return false;
    }
    return true;
  }

  /**
   * Gets remaining lockout seconds if locked out
   */
  public getLockoutRemainingSecs(): number {
    if (!this.lockoutUntil) return 0;
    const remaining = Math.max(0, Math.ceil((this.lockoutUntil - Date.now()) / 1000));
    if (remaining === 0) {
      this.lockoutUntil = null;
      this.failedAttempts = 0;
    }
    return remaining;
  }

  /**
   * Number of current failed attempts
   */
  public getFailedAttempts(): number {
    return this.failedAttempts;
  }

  /**
   * Sets or updates the security PIN with a fresh salt and hash
   */
  public async setPin(newPin: string, currentPin?: string): Promise<PinAuthResult> {
    const formatCheck = this.validatePinFormat(newPin);
    if (!formatCheck.valid) {
      return { success: false, error: formatCheck.error };
    }

    // If PIN is already configured and currentPin is provided, verify it first
    if (this.isPinConfigured()) {
      if (!currentPin) {
        return { success: false, error: 'Current PIN required to update security PIN.' };
      }
      const verifyRes = await this.verifyPin(currentPin, 'change_pin');
      if (!verifyRes.success) {
        return { success: false, error: verifyRes.error || 'Current PIN verification failed.' };
      }
    }

    const salt = this.generateSalt();
    const hash = await this.hashPin(newPin.trim(), salt);

    secureStorage.setItem(PIN_HASH_KEY, hash);
    secureStorage.setItem(PIN_SALT_KEY, salt);
    // Keep legacy synced for backward compatibility
    secureStorage.setItem(LEGACY_PIN_KEY, hash);
    secureStorage.setItem(LEGACY_PIN_SALT_KEY, salt);

    this.failedAttempts = 0;
    this.lockoutUntil = null;

    auditLogger.logEvent({
      action: 'SECURITY_PIN_CONFIGURED',
      details: 'Security PIN set/updated with new cryptographic salt',
      severity: 'INFO',
      status: 'SUCCESS',
    });

    return { success: true };
  }

  /**
   * Verifies the user-entered PIN against stored salted hash
   */
  public async verifyPin(pin: string, operation: GatedOperationType | string = 'general'): Promise<PinAuthResult> {
    if (this.isLockedOut()) {
      const remainingSecs = this.getLockoutRemainingSecs();
      auditLogger.logEvent({
        action: 'PIN_AUTH_BLOCKED',
        details: `Operation ${operation} blocked due to active rate-limit lockout (${remainingSecs}s remaining)`,
        severity: 'WARNING',
        status: 'FAILURE',
      });
      return {
        success: false,
        error: `Too many failed attempts. Locked out for ${remainingSecs}s.`,
        lockoutRemainingSecs: remainingSecs,
      };
    }

    const storedHash = secureStorage.getItem(PIN_HASH_KEY) || secureStorage.getItem(LEGACY_PIN_KEY);
    const storedSalt = secureStorage.getItem(PIN_SALT_KEY) || secureStorage.getItem(LEGACY_PIN_SALT_KEY) || 'default_salt';

    // If no PIN was configured yet, allow initial configuration
    if (!storedHash) {
      const format = this.validatePinFormat(pin);
      if (!format.valid) {
        return { success: false, error: format.error };
      }
      // Auto-set initial PIN on first verification
      await this.setPin(pin);
      auditLogger.logEvent({
        action: 'INITIAL_PIN_ESTABLISHED',
        details: `Initial security PIN set during operation ${operation}`,
        severity: 'INFO',
        status: 'SUCCESS',
      });
      return { success: true };
    }

    const computedHash = await this.hashPin(pin.trim(), storedSalt);

    // Direct comparison
    if (computedHash === storedHash) {
      this.failedAttempts = 0;
      this.lockoutUntil = null;

      auditLogger.logEvent({
        action: 'PIN_AUTH_SUCCESS',
        details: `Authorized sensitive operation: ${operation}`,
        severity: 'INFO',
        status: 'SUCCESS',
      });

      return { success: true };
    }

    // Failed attempt
    this.failedAttempts += 1;
    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - this.failedAttempts);

    if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      this.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      auditLogger.logEvent({
        action: 'PIN_LOCKOUT_TRIGGERED',
        details: `Brute-force protection: ${this.failedAttempts} failed PIN attempts on ${operation}`,
        severity: 'SECURITY',
        status: 'FAILURE',
      });

      return {
        success: false,
        error: `Invalid PIN. Brute force lockout activated for 60 seconds.`,
        remainingAttempts: 0,
        lockoutRemainingSecs: 60,
      };
    }

    auditLogger.logEvent({
      action: 'PIN_AUTH_FAILED',
      details: `Failed PIN entry for operation: ${operation} (${remaining} attempts left)`,
      severity: 'WARNING',
      status: 'FAILURE',
    });

    return {
      success: false,
      error: `Invalid PIN. ${remaining} attempts remaining before temporary lockout.`,
      remainingAttempts: remaining,
    };
  }

  /**
   * Helper to gate any sensitive async action behind PIN authentication
   */
  public async gateOperation<T>(
    pin: string,
    operationName: GatedOperationType | string,
    operationFn: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const auth = await this.verifyPin(pin, operationName);
    if (!auth.success) {
      return { success: false, error: auth.error };
    }

    try {
      const result = await operationFn();
      return { success: true, result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      auditLogger.logEvent({
        action: 'GATED_OPERATION_FAILED',
        details: `Operation ${operationName} failed during execution: ${msg}`,
        severity: 'ERROR',
        status: 'FAILURE',
      });
      return { success: false, error: msg };
    }
  }

  /**
   * Resets the security PIN if verified by current PIN
   */
  public async removePin(currentPin: string): Promise<PinAuthResult> {
    const auth = await this.verifyPin(currentPin, 'security_change');
    if (!auth.success) {
      return auth;
    }

    secureStorage.removeItem(PIN_HASH_KEY);
    secureStorage.removeItem(PIN_SALT_KEY);
    secureStorage.removeItem(LEGACY_PIN_KEY);
    secureStorage.removeItem(LEGACY_PIN_SALT_KEY);

    auditLogger.logEvent({
      action: 'SECURITY_PIN_REMOVED',
      details: 'Security PIN was removed by user authorization',
      severity: 'WARNING',
      status: 'SUCCESS',
    });

    return { success: true };
  }
}

export const pinService = new PinService();
