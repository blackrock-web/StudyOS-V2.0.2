import { db, safeDispatch } from './db';
import { analyticsService } from './analyticsService';
import { studyCoachService } from './studyCoachService';
import { activityEventService } from './activityEventService';
import { syncService } from './syncService';
import { FocusSessionRecord, PWLectureRecord, TaskItem } from '../types';

export type FocusTimerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface ActiveLectureContext {
  id: string;
  subjectId?: string;
  subject: string;
  title: string;
  chapter?: string;
  lectureNumber?: number;
  plannedDurationMinutes: number;
  priority?: 'High' | 'Medium' | 'Low';
  scheduledDate?: string;
  scheduledTime?: string;
  examId?: string;
}

export interface FocusTimerEngineState {
  status: FocusTimerStatus;
  activeLecture: ActiveLectureContext | null;
  activeTaskId?: string;
  activeSubject: string;
  plannedDurationSecs: number;
  accumulatedElapsedSecs: number;
  currentRunStartTimestamp: number | null; // Date.now() when last started/resumed
  secondsLeft: number;
  pauseCount: number;
  continuousMode: boolean;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  examId?: string;
  breakModeActive?: boolean;
  breakElapsedSecs?: number;
}

type FocusTimerListener = (state: FocusTimerEngineState) => void;

const STORAGE_KEY = 'studyos_focus_timer_engine_state';

class FocusTimerService {
  private state: FocusTimerEngineState = {
    status: 'idle',
    activeLecture: null,
    activeTaskId: undefined,
    activeSubject: 'General Studies',
    plannedDurationSecs: 60 * 60,
    accumulatedElapsedSecs: 0,
    currentRunStartTimestamp: null,
    secondsLeft: 60 * 60,
    pauseCount: 0,
    continuousMode: false,
    sessionStartedAt: undefined,
    sessionEndedAt: undefined,
    examId: undefined,
    breakModeActive: false,
    breakElapsedSecs: 0,
  };

  private listeners: Set<FocusTimerListener> = new Set();
  private intervalRef: any = null;
  private lastHeartbeatMs = 0;

  constructor() {
    this.restoreState();
    this.startClockTicker();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.restoreState();
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state.status === 'running') {
          const settings = db.getSettings();
          if (!settings?.allowBackgroundFocusTimer) {
            this.pause();
          }
        }
      });
    }
  }

  private restoreState() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as FocusTimerEngineState;
      if (!saved) return;

      this.state = saved;

      // Crash / reload safety: If closed while running, do not count closed runtime as focus time
      if (this.state.status === 'running') {
        this.state.status = 'paused';
        this.state.currentRunStartTimestamp = null;
        this.state.secondsLeft = Math.max(0, this.state.plannedDurationSecs - this.state.accumulatedElapsedSecs);
      } else if (this.state.status === 'paused') {
        this.state.secondsLeft = Math.max(0, this.state.plannedDurationSecs - this.state.accumulatedElapsedSecs);
      }
      this.notify();
    } catch {
      /* ignore */
    }
  }

  private persist() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }

  public getState(): FocusTimerEngineState {
    // Dynamically calculate live seconds left if running
    const exactElapsed = this.getActualElapsedSecs();
    const liveSecondsLeft = Math.max(0, this.state.plannedDurationSecs - exactElapsed);

    return {
      ...this.state,
      secondsLeft: this.state.status === 'running' ? liveSecondsLeft : this.state.secondsLeft,
      accumulatedElapsedSecs: this.state.status === 'running' ? exactElapsed : this.state.accumulatedElapsedSecs,
    };
  }

  public subscribe(listener: FocusTimerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(s);
      } catch {
        /* ignore */
      }
    });
    safeDispatch(new CustomEvent('studyos_focus_timer_updated', { detail: s }));
  }

  public getActualElapsedSecs(): number {
    let secs = this.state.accumulatedElapsedSecs;
    if (this.state.status === 'running' && this.state.currentRunStartTimestamp) {
      secs += (Date.now() - this.state.currentRunStartTimestamp) / 1000;
    }
    return Math.max(0, Math.floor(secs));
  }

  public getActualElapsedMinutes(): number {
    return Math.max(1, Math.round(this.getActualElapsedSecs() / 60));
  }

  /**
   * Start or associate Focus Timer from a planned lecture
   */
  public startLectureFocus(
    lecture: PWLectureRecord | ActiveLectureContext,
    options?: {
      continuousMode?: boolean;
      taskId?: string;
      overrideDurationMins?: number;
    }
  ) {
    const examId = db.getActiveExamId();
    const durationMinutes = options?.overrideDurationMins || (lecture as any).durationMinutes || (lecture as any).plannedDurationMinutes || 60;
    const durationSecs = Math.max(60, durationMinutes * 60);

    const title = (lecture as any).chapter && (lecture as any).lectureNumber
      ? `${(lecture as any).chapter} - Lec ${(lecture as any).lectureNumber}`
      : (lecture as any).title || (lecture as any).chapter || 'Lecture Session';

    const activeLecture: ActiveLectureContext = {
      id: lecture.id,
      subjectId: (lecture as any).subjectId,
      subject: lecture.subject,
      title: title,
      chapter: (lecture as any).chapter,
      lectureNumber: (lecture as any).lectureNumber,
      plannedDurationMinutes: durationMinutes,
      priority: (lecture as any).priority || 'High',
      scheduledDate: (lecture as any).reanchoredDate || (lecture as any).originalDate || (lecture as any).scheduledDate,
      scheduledTime: (lecture as any).scheduledTime,
      examId,
    };

    const now = Date.now();
    this.state = {
      status: 'running',
      activeLecture,
      activeTaskId: options?.taskId,
      activeSubject: lecture.subject,
      plannedDurationSecs: durationSecs,
      accumulatedElapsedSecs: 0,
      currentRunStartTimestamp: now,
      secondsLeft: durationSecs,
      pauseCount: 0,
      continuousMode: options?.continuousMode ?? this.state.continuousMode,
      sessionStartedAt: new Date(now).toISOString(),
      sessionEndedAt: undefined,
      examId,
      breakModeActive: false,
      breakElapsedSecs: 0,
    };

    // 1. Mark lecture as "In Progress" in DB
    this.updateLectureStatusInDb(lecture.id, 'Paused'); // 'Paused' or 'In Progress' indicates active study
    // 2. Mark task as "In Progress" if linked
    if (options?.taskId) {
      this.updateTaskStatusInDb(options.taskId, 'In Progress');
    }

    // 3. Trigger coach & activity logs
    studyCoachService.onFocusSessionStarted();
    activityEventService.logEvent({
      module: 'focus',
      action: 'focus_started',
      title: `Focus Session: ${activeLecture.title}`,
      subject: activeLecture.subject,
      topic: activeLecture.title,
      durationMinutes,
    });
    analyticsService.logEvent({
      type: 'focus_started',
      subject: activeLecture.subject,
      topic: activeLecture.title,
      durationMinutes,
      details: {
        lectureId: lecture.id,
        plannedDurationMinutes: durationMinutes,
        examId,
      },
    });

    this.persist();
    this.notify();
  }

  /**
   * Single-Subject Focus Mode: Automatically fetches next pending lecture for that subject
   */
  public startSubjectFocus(
    subjectName: string,
    continuousMode = true
  ): { success: boolean; reason?: 'NO_LECTURES_PLANNED' | 'STARTED'; lecture?: ActiveLectureContext } {
    const examId = db.getActiveExamId();
    const lectures = db.getLectures();
    
    // Find next pending lecture for this subject
    const pendingLecture = lectures.find(
      (l) => l.subject.toLowerCase() === subjectName.toLowerCase() && l.status !== 'Completed'
    );

    if (!pendingLecture) {
      // Also check tasks
      const tasks = db.getTasks();
      const pendingTask = tasks.find(
        (t) =>
          t.subject.toLowerCase() === subjectName.toLowerCase() &&
          !t.completed &&
          t.status !== 'Completed' &&
          (t.type === 'Lecture' || t.type === 'Study Session')
      );

      if (pendingTask) {
        this.startLectureFocus(
          {
            id: pendingTask.id,
            subject: pendingTask.subject,
            title: pendingTask.title,
            plannedDurationMinutes: pendingTask.estimatedMinutes || 60,
            priority: pendingTask.priority,
            scheduledDate: pendingTask.dueDate,
          },
          { continuousMode, taskId: pendingTask.id }
        );
        return { success: true, reason: 'STARTED' };
      }

      return { success: false, reason: 'NO_LECTURES_PLANNED' };
    }

    this.startLectureFocus(pendingLecture, { continuousMode });
    return {
      success: true,
      reason: 'STARTED',
      lecture: this.state.activeLecture || undefined,
    };
  }

  /**
   * Pause the active focus session
   */
  public pause() {
    if (this.state.status !== 'running') return;

    const now = Date.now();
    const runElapsed = this.state.currentRunStartTimestamp
      ? Math.floor((now - this.state.currentRunStartTimestamp) / 1000)
      : 0;

    this.state.accumulatedElapsedSecs += runElapsed;
    this.state.currentRunStartTimestamp = null;
    this.state.status = 'paused';
    this.state.pauseCount = (this.state.pauseCount || 0) + 1;
    this.state.secondsLeft = Math.max(0, this.state.plannedDurationSecs - this.state.accumulatedElapsedSecs);

    const actualMins = Math.max(1, Math.round(this.state.accumulatedElapsedSecs / 60));

    // Log pause event
    activityEventService.logEvent({
      module: 'focus',
      action: 'focus_paused',
      title: `Focus Paused: ${this.state.activeLecture?.title || this.state.activeSubject}`,
      subject: this.state.activeSubject,
      durationMinutes: actualMins,
    });
    analyticsService.logEvent({
      type: 'task_paused',
      subject: this.state.activeSubject,
      topic: this.state.activeLecture?.title,
      durationMinutes: actualMins,
      details: {
        pauseCount: this.state.pauseCount,
        actualFocusedSeconds: this.state.accumulatedElapsedSecs,
      },
    });

    this.persist();
    this.notify();
  }

  /**
   * Resume the paused focus session
   */
  public resume() {
    if (this.state.status !== 'paused') return;

    const now = Date.now();
    this.state.currentRunStartTimestamp = now;
    this.state.status = 'running';

    studyCoachService.onFocusSessionStarted();
    activityEventService.logEvent({
      module: 'focus',
      action: 'focus_resumed',
      title: `Focus Resumed: ${this.state.activeLecture?.title || this.state.activeSubject}`,
      subject: this.state.activeSubject,
    });

    this.persist();
    this.notify();
  }

  public toggleTimer() {
    if (this.state.status === 'running') {
      this.pause();
    } else if (this.state.status === 'paused') {
      this.resume();
    } else if (this.state.status === 'idle' || this.state.status === 'completed' || this.state.status === 'cancelled') {
      if (this.state.activeLecture) {
        this.startLectureFocus(this.state.activeLecture);
      } else {
        this.startGenericFocus(this.state.activeSubject, Math.round(this.state.plannedDurationSecs / 60));
      }
    }
  }

  /**
   * Generic Focus Session start
   */
  public startGenericFocus(subjectName: string, durationMinutes = 45, topic?: string) {
    const examId = db.getActiveExamId();
    const durationSecs = Math.max(60, durationMinutes * 60);
    const now = Date.now();

    this.state = {
      status: 'running',
      activeLecture: {
        id: `adhoc-${now}`,
        subject: subjectName,
        title: topic || `${subjectName} Deep Focus`,
        plannedDurationMinutes: durationMinutes,
        priority: 'High',
        examId,
      },
      activeTaskId: undefined,
      activeSubject: subjectName,
      plannedDurationSecs: durationSecs,
      accumulatedElapsedSecs: 0,
      currentRunStartTimestamp: now,
      secondsLeft: durationSecs,
      pauseCount: 0,
      continuousMode: false,
      sessionStartedAt: new Date(now).toISOString(),
      sessionEndedAt: undefined,
      examId,
      breakModeActive: false,
      breakElapsedSecs: 0,
    };

    studyCoachService.onFocusSessionStarted();
    this.persist();
    this.notify();
  }

  /**
   * Complete the focus session (either when countdown hits 0 or user clicks finish)
   */
  public completeSession(isEarlyManual = false) {
    const actualElapsedSecs = this.getActualElapsedSecs();
    const actualMins = Math.max(1, Math.round(actualElapsedSecs / 60));
    const plannedMins = Math.round(this.state.plannedDurationSecs / 60);
    const focusPercentage = Math.min(100, Math.round((actualMins / Math.max(1, plannedMins)) * 100));
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0] || '';
    const examId = this.state.examId || db.getActiveExamId();

    const completedLecture = this.state.activeLecture;
    const completedTaskId = this.state.activeTaskId;
    const subject = this.state.activeSubject;
    const pauseCount = this.state.pauseCount;
    const continuousMode = this.state.continuousMode;

    this.state.status = 'completed';
    this.state.secondsLeft = 0;
    this.state.currentRunStartTimestamp = null;
    this.state.sessionEndedAt = nowIso;
    this.state.accumulatedElapsedSecs = actualElapsedSecs;

    // 1. Update Lecture in DB
    if (completedLecture && completedLecture.id && !completedLecture.id.startsWith('adhoc-')) {
      this.updateLectureStatusInDb(completedLecture.id, 'Completed', actualMins);
    }

    // 2. Update Task in DB if linked
    if (completedTaskId) {
      this.updateTaskStatusInDb(completedTaskId, 'Completed', actualMins);
    }

    // 3. Record in DB study logs & Focus Plan
    db.recordActualStudySession({
      examId,
      subject,
      topic: completedLecture?.title || `${subject} Focus`,
      durationMinutes: actualMins,
      type: 'Lecture',
      taskId: completedTaskId,
    });

    // 4. Record rich Analytics FocusSessionRecord
    const focusRecord: FocusSessionRecord = {
      id: `fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lectureId: completedLecture?.id,
      taskId: completedTaskId,
      subjectId: completedLecture?.subjectId,
      subject,
      lectureTitle: completedLecture?.title || `${subject} Focus Session`,
      chapter: completedLecture?.chapter,
      plannedDurationMinutes: plannedMins,
      actualDurationMinutes: actualMins,
      startTime: this.state.sessionStartedAt || new Date(Date.now() - actualElapsedSecs * 1000).toISOString(),
      endTime: nowIso,
      pauseCount,
      completionStatus: 'Completed',
      date: dateStr,
      focusPercentage,
      examId,
    };

    analyticsService.logFocusSession(focusRecord);
    analyticsService.logEvent({
      type: 'lecture_completed',
      subject,
      topic: completedLecture?.title,
      durationMinutes: actualMins,
      details: {
        plannedDurationMinutes: plannedMins,
        actualDurationMinutes: actualMins,
        pauseCount,
        focusPercentage,
        isEarlyManual,
      },
    });

    // 5. Trigger Audio & Reflection Celebration
    this.playCelebrationChime();
    studyCoachService.onFocusSessionCompleted(actualMins);

    safeDispatch(
      new CustomEvent('studyos_focus_session_celebrate', {
        detail: {
          lectureTitle: completedLecture?.title || `${subject} Focus`,
          subject,
          durationMins: actualMins,
          focusPercentage,
        },
      })
    );

    this.persist();
    this.notify();

    // 6. Continuous Mode: Automatically transition to next pending lecture
    if (continuousMode && completedLecture?.subject) {
      setTimeout(() => {
        const nextRes = this.startSubjectFocus(completedLecture.subject, true);
        if (!nextRes.success) {
          // All lectures for this subject are complete!
          safeDispatch(
            new CustomEvent('studyos_subject_curriculum_completed', {
              detail: { subject: completedLecture.subject },
            })
          );
        }
      }, 2500);
    }
  }

  /**
   * Cancel or abort active session
   */
  public cancelSession() {
    const actualElapsedSecs = this.getActualElapsedSecs();
    const actualMins = Math.round(actualElapsedSecs / 60);

    if (actualMins >= 1 && this.state.status !== 'idle') {
      // Log partial progress to analytics so effort isn't lost
      analyticsService.logEvent({
        type: 'study_session',
        subject: this.state.activeSubject,
        topic: this.state.activeLecture?.title || 'Cancelled Focus Session',
        durationMinutes: actualMins,
        details: { status: 'cancelled' },
      });
    }

    this.state = {
      status: 'idle',
      activeLecture: null,
      activeTaskId: undefined,
      activeSubject: 'General Studies',
      plannedDurationSecs: 60 * 60,
      accumulatedElapsedSecs: 0,
      currentRunStartTimestamp: null,
      secondsLeft: 60 * 60,
      pauseCount: 0,
      continuousMode: false,
      sessionStartedAt: undefined,
      sessionEndedAt: undefined,
      examId: undefined,
      breakModeActive: false,
      breakElapsedSecs: 0,
    };

    this.persist();
    this.notify();
  }

  public setContinuousMode(enabled: boolean) {
    this.state.continuousMode = enabled;
    this.persist();
    this.notify();
  }

  public setPlannedDuration(minutes: number) {
    const secs = Math.max(60, minutes * 60);
    this.state.plannedDurationSecs = secs;
    if (this.state.status === 'idle' || this.state.status === 'paused') {
      this.state.secondsLeft = Math.max(0, secs - this.state.accumulatedElapsedSecs);
    }
    this.persist();
    this.notify();
  }

  private updateLectureStatusInDb(
    lectureId: string,
    newStatus: PWLectureRecord['status'],
    timeSpentMinutes?: number
  ) {
    try {
      const lectures = db.getLectures();
      const target = lectures.find((l) => l.id === lectureId);
      if (target) {
        target.status = newStatus;
        if (typeof timeSpentMinutes === 'number') {
          target.timeSpentMinutes = (target.timeSpentMinutes || 0) + timeSpentMinutes;
        }
        db.updateLecture(target);
      }
    } catch {
      /* ignore */
    }
  }

  private updateTaskStatusInDb(
    taskId: string,
    status: 'In Progress' | 'Completed' | 'Pending',
    timeSpentMinutes?: number
  ) {
    try {
      const tasks = db.getTasks();
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = status;
        if (status === 'Completed') {
          task.completed = true;
          task.completedAt = new Date().toISOString();
        }
        if (typeof timeSpentMinutes === 'number') {
          task.timeSpentMinutes = (task.timeSpentMinutes || 0) + timeSpentMinutes;
        }
        db.setTasks(tasks);
      }
    } catch {
      /* ignore */
    }
  }

  public playCelebrationChime() {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();

      // Fanfare notes: C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        setTimeout(() => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
          } catch {
            /* ignore */
          }
        }, i * 150);
      });
    } catch {
      /* ignore */
    }
  }

  private startClockTicker() {
    if (typeof window === 'undefined') return;
    if (this.intervalRef) clearInterval(this.intervalRef);
    this.lastHeartbeatMs = Date.now();

    this.intervalRef = setInterval(() => {
      if (this.state.status !== 'running') return;

      const now = Date.now();
      const delta = now - this.lastHeartbeatMs;
      this.lastHeartbeatMs = now;

      // Computer sleep / lock detection: if gap > 5 seconds, do not accumulate sleep duration
      if (delta > 5000) {
        // Reset currentRunStartTimestamp to now so sleep duration is ignored
        this.state.currentRunStartTimestamp = now;
        return;
      }

      const exactElapsed = this.getActualElapsedSecs();
      const left = Math.max(0, this.state.plannedDurationSecs - exactElapsed);
      this.state.secondsLeft = left;

      if (left <= 0) {
        this.completeSession(false);
      } else {
        this.notify();
      }
    }, 1000);
  }
}

export const focusTimerService = new FocusTimerService();
