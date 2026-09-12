import { studyCoachService } from './studyCoachService';
import { syncService } from './syncService';
import { activityEventService } from './activityEventService';
import { analyticsService } from './analyticsService';
import { db } from './db';

export type PomodoroMode = 'focus' | 'break' | 'shortBreak' | 'longBreak';
export type FocusSessionState = 'FOCUS_RUNNING' | 'BREAK_RUNNING' | 'FOCUS_PAUSED' | 'COMPLETED';

export interface PomodoroTimerState {
  mode: PomodoroMode;
  sessionState: FocusSessionState;
  isRunning: boolean;
  focusMinutes: number;
  breakMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  timeRemainingSecs: number;
  secondsLeft: number;
  targetDurationSecs: number;
  completedCycles: number;
  completedSessions: number;
  totalFocusMinsToday: number;
  autoLaunchGames: boolean;
  autoResumeFocus: boolean;
  selectedSubjectId?: string;
  linkedTaskId?: string;
  sessionStartedAt?: string;
  breakStartTime?: string;
  accumulatedBreakMins?: number;
  breakElapsedSecs?: number;
  breakStopwatchActive?: boolean;
  totalFocusSecs: number;
  totalBreakSecs: number;
  pauseCount: number;
  breakCount: number;
}

type TimerListener = (state: PomodoroTimerState) => void;

class PomodoroTimerService {
  private state: PomodoroTimerState = {
    mode: 'focus',
    sessionState: 'FOCUS_PAUSED',
    isRunning: false,
    focusMinutes: 25,
    breakMinutes: 5,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    timeRemainingSecs: 25 * 60,
    secondsLeft: 25 * 60,
    targetDurationSecs: 25 * 60,
    completedCycles: 0,
    completedSessions: 0,
    totalFocusMinsToday: 0,
    autoLaunchGames: true,
    autoResumeFocus: false,
    linkedTaskId: undefined,
    sessionStartedAt: undefined,
    accumulatedBreakMins: 0,
    breakElapsedSecs: 0,
    breakStopwatchActive: false,
    totalFocusSecs: 0,
    totalBreakSecs: 0,
    pauseCount: 0,
    breakCount: 0,
  };

  private listeners: Set<TimerListener> = new Set();
  private timerInterval: any = null;
  private lastHeartbeatMs = 0;

  constructor() {
    this.startInterval();
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state.isRunning && this.state.mode === 'focus') {
          const settings = db.getSettings();
          if (!settings?.allowBackgroundFocusTimer) {
            this.pause();
          }
        }
      });
    }
  }

  public getState(): PomodoroTimerState {
    return { ...this.state };
  }

  public subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((fn) => fn(currentState));
  }

  public linkTask(taskId?: string) {
    this.state.linkedTaskId = taskId;
    if (taskId) {
      try {
        syncService.startFocusSession(taskId);
      } catch {
        /* ignore */
      }
    }
    this.notify();
  }

  public start() {
    this.state.isRunning = true;
    if (this.state.mode === 'focus') {
      this.state.sessionState = 'FOCUS_RUNNING';
      this.state.sessionStartedAt = this.state.sessionStartedAt || new Date().toISOString();
      studyCoachService.onFocusSessionStarted();
      const activeId = this.state.linkedTaskId || syncService.getActiveFocusTaskId();
      if (activeId) {
        this.state.linkedTaskId = activeId;
        try {
          syncService.startFocusSession(activeId);
        } catch {
          /* ignore */
        }
      }
      activityEventService.logEvent({
        module: 'focus',
        action: 'focus_started',
        title: 'Focus Session Started',
        durationMinutes: this.state.focusMinutes,
      });
    } else {
      this.state.sessionState = 'BREAK_RUNNING';
    }
    this.notify();
  }

  public pause() {
    this.state.isRunning = false;
    this.state.sessionState = 'FOCUS_PAUSED';
    this.state.pauseCount = (this.state.pauseCount || 0) + 1;
    if (this.state.mode === 'focus' && this.state.linkedTaskId) {
      try {
        syncService.pauseFocusSession(this.state.linkedTaskId);
      } catch {
        /* ignore */
      }
    }
    activityEventService.logEvent({
      module: 'focus',
      action: 'focus_paused',
      title: 'Focus Session Paused',
    });
    this.notify();
  }

  public toggleTimer() {
    if (this.state.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  public togglePlayPause() {
    this.toggleTimer();
  }

  public resetTimer() {
    this.state.isRunning = false;
    this.state.sessionState = 'FOCUS_PAUSED';
    const dur = this.getDurationForMode(this.state.mode);
    this.state.timeRemainingSecs = dur;
    this.state.secondsLeft = dur;
    this.state.targetDurationSecs = dur;
    this.notify();
  }

  public reset() {
    this.resetTimer();
  }

  public skipBreak() {
    this.stopBreakAndResumeFocus();
  }

  /** Starts an open-ended Break Stopwatch until explicitly stopped */
  public startBreakStopwatch() {
    // Automatically pause focus timer and start break stopwatch
    this.state.isRunning = false;
    this.state.mode = 'shortBreak';
    this.state.sessionState = 'BREAK_RUNNING';
    this.state.breakStopwatchActive = true;
    this.state.breakElapsedSecs = 0;
    this.state.breakStartTime = new Date().toISOString();
    this.state.breakCount = (this.state.breakCount || 0) + 1;
    this.state.isRunning = true;

    studyCoachService.onBreakStarted();
    activityEventService.logEvent({
      module: 'focus',
      action: 'break_started',
      title: 'Break Stopwatch Started',
      details: { breakStartTime: this.state.breakStartTime },
    });
    analyticsService.logEvent({
      type: 'break_started',
      details: { action: 'break_stopwatch_started' },
    });

    this.notify();
  }

  /** Stops break stopwatch / break mode, records break duration, and resumes focus */
  public stopBreakAndResumeFocus() {
    const breakSecs = this.state.breakElapsedSecs || 0;
    const elapsedMins = Math.max(1, Math.round(breakSecs / 60));
    this.state.totalBreakSecs = (this.state.totalBreakSecs || 0) + breakSecs;

    if (this.state.breakStopwatchActive && elapsedMins > 0) {
      try {
        syncService.addBreakMinutes(elapsedMins);
      } catch {
        /* ignore */
      }
    }

    activityEventService.logEvent({
      module: 'focus',
      action: 'break_completed',
      title: 'Break Completed',
      breakMinutes: elapsedMins,
      details: { breakSecs },
    });
    analyticsService.logEvent({
      type: 'break_ended',
      breakMinutes: elapsedMins,
    });

    // Automatically resume the same focus timer
    this.state.breakStopwatchActive = false;
    this.state.breakElapsedSecs = 0;
    this.state.breakStartTime = undefined;
    this.state.mode = 'focus';
    this.state.sessionState = 'FOCUS_RUNNING';
    this.state.isRunning = true;

    studyCoachService.onBreakEnded();
    studyCoachService.onFocusSessionStarted();

    if (this.state.linkedTaskId) {
      try {
        syncService.resumeFocusSession(this.state.linkedTaskId);
      } catch {
        /* ignore */
      }
    }

    activityEventService.logEvent({
      module: 'focus',
      action: 'focus_resumed',
      title: 'Focus Timer Resumed',
    });

    this.notify();
  }

  public setMode(mode: PomodoroMode) {
    this.state.mode = mode;
    this.state.isRunning = false;
    const dur = this.getDurationForMode(mode);
    this.state.timeRemainingSecs = dur;
    this.state.secondsLeft = dur;
    this.state.targetDurationSecs = dur;
    this.notify();
  }

  public setDurations(focusMins: number, breakMins: number, longBreakMins?: number) {
    this.state.focusMinutes = Math.max(1, focusMins);
    this.state.breakMinutes = Math.max(1, breakMins);
    this.state.shortBreakMinutes = Math.max(1, breakMins);
    if (longBreakMins) {
      this.state.longBreakMinutes = Math.max(1, longBreakMins);
    }
    this.resetTimer();
  }

  public configure(focusMins: number, shortBreakMins: number, longBreakMins: number, autoGames = true, autoFocus = false) {
    this.state.focusMinutes = Math.max(1, focusMins);
    this.state.breakMinutes = Math.max(1, shortBreakMins);
    this.state.shortBreakMinutes = Math.max(1, shortBreakMins);
    this.state.longBreakMinutes = Math.max(1, longBreakMins);
    this.state.autoLaunchGames = autoGames;
    this.state.autoResumeFocus = autoFocus;
    this.resetTimer();
  }

  public fastForward(secondsRemaining = 3) {
    this.state.timeRemainingSecs = secondsRemaining;
    this.state.secondsLeft = secondsRemaining;
    this.state.isRunning = true;
    this.notify();
  }

  public setSelectedSubjectId(subjectId?: string) {
    this.state.selectedSubjectId = subjectId;
    this.notify();
  }

  public playChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();

      // Sound 1: Ding (D5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.6);

      // Sound 2: High Ding (A5)
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.8);
      }, 200);
    } catch (e) {
      console.error("Timer chime error:", e);
    }
  }

  private getDurationForMode(mode: PomodoroMode): number {
    switch (mode) {
      case 'focus':
        return this.state.focusMinutes * 60;
      case 'break':
      case 'shortBreak':
        return (this.state.shortBreakMinutes || this.state.breakMinutes) * 60;
      case 'longBreak':
        return (this.state.longBreakMinutes || (this.state.breakMinutes * 3)) * 60;
      default:
        return 25 * 60;
    }
  }

  private switchMode() {
    this.playChime();

    if (this.state.mode === 'focus') {
      const completedMins = this.state.focusMinutes;
      this.state.completedCycles += 1;
      this.state.completedSessions += 1;
      this.state.totalFocusMinsToday += completedMins;

      // Record focus session into analyticsService and syncService
      try {
        const breakMins =
          this.state.completedSessions % 4 === 0
            ? this.state.longBreakMinutes
            : this.state.shortBreakMinutes || this.state.breakMinutes;

        analyticsService.trackFocusSession(
          this.state.selectedSubjectId || 'General Studies',
          completedMins,
          0,
          'Pomodoro Focus'
        );

        syncService.recordPomodoroSession({
          durationMinutes: completedMins,
          breakMinutes: 0, // break recorded when break ends
          title: 'Pomodoro Focus',
          markComplete: false,
        });
        this.state.accumulatedBreakMins = breakMins;
      } catch (e) {
        console.warn('syncService.recordPomodoroSession failed', e);
      }

      // Trigger session complete coach encouragement & post-session reflection modal
      studyCoachService.onFocusSessionCompleted(completedMins);

      // Determine next break mode (every 4th cycle is long break)
      const isLongBreak = this.state.completedSessions % 4 === 0;
      const nextMode: PomodoroMode = isLongBreak ? 'longBreak' : 'shortBreak';
      this.state.mode = nextMode;

      const dur = this.getDurationForMode(nextMode);
      this.state.timeRemainingSecs = dur;
      this.state.secondsLeft = dur;
      this.state.targetDurationSecs = dur;
      // Start break timer automatically
      this.state.isRunning = true;
      this.state.sessionStartedAt = undefined;
    } else {
      // Break mode completed -> record break minutes via activity log on next focus end
      const breakDone =
        this.state.mode === 'longBreak'
          ? this.state.longBreakMinutes
          : this.state.shortBreakMinutes || this.state.breakMinutes;
      this.state.accumulatedBreakMins = (this.state.accumulatedBreakMins || 0) + breakDone;
      studyCoachService.onBreakEnded();

      this.state.mode = 'focus';
      const dur = this.getDurationForMode('focus');
      this.state.timeRemainingSecs = dur;
      this.state.secondsLeft = dur;
      this.state.targetDurationSecs = dur;
      this.state.isRunning = this.state.autoResumeFocus;
      this.state.sessionStartedAt = this.state.isRunning ? new Date().toISOString() : undefined;
      if (this.state.isRunning) {
        studyCoachService.onFocusSessionStarted();
        if (this.state.linkedTaskId) {
          try {
            syncService.resumeFocusSession(this.state.linkedTaskId);
          } catch {
            /* ignore */
          }
        }
      }
    }
    this.notify();
  }

  private startInterval() {
    if (typeof window === 'undefined') return;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.lastHeartbeatMs = Date.now();

    this.timerInterval = setInterval(() => {
      if (!this.state.isRunning) return;

      const now = Date.now();
      const delta = now - this.lastHeartbeatMs;
      this.lastHeartbeatMs = now;

      // Sleep / clock jump detection: if gap > 5 seconds, do not accumulate sleep time
      if (delta > 5000) {
        return;
      }

      if (this.state.breakStopwatchActive) {
        this.state.breakElapsedSecs = (this.state.breakElapsedSecs || 0) + 1;
        this.state.totalBreakSecs = (this.state.totalBreakSecs || 0) + 1;
        this.notify();
        return;
      }

      if (this.state.timeRemainingSecs > 0) {
        this.state.timeRemainingSecs -= 1;
        this.state.secondsLeft = this.state.timeRemainingSecs;
        if (this.state.mode === 'focus') {
          this.state.totalFocusSecs = (this.state.totalFocusSecs || 0) + 1;
        }
        this.notify();
      } else {
        this.switchMode();
      }
    }, 1000);
  }
}

export const pomodoroTimerService = new PomodoroTimerService();
