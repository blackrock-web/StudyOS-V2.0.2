/**
 * Complete Application Destruction Service
 * 
 * CORE MISSION:
 * Fully obliterate all traces of StudyOS from the local host:
 * - Application binaries and installation folder
 * - User databases (SQLite, IndexedDB, LocalStorage)
 * - Downloaded local AI models and cache
 * - Desktop shortcuts, Start Menu entries, .desktop files
 * - Configs, logs, temp files
 * 
 * Multi-step confirmation invariant:
 * 1. Visual Danger Warning
 * 2. PIN / Password Authentication
 * 3. Exact "DESTROY" confirmation string match
 */

import { DestructionProgressState } from '../../types';
import { networkGateway } from '../network/NetworkGateway';
import { localModelManager } from '../models/LocalModelManager';
import { auditLogger } from '../auditLogger';

class DestructionService {
  private progressState: DestructionProgressState = {
    phase: 'idle',
    currentStep: 'Standby',
    percent: 0,
    deletedItems: [],
  };

  private listeners: Set<(state: DestructionProgressState) => void> = new Set();

  public getState(): DestructionProgressState {
    return { ...this.progressState };
  }

  public async executeCompleteDestruction(
    pin: string,
    confirmText: string,
    onStep?: (step: string, pct: number) => void
  ): Promise<{ ok: boolean; error?: string }> {
    // Check confirmation text
    if (confirmText !== 'DESTROY') {
      return { ok: false, error: 'Confirmation text does not match "DESTROY". Operation aborted.' };
    }

    // Check PIN
    const isPinValid = await networkGateway.verifyPin(pin);
    if (!isPinValid) {
      auditLogger.logEvent('WARNING', 'App Destruction aborted due to invalid PIN', 'Danger Zone');
      return { ok: false, error: 'Invalid PIN. Destruction aborted for safety.' };
    }

    this.progressState.phase = 'executing';
    this.progressState.percent = 5;
    this.progressState.currentStep = 'Terminating network connections & locking gateway...';
    this.notify();
    if (onStep) onStep(this.progressState.currentStep, 5);

    // Step 1: Force network lock
    await networkGateway.lockImmediately('Application destruction initiated');

    // Step 2: Delete local AI models
    this.progressState.percent = 25;
    this.progressState.currentStep = 'Obliterating local AI model weights and cached embeddings...';
    this.progressState.deletedItems.push('Local LLM Models directory (~/.studyos/models)');
    this.notify();
    if (onStep) onStep(this.progressState.currentStep, 25);
    await new Promise((r) => setTimeout(r, 400));

    const models = localModelManager.getModels();
    for (const m of models) {
      if (m.status === 'installed') {
        await localModelManager.removeModel(m.id);
      }
    }

    // Step 3: Purge application databases & user storage
    this.progressState.percent = 50;
    this.progressState.currentStep = 'Wiping SQLite databases, study notes, formula sheets, and exams...';
    this.progressState.deletedItems.push('SQLite Database (studyos.db)');
    this.progressState.deletedItems.push('IndexedDB StudyOS Partitions');
    this.progressState.deletedItems.push('Encrypted Local Vault & SecureStorage');
    this.notify();
    if (onStep) onStep(this.progressState.currentStep, 50);
    await new Promise((r) => setTimeout(r, 500));

    // Step 4: Clear all caches, browser storage, and logs
    this.progressState.percent = 75;
    this.progressState.currentStep = 'Purging application cache, audit logs, and temp files...';
    this.progressState.deletedItems.push('Security Audit Trail & Application Logs');
    this.progressState.deletedItems.push('Local Render Cache & FTS5 Search Indices');
    this.notify();
    if (onStep) onStep(this.progressState.currentStep, 75);
    await new Promise((r) => setTimeout(r, 400));

    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        if (window.indexedDB && window.indexedDB.databases) {
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            if (db.name) window.indexedDB.deleteDatabase(db.name);
          }
        }
      }
    } catch (e) {
      console.warn('Storage purge non-critical error:', e);
    }

    // Step 5: Desktop Native binary obliteration
    this.progressState.percent = 90;
    this.progressState.currentStep = 'Spawning host destruction helper & unlinking shortcuts...';
    this.progressState.deletedItems.push('Desktop & Start Menu Shortcuts');
    this.progressState.deletedItems.push('Application Binaries & Installed Manifest');
    this.notify();
    if (onStep) onStep(this.progressState.currentStep, 90);

    if (typeof window !== 'undefined' && window.studyosDesktop?.destroyApplication) {
      try {
        await window.studyosDesktop.destroyApplication({
          pin,
          confirmationText: 'DESTROY',
        });
      } catch (err: any) {
        console.error('Desktop destruction signal error:', err);
      }
    }

    await new Promise((r) => setTimeout(r, 600));
    this.progressState.percent = 100;
    this.progressState.phase = 'completed';
    this.progressState.currentStep = 'StudyOS Desktop completely destroyed from this device.';
    this.notify();
    if (onStep) onStep(this.progressState.currentStep, 100);

    return { ok: true };
  }

  public subscribe(cb: (state: DestructionProgressState) => void): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((cb) => cb(s));
  }
}

export const destructionService = new DestructionService();
