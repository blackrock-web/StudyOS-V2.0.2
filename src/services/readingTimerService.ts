/**
 * Reading Timer Service — Manages verified active reading sessions
 * 
 * Invariants:
 * - Tracks active reading time only during verified user reading.
 * - Detects background / sleep / pause states.
 * - Records verified StudySessionRecord (activityType: 'reading') in analyticsService.
 */

import { analyticsService } from './analyticsService';
import { syncService } from './syncService';
import { db, safeDispatch } from './db';

export interface ReadingSessionState {
  isRunning: boolean;
  isPaused: boolean;
  documentTitle: string;
  subject: string;
  topic?: string;
  source: 'pdf' | 'browser_reader' | 'notes';
  sessionId?: string;
  sessionStartedAt?: string;
  elapsedSecs: number;
  activeIntervals: Array<{ startMs: number; endMs: number }>;
}

type ReadingListener = (state: ReadingSessionState) => void;

class ReadingTimerService {
  private state: ReadingSessionState = {
    isRunning: false,
    isPaused: false,
    documentTitle: '',
    subject: 'General Studies',
    source: 'pdf',
    elapsedSecs: 0,
    activeIntervals: [],
  };

  private listeners = new Set<ReadingListener>();
  private ticker: any = null;
  private currentIntervalStart: number | null = null;
  private lastHeartbeatMs = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state.isRunning && !this.state.isPaused) {
          const settings = db.getSettings();
          if (!settings?.allowBackgroundFocusTimer) {
            this.pauseSession();
          }
        }
      });
    }
  }

  public getState(): ReadingSessionState {
    return { ...this.state };
  }

  public subscribe(listener: ReadingListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const s = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(s);
      } catch {
        /* ignore */
      }
    });
    safeDispatch(new CustomEvent('studyos_reading_timer_updated', { detail: s }));
  }

  public startSession(opts: {
    documentTitle: string;
    subject?: string;
    topic?: string;
    source?: 'pdf' | 'browser_reader' | 'notes';
  }): void {
    if (this.state.isRunning) {
      this.endSession();
    }

    const now = Date.now();
    this.state = {
      isRunning: true,
      isPaused: false,
      documentTitle: opts.documentTitle || 'Academic Document',
      subject: opts.subject || 'General Studies',
      topic: opts.topic,
      source: opts.source || 'pdf',
      sessionId: `read-${now}-${Math.random().toString(36).slice(2, 7)}`,
      sessionStartedAt: new Date(now).toISOString(),
      elapsedSecs: 0,
      activeIntervals: [],
    };

    this.currentIntervalStart = now;
    this.lastHeartbeatMs = now;
    this.startHeartbeat();
    this.notify();
  }

  public pauseSession(): void {
    if (!this.state.isRunning || this.state.isPaused) return;

    const now = Date.now();
    if (this.currentIntervalStart) {
      this.state.activeIntervals.push({
        startMs: this.currentIntervalStart,
        endMs: now,
      });
      this.currentIntervalStart = null;
    }

    this.state.isPaused = true;
    this.notify();
  }

  public resumeSession(): void {
    if (!this.state.isRunning || !this.state.isPaused) return;

    const now = Date.now();
    this.currentIntervalStart = now;
    this.lastHeartbeatMs = now;
    this.state.isPaused = false;
    this.notify();
  }

  public endSession(): { durationMinutes: number } {
    if (!this.state.isRunning) return { durationMinutes: 0 };

    const now = Date.now();
    if (this.currentIntervalStart && !this.state.isPaused) {
      this.state.activeIntervals.push({
        startMs: this.currentIntervalStart,
        endMs: now,
      });
    }

    const totalSecs = this.state.elapsedSecs;
    const durationMinutes = Math.max(1, Math.round(totalSecs / 60));

    if (totalSecs >= 15) {
      // Record verified reading session
      const sessionRecord = {
        id: this.state.sessionId || `read-${now}`,
        activityType: 'reading' as const,
        subject: this.state.subject,
        topic: this.state.topic || this.state.documentTitle,
        chapter: this.state.documentTitle,
        startTime: this.state.sessionStartedAt || new Date(now - totalSecs * 1000).toISOString(),
        endTime: new Date(now).toISOString(),
        durationMinutes,
        durationSeconds: totalSecs,
        activeIntervals: this.state.activeIntervals.length > 0 ? this.state.activeIntervals : [{ startMs: now - totalSecs * 1000, endMs: now }],
        status: 'completed' as const,
        date: new Date(now).toISOString().slice(0, 10),
        source: `reader_${this.state.source}`,
        verifiedActive: true,
      };

      analyticsService.recordVerifiedSession(sessionRecord);
      analyticsService.logEvent({
        type: 'study_session',
        subject: this.state.subject,
        topic: this.state.documentTitle,
        durationMinutes,
        details: {
          activityType: 'reading',
          source: this.state.source,
          totalSecs,
        },
      });

      syncService.emit({
        type: 'focus_session_recorded',
        minutes: durationMinutes,
        subject: this.state.subject,
        chapter: this.state.documentTitle,
        timestamp: new Date().toISOString(),
      });
    }

    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }

    this.state = {
      isRunning: false,
      isPaused: false,
      documentTitle: '',
      subject: 'General Studies',
      source: 'pdf',
      elapsedSecs: 0,
      activeIntervals: [],
    };

    this.currentIntervalStart = null;
    this.notify();

    return { durationMinutes };
  }

  private startHeartbeat(): void {
    if (this.ticker) clearInterval(this.ticker);

    this.ticker = setInterval(() => {
      if (!this.state.isRunning || this.state.isPaused) return;

      const now = Date.now();
      const deltaMs = now - this.lastHeartbeatMs;
      this.lastHeartbeatMs = now;

      // Computer sleep / lock detection: if delta > 5 seconds, do not accumulate sleep gap
      if (deltaMs > 5000) {
        if (this.currentIntervalStart) {
          this.state.activeIntervals.push({
            startMs: this.currentIntervalStart,
            endMs: now - deltaMs + 1000,
          });
          this.currentIntervalStart = now;
        }
        return;
      }

      this.state.elapsedSecs += 1;
      this.notify();
    }, 1000);
  }
}

export const readingTimerService = new ReadingTimerService();
