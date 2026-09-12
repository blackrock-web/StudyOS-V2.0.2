/**
 * StudyOS Central Network Access Manager (Network Gateway Pattern)
 * 
 * CORE SECURITY INVARIANTS:
 * 1. Default State: LOCKED (100% offline, zero network sockets).
 * 2. Scope-Restricted: External access is ONLY granted for:
 *    - 'update': Official GitHub Releases for app binaries.
 *    - 'model-download': Explicitly authorized local GGUF AI models.
 * 3. PIN-Gated Authorization: Uses pinService (salted hash) to authenticate unlocking.
 * 4. Auto-Lock Safety: Guaranteed auto-lock upon completion or safety timeout expiry.
 * 5. Zero Telemetry: Completely blocks analytics, telemetry, and unvetted URLs.
 */

import { NetworkGatewayState, AuthorizedOperation, NetworkAccessStatus } from '../../types';
import { pinService } from '../auth/pinService';
import { auditLogger } from '../auditLogger';

export const NETWORK_ALLOWLIST = {
  update: [
    'github.com',
    'api.github.com',
    'objects.githubusercontent.com',
    'raw.githubusercontent.com',
    'github-releases.githubusercontent.com',
    'release-assets.githubusercontent.com',
    'codeload.github.com',
    'objects-origin.githubusercontent.com',
  ],
  'model-download': [
    'huggingface.co',
    'cdn-lfs.huggingface.co',
    'cdn-lfs-us-1.huggingface.co',
    'raw.githubusercontent.com',
    'localhost',
    '127.0.0.1',
  ],
};

const DEFAULT_TIMEOUT_MS = 180000; // 3 minutes safety timeout

export class NetworkAccessManager {
  private state: NetworkGatewayState = {
    status: 'LOCKED',
    authorizedOperation: 'none',
    unlockedAt: null,
    expiresAt: null,
    reason: null,
    hasConfiguredPin: false,
    activeSessionDurationSecs: 0,
  };

  private listeners: Set<(state: NetworkGatewayState) => void> = new Set();
  private autoLockTimer: NodeJS.Timeout | number | null = null;
  private durationInterval: NodeJS.Timeout | number | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.state.hasConfiguredPin = pinService.isPinConfigured();

    // Synchronize with Electron main process if available in desktop runtime
    if (typeof window !== 'undefined' && window.studyosDesktop?.getNetworkStatus) {
      window.studyosDesktop.getNetworkStatus().then((electronState) => {
        if (electronState) {
          this.state = {
            ...this.state,
            status: (electronState.status as NetworkAccessStatus) || 'LOCKED',
            authorizedOperation: (electronState.authorizedOperation as AuthorizedOperation) || 'none',
            expiresAt: electronState.expiresAt ? String(electronState.expiresAt) : null,
            hasConfiguredPin: electronState.hasConfiguredPin ?? this.state.hasConfiguredPin,
          };
          this.notify();
        }
      }).catch(() => {});

      if (window.studyosDesktop.onNetworkStatusChanged) {
        window.studyosDesktop.onNetworkStatusChanged((electronState) => {
          if (electronState) {
            this.state = {
              ...this.state,
              status: (electronState.status as NetworkAccessStatus) || 'LOCKED',
              authorizedOperation: (electronState.authorizedOperation as AuthorizedOperation) || 'none',
              expiresAt: electronState.expiresAt ? String(electronState.expiresAt) : null,
              hasConfiguredPin: electronState.hasConfiguredPin ?? this.state.hasConfiguredPin,
            };
            this.notify();
          }
        });
      }
    }
  }

  public getState(): NetworkGatewayState {
    this.state.hasConfiguredPin = pinService.isPinConfigured();
    return { ...this.state };
  }

  public isLocked(): boolean {
    return this.state.status === 'LOCKED';
  }

  public subscribe(listener: (state: NetworkGatewayState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(currentState);
      } catch (err) {
        console.error('Error in NetworkAccessManager listener:', err);
      }
    }
  }

  /**
   * Validates if a target domain is explicitly allowed for an active authorized operation
   */
  public checkUrlAllowed(url: string, operation?: AuthorizedOperation): { allowed: boolean; reason: string } {
    if (this.state.status !== 'UNLOCKED') {
      return { allowed: false, reason: 'Network Gateway is LOCKED. Zero outbound connections permitted.' };
    }

    const op = operation || this.state.authorizedOperation;
    if (op === 'none') {
      return { allowed: false, reason: 'No authorized network operation active.' };
    }

    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      const allowlist = NETWORK_ALLOWLIST[op as keyof typeof NETWORK_ALLOWLIST] || [];

      const isAllowed = allowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Domain '${hostname}' is not in the strict allowlist for ${op}.`,
        };
      }

      return { allowed: true, reason: 'Domain permitted for authorized operation.' };
    } catch {
      return { allowed: false, reason: 'Invalid destination URL.' };
    }
  }

  /**
   * Sets or changes the Network Security PIN
   */
  public async setPin(newPin: string, currentPin?: string): Promise<{ ok: boolean; error?: string }> {
    const result = await pinService.setPin(newPin, currentPin);
    if (!result.success) {
      return { ok: false, error: result.error };
    }

    this.state.hasConfiguredPin = true;
    this.notify();

    // Inform Electron main process
    if (typeof window !== 'undefined' && window.studyosDesktop?.setNetworkPin) {
      try {
        await window.studyosDesktop.setNetworkPin(newPin.trim());
      } catch (e) {
        console.warn('Failed to sync PIN with Electron main:', e);
      }
    }

    return { ok: true };
  }

  /**
   * Direct PIN verification helper
   */
  public async verifyPin(pin: string): Promise<boolean> {
    const result = await pinService.verifyPin(pin, 'unlock_network');
    return result.success;
  }

  /**
   * Requests temporary network access gated by PIN
   */
  public async requestTemporaryUnlock(
    pin: string,
    operation: AuthorizedOperation,
    reason?: string,
    durationMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<{ ok: boolean; error?: string }> {
    if (operation === 'none') {
      return { ok: false, error: 'Invalid network operation requested.' };
    }

    // Authenticate with PIN Service (salted hash)
    const authResult = await pinService.verifyPin(pin, `unlock_network:${operation}`);
    if (!authResult.success) {
      return { ok: false, error: authResult.error || 'Authentication failed' };
    }

    const now = Date.now();
    const expiresAtMs = now + durationMs;

    this.state = {
      status: 'UNLOCKED',
      authorizedOperation: operation,
      unlockedAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      reason: reason || `Authorized temporary session for ${operation}`,
      hasConfiguredPin: true,
      activeSessionDurationSecs: Math.round(durationMs / 1000),
    };

    // Forward unlock to Desktop Electron if present
    if (typeof window !== 'undefined' && window.studyosDesktop?.unlockNetworkTemporary) {
      try {
        await window.studyosDesktop.unlockNetworkTemporary({
          pin,
          operation,
          reason: this.state.reason || 'Authorized by user',
          durationMs,
        });
      } catch (e) {
        console.warn('Failed to sync network unlock with Electron:', e);
      }
    }

    this.startAutoLockTimer(durationMs);
    this.notify();

    auditLogger.logEvent({
      action: 'NETWORK_GATEWAY_UNLOCKED',
      details: `Network unlocked for ${operation}. Duration: ${Math.round(durationMs / 1000)}s. Reason: ${this.state.reason}`,
      severity: 'WARNING',
      status: 'SUCCESS',
    });

    return { ok: true };
  }

  /**
   * Called by download or update services when their authorized task completes
   */
  public async finishOperation(operation: AuthorizedOperation, reason: string = 'Operation complete'): Promise<void> {
    if (this.state.authorizedOperation === operation || this.state.status === 'UNLOCKED') {
      await this.lockImmediately(`${reason} (${operation})`);
    }
  }

  /**
   * Immediately re-locks the network gateway
   */
  public async lockImmediately(reason: string = 'Manual lock requested'): Promise<{ ok: boolean }> {
    this.clearTimers();

    this.state = {
      status: 'LOCKED',
      authorizedOperation: 'none',
      unlockedAt: null,
      expiresAt: null,
      reason: null,
      hasConfiguredPin: pinService.isPinConfigured(),
      activeSessionDurationSecs: 0,
    };

    if (typeof window !== 'undefined' && window.studyosDesktop?.lockNetworkNow) {
      try {
        await window.studyosDesktop.lockNetworkNow();
      } catch (e) {
        console.warn('Failed to sync network lock with Electron:', e);
      }
    }

    this.notify();

    auditLogger.logEvent({
      action: 'NETWORK_GATEWAY_LOCKED',
      details: `Network gateway locked. ${reason}`,
      severity: 'INFO',
      status: 'SUCCESS',
    });

    return { ok: true };
  }

  private startAutoLockTimer(durationMs: number): void {
    this.clearTimers();

    this.autoLockTimer = setTimeout(() => {
      this.lockImmediately('Auto-lock safety timeout expired');
    }, durationMs);

    this.durationInterval = setInterval(() => {
      if (this.state.expiresAt) {
        const expiryTime = new Date(this.state.expiresAt).getTime();
        const remaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
        this.state.activeSessionDurationSecs = remaining;
        if (remaining <= 0) {
          this.lockImmediately('Auto-lock session expired');
        } else {
          this.notify();
        }
      }
    }, 1000);
  }

  private clearTimers(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer as NodeJS.Timeout);
      this.autoLockTimer = null;
    }
    if (this.durationInterval) {
      clearInterval(this.durationInterval as NodeJS.Timeout);
      this.durationInterval = null;
    }
  }
}

export const networkAccessManager = new NetworkAccessManager();
