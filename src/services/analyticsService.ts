/**
 * AnalyticsService — Fresh production Analytics engine (v2)
 * Single source of truth. Starts at zero. Collects only verified real user activity.
 * 
 * Rules:
 * - Application open/idle time is NEVER counted as focus time.
 * - 30 minutes of unique qualifying active time per calendar day qualifies for daily streak.
 * - 1 missed day grace period preserves streak; >1 missed consecutive days resets streak to 0.
 * - Overlapping intervals are deduplicated to prevent double-counting.
 * - Brand-new users start with 0 for all statistics.
 */

import { db, safeDispatch } from './db';
import { syncService } from './syncService';
import { TaskItem, TaskHistoryRecord, FocusSessionRecord } from '../types';
import {
  DAILY_STREAK_THRESHOLD_MINUTES,
  ActivityType,
  VerifiedSession,
  TimeInterval,
  calculateDailyMetricsFromSessions,
  calculateStreaks,
  splitSessionByCalendarDay,
  StreakCalculationResult,
} from './analytics/streakCalculator';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnalyticsEventType =
  | 'study_session'
  | 'lecture_started'
  | 'lecture_completed'
  | 'focus_started'
  | 'focus_ended'
  | 'break_started'
  | 'break_ended'
  | 'task_created'
  | 'task_started'
  | 'task_paused'
  | 'task_resumed'
  | 'task_completed'
  | 'task_missed'
  | 'note_created'
  | 'revision_session'
  | 'timetable_synced'
  | 'day_rollover'
  | 'week_rollover'
  | 'custom';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: string;
  date: string;
  examId?: string;
  subject?: string;
  topic?: string;
  course?: string;
  durationMinutes?: number;
  breakMinutes?: number;
  details?: Record<string, unknown>;
}

export interface DayRecord {
  date: string;
  studyMinutes: number;
  focusMinutes: number;
  readingMinutes: number;
  taskMinutes: number;
  breakMinutes: number;
  tasksCompleted: number;
  tasksMissed: number;
  lecturesCompleted: number;
  notesCreated: number;
  revisionMinutes: number;
  productivityScore: number;
  qualifiesForStreak: boolean;
  events: string[];
}

export interface WeeklyArchive {
  id: string;
  weekStart: string;
  weekEnd: string;
  totalStudyMinutes: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  tasksCompleted: number;
  lecturesCompleted: number;
  productivityScore: number;
  subjectProgress: Record<string, number>;
  dailySummaries: DayRecord[];
  archivedAt: string;
}

export type StoragePolicy = 'keep_all' | 'archive_yearly';

export interface AnalyticsStore {
  version: 2;
  initializedAt: string;
  events: AnalyticsEvent[];
  focusSessions?: FocusSessionRecord[];
  verifiedSessions: VerifiedSession[];
  days: Record<string, DayRecord>;
  weeklyArchives: WeeklyArchive[];
  streakCurrent: number;
  longestStreak: number;
  streakLastActiveDate: string;
  storagePolicy: StoragePolicy;
  lastWeekRollover: string;
  lastDayRollover: string;
}

export interface AnalyticsSnapshot {
  studyHours: number;
  focusHours: number;
  readingHours: number;
  taskHours: number;
  breakHours: number;
  completedTasks: number;
  completedLectures: number;
  productivityScore: number;
  studyStreak: number;
  longestStreak: number;
  learningProgress: number;
  todayStudyMinutes: number;
  todayFocusMinutes: number;
  todayReadingMinutes: number;
  todayTaskMinutes: number;
  todayBreakMinutes: number;
  todayTasksCompleted: number;
  todayLecturesCompleted: number;
  todayQualifiesForStreak: boolean;
  remainingMinutesToday: number;
  weekStudyMinutes: number;
  weekFocusMinutes: number;
  weekTasksCompleted: number;
  weekLecturesCompleted: number;
  weekProductivity: number;
}

type Listener = () => void;

const STORAGE_KEY = 'studyos_analytics_v2';

function todayStr(): string {
  return new Date().toISOString().split('T')[0] || '';
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDay(date: string): DayRecord {
  return {
    date,
    studyMinutes: 0,
    focusMinutes: 0,
    readingMinutes: 0,
    taskMinutes: 0,
    breakMinutes: 0,
    tasksCompleted: 0,
    tasksMissed: 0,
    lecturesCompleted: 0,
    notesCreated: 0,
    revisionMinutes: 0,
    productivityScore: 0,
    qualifiesForStreak: false,
    events: [],
  };
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0] || dateStr;
}

function sundayOf(monday: string): string {
  const d = new Date(monday + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0] || monday;
}

function emptyStore(): AnalyticsStore {
  const t = todayStr();
  return {
    version: 2,
    initializedAt: new Date().toISOString(),
    events: [],
    focusSessions: [],
    verifiedSessions: [],
    days: { [t]: emptyDay(t) },
    weeklyArchives: [],
    streakCurrent: 0,
    longestStreak: 0,
    streakLastActiveDate: '',
    storagePolicy: 'keep_all',
    lastWeekRollover: mondayOf(t),
    lastDayRollover: t,
  };
}

class AnalyticsService {
  private store: AnalyticsStore;
  private listeners = new Set<Listener>();
  private wired = false;

  constructor() {
    this.store = this.load();
    if (typeof window !== 'undefined') {
      setTimeout(() => this.wireSync(), 0);
    }
  }

  private load(): AnalyticsStore {
    try {
      if (typeof localStorage === 'undefined') return emptyStore();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw) as AnalyticsStore;
      if (!parsed || parsed.version !== 2) return emptyStore();

      if (!parsed.verifiedSessions) {
        parsed.verifiedSessions = [];
      }
      if (typeof parsed.longestStreak !== 'number') {
        parsed.longestStreak = parsed.streakCurrent || 0;
      }

      // Re-evaluate daily records and streaks accurately
      this.recalculateAll(parsed);
      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (e) {
      console.warn('[AnalyticsService] persist failed', e);
    }
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    safeDispatch(new CustomEvent('studyos_analytics_updated'));
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetAll(): void {
    this.store = emptyStore();
    this.persist();
    this.notify();
  }

  public getStore(): AnalyticsStore {
    return this.store;
  }

  public setStoragePolicy(policy: StoragePolicy): void {
    this.store.storagePolicy = policy;
    this.persist();
    this.notify();
  }

  public deleteDay(date: string): void {
    delete this.store.days[date];
    this.store.events = this.store.events.filter((e) => e.date !== date);
    this.store.verifiedSessions = this.store.verifiedSessions.filter((s) => s.date !== date);
    this.recalculateAll(this.store);
    this.persist();
    this.notify();
  }

  public deleteWeeklyArchive(id: string): void {
    this.store.weeklyArchives = this.store.weeklyArchives.filter((w) => w.id !== id);
    this.persist();
    this.notify();
  }

  /**
   * Records a verified active study/focus/reading/task session.
   * Automatically splits across midnight boundaries if applicable.
   */
  public recordVerifiedSession(session: VerifiedSession): void {
    if (!session.verifiedActive || session.durationMinutes <= 0) return;

    const chunks = splitSessionByCalendarDay(session);

    chunks.forEach((chunk) => {
      // Avoid duplicate session IDs
      const idx = this.store.verifiedSessions.findIndex((s) => s.id === chunk.id);
      if (idx >= 0) {
        this.store.verifiedSessions[idx] = chunk;
      } else {
        this.store.verifiedSessions.push(chunk);
      }
    });

    if (this.store.verifiedSessions.length > 5000) {
      this.store.verifiedSessions = this.store.verifiedSessions.slice(-5000);
    }

    this.recalculateAll(this.store);
    this.persist();
    this.notify();
  }

  public logEvent(partial: {
    type: AnalyticsEventType;
    examId?: string;
    subject?: string;
    topic?: string;
    course?: string;
    durationMinutes?: number;
    breakMinutes?: number;
    details?: Record<string, unknown>;
    timestamp?: string;
  }): AnalyticsEvent {
    const ts = partial.timestamp || new Date().toISOString();
    const date = ts.split('T')[0] || todayStr();
    const event: AnalyticsEvent = {
      id: uid('evt'),
      type: partial.type,
      timestamp: ts,
      date,
      examId: partial.examId || db.getActiveExamId(),
      subject: partial.subject,
      topic: partial.topic,
      course: partial.course,
      durationMinutes: partial.durationMinutes,
      breakMinutes: partial.breakMinutes,
      details: partial.details,
    };

    this.store.events.push(event);
    if (this.store.events.length > 5000) {
      this.store.events = this.store.events.slice(-5000);
    }

    this.applyEventToDay(event);
    this.recalculateStreaksFromDays();
    this.persist();
    this.notify();
    return event;
  }

  private applyEventToDay(event: AnalyticsEvent): void {
    if (!this.store.days[event.date]) {
      this.store.days[event.date] = emptyDay(event.date);
    }
    const day = this.store.days[event.date]!;
    day.events.push(event.id);

    const mins = event.durationMinutes || 0;
    const brk = event.breakMinutes || 0;

    switch (event.type) {
      case 'break_started':
      case 'break_ended':
        day.breakMinutes += mins || brk;
        break;
      case 'lecture_completed':
        day.lecturesCompleted += 1;
        break;
      case 'task_completed':
        day.tasksCompleted += 1;
        break;
      case 'task_missed':
        day.tasksMissed += 1;
        break;
      case 'note_created':
        day.notesCreated += 1;
        break;
      case 'revision_session':
        day.revisionMinutes += mins;
        break;
      default:
        break;
    }

    // Refresh study/focus/reading minutes strictly from verified sessions
    this.updateDayFromVerifiedSessions(event.date);
  }

  private updateDayFromVerifiedSessions(dateStr: string): void {
    if (!this.store.days[dateStr]) {
      this.store.days[dateStr] = emptyDay(dateStr);
    }
    const day = this.store.days[dateStr]!;
    const daySessions = this.store.verifiedSessions.filter((s) => s.date === dateStr);

    const metrics = calculateDailyMetricsFromSessions(daySessions);
    day.focusMinutes = metrics.focusMinutes;
    day.readingMinutes = metrics.readingMinutes;
    day.taskMinutes = metrics.taskMinutes;
    day.studyMinutes = metrics.uniqueQualifyingMinutes;
    day.qualifiesForStreak = metrics.qualifiesForStreak;

    day.productivityScore = this.computeDayProductivity(day);
  }

  private computeDayProductivity(day: DayRecord): number {
    const focus = day.studyMinutes;
    const total = focus + day.breakMinutes;
    if (total <= 0 && day.tasksCompleted === 0 && day.lecturesCompleted === 0) return 0;
    const focusRatio = total > 0 ? focus / total : 0;
    const taskBoost = Math.min(30, day.tasksCompleted * 8);
    const lectureBoost = Math.min(20, day.lecturesCompleted * 5);
    return Math.min(100, Math.round(focusRatio * 50 + taskBoost + lectureBoost));
  }

  private recalculateAll(targetStore: AnalyticsStore): void {
    const allDates = new Set<string>();
    Object.keys(targetStore.days).forEach((d) => allDates.add(d));
    targetStore.verifiedSessions.forEach((s) => allDates.add(s.date));
    allDates.add(todayStr());

    allDates.forEach((d) => {
      if (!targetStore.days[d]) targetStore.days[d] = emptyDay(d);
      const day = targetStore.days[d]!;
      const daySessions = targetStore.verifiedSessions.filter((s) => s.date === d);
      const metrics = calculateDailyMetricsFromSessions(daySessions);
      day.focusMinutes = metrics.focusMinutes;
      day.readingMinutes = metrics.readingMinutes;
      day.taskMinutes = metrics.taskMinutes;
      day.studyMinutes = metrics.uniqueQualifyingMinutes;
      day.qualifiesForStreak = metrics.qualifiesForStreak;
      day.productivityScore = this.computeDayProductivity(day);
    });

    const dailyMinutesMap: Record<string, number> = {};
    Object.entries(targetStore.days).forEach(([d, record]) => {
      dailyMinutesMap[d] = record.studyMinutes;
    });

    const streakRes = calculateStreaks(dailyMinutesMap, todayStr());
    targetStore.streakCurrent = streakRes.currentStreak;
    targetStore.longestStreak = streakRes.longestStreak;
    if (streakRes.todayQualified) {
      targetStore.streakLastActiveDate = todayStr();
    }
  }

  private recalculateStreaksFromDays(): void {
    const dailyMinutesMap: Record<string, number> = {};
    Object.entries(this.store.days).forEach(([d, record]) => {
      dailyMinutesMap[d] = record.studyMinutes;
    });

    const streakRes = calculateStreaks(dailyMinutesMap, todayStr());
    this.store.streakCurrent = streakRes.currentStreak;
    this.store.longestStreak = Math.max(this.store.longestStreak || 0, streakRes.longestStreak);
    if (streakRes.todayQualified) {
      this.store.streakLastActiveDate = todayStr();
    }
  }

  public getDailyProgress(dateStr = todayStr()): {
    focusMinutes: number;
    readingMinutes: number;
    taskMinutes: number;
    uniqueQualifyingMinutes: number;
    goalMinutes: number;
    completed: boolean;
    remainingMinutes: number;
    currentStreak: number;
    longestStreak: number;
  } {
    const day = this.store.days[dateStr] || emptyDay(dateStr);
    const unique = day.studyMinutes;
    const completed = unique >= DAILY_STREAK_THRESHOLD_MINUTES;
    const remaining = Math.max(0, DAILY_STREAK_THRESHOLD_MINUTES - unique);

    return {
      focusMinutes: day.focusMinutes,
      readingMinutes: day.readingMinutes,
      taskMinutes: day.taskMinutes,
      uniqueQualifyingMinutes: unique,
      goalMinutes: DAILY_STREAK_THRESHOLD_MINUTES,
      completed,
      remainingMinutes: remaining,
      currentStreak: this.store.streakCurrent,
      longestStreak: this.store.longestStreak || this.store.streakCurrent,
    };
  }

  public getSnapshot(): AnalyticsSnapshot {
    const t = todayStr();
    const day = this.store.days[t] || emptyDay(t);
    const weekStart = mondayOf(t);
    let weekStudy = 0;
    let weekFocus = 0;
    let weekTasks = 0;
    let weekLectures = 0;
    let weekProdSum = 0;
    let weekDays = 0;

    Object.values(this.store.days).forEach((d) => {
      if (d.date >= weekStart && d.date <= t) {
        weekStudy += d.studyMinutes;
        weekFocus += d.focusMinutes;
        weekTasks += d.tasksCompleted;
        weekLectures += d.lecturesCompleted;
        weekProdSum += d.productivityScore;
        weekDays += 1;
      }
    });

    let totalStudy = 0;
    let totalFocus = 0;
    let totalReading = 0;
    let totalTask = 0;
    let totalBreak = 0;
    let totalTasks = 0;
    let totalLectures = 0;

    Object.values(this.store.days).forEach((d) => {
      totalStudy += d.studyMinutes;
      totalFocus += d.focusMinutes;
      totalReading += d.readingMinutes || 0;
      totalTask += d.taskMinutes || 0;
      totalBreak += d.breakMinutes;
      totalTasks += d.tasksCompleted;
      totalLectures += d.lecturesCompleted;
    });

    const weekProd = weekDays > 0 ? Math.round(weekProdSum / weekDays) : 0;
    const learningProgress =
      weekStudy + weekTasks + weekLectures === 0
        ? 0
        : Math.min(100, Math.round(weekStudy / 10 + weekTasks * 5 + weekLectures * 3));

    const remainingMinutesToday = Math.max(0, DAILY_STREAK_THRESHOLD_MINUTES - day.studyMinutes);

    return {
      studyHours: Math.round((totalStudy / 60) * 10) / 10,
      focusHours: Math.round((totalFocus / 60) * 10) / 10,
      readingHours: Math.round((totalReading / 60) * 10) / 10,
      taskHours: Math.round((totalTask / 60) * 10) / 10,
      breakHours: Math.round((totalBreak / 60) * 10) / 10,
      completedTasks: totalTasks,
      completedLectures: totalLectures,
      productivityScore: day.productivityScore || weekProd,
      studyStreak: this.store.streakCurrent,
      longestStreak: this.store.longestStreak || this.store.streakCurrent,
      learningProgress,
      todayStudyMinutes: day.studyMinutes,
      todayFocusMinutes: day.focusMinutes,
      todayReadingMinutes: day.readingMinutes || 0,
      todayTaskMinutes: day.taskMinutes || 0,
      todayBreakMinutes: day.breakMinutes,
      todayTasksCompleted: day.tasksCompleted,
      todayLecturesCompleted: day.lecturesCompleted,
      todayQualifiesForStreak: day.studyMinutes >= DAILY_STREAK_THRESHOLD_MINUTES,
      remainingMinutesToday,
      weekStudyMinutes: weekStudy,
      weekFocusMinutes: weekFocus,
      weekTasksCompleted: weekTasks,
      weekLecturesCompleted: weekLectures,
      weekProductivity: weekProd,
    };
  }

  public getRecentEvents(limit = 50): AnalyticsEvent[] {
    return [...this.store.events].reverse().slice(0, limit);
  }

  public getDayRecords(limit = 30): DayRecord[] {
    return Object.values(this.store.days)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  public getWeeklyArchives(): WeeklyArchive[] {
    return [...this.store.weeklyArchives].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  public getSubjectMinutes(daysBack = 30, examId?: string): { subject: string; minutes: number }[] {
    const targetExamId = examId || db.getActiveExamId();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0] || '';
    const map: Record<string, number> = {};

    this.store.verifiedSessions.forEach((s) => {
      if (s.date < cutoffStr) return;
      const sub = s.subject || 'General Studies';
      map[sub] = (map[sub] || 0) + s.durationMinutes;
    });

    return Object.entries(map)
      .map(([subject, minutes]) => ({ subject, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  public getTaskHistoryFromDb(): TaskHistoryRecord[] {
    try {
      return db.getTaskHistory().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch {
      return [];
    }
  }

  public logFocusSession(session: FocusSessionRecord): void {
    if (!this.store.focusSessions) {
      this.store.focusSessions = [];
    }
    const scopedSession = {
      ...session,
      examId: session.examId || db.getActiveExamId(),
    };
    this.store.focusSessions.unshift(scopedSession);
    if (this.store.focusSessions.length > 2000) {
      this.store.focusSessions = this.store.focusSessions.slice(0, 2000);
    }

    // Also record into verifiedSessions
    const verified: VerifiedSession = {
      id: session.id,
      activityType: 'focus',
      subject: session.subject,
      topic: session.lectureTitle,
      chapter: session.chapter,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.actualDurationMinutes,
      status: 'completed',
      date: session.date,
      source: 'focus_timer',
      verifiedActive: true,
    };
    this.recordVerifiedSession(verified);
  }

  public getFocusSessions(filter?: {
    examId?: string;
    subject?: string;
    date?: string;
    limit?: number;
  }): FocusSessionRecord[] {
    let list = this.store.focusSessions || [];
    const targetExamId = filter?.examId || db.getActiveExamId();
    if (targetExamId) {
      list = list.filter((s) => !s.examId || s.examId === targetExamId);
    }
    if (filter?.subject && filter.subject !== 'ALL') {
      list = list.filter((s) => s.subject.toLowerCase() === filter.subject!.toLowerCase());
    }
    if (filter?.date) {
      list = list.filter((s) => s.date === filter.date);
    }
    const limit = filter?.limit || 50;
    return list.slice(0, limit);
  }

  public getStudyMetrics(examId?: string): {
    totalStudyMinutes: number;
    todayStudyMinutes: number;
    weekStudyMinutes: number;
    subjectWise: { subject: string; minutes: number; percentage: number }[];
    completedLectures: number;
    pendingLectures: number;
    averageFocusDuration: number;
    plannedVsActual: { plannedMinutes: number; actualMinutes: number; ratio: number };
    focusConsistency: number;
    dailyStreak: number;
    weeklyStreak: number;
  } {
    const targetExamId = examId || db.getActiveExamId();
    const snap = this.getSnapshot();
    const allSessions = this.getFocusSessions({ examId: targetExamId, limit: 1000 });

    const lectures = db.getLectures(targetExamId);
    const completedLectures = lectures.filter((l) => l.status === 'Completed').length;
    const pendingLectures = lectures.filter((l) => l.status !== 'Completed').length;

    const subjectMap: Record<string, number> = {};
    let totalMins = snap.studyHours * 60;
    if (totalMins === 0 && allSessions.length > 0) {
      totalMins = allSessions.reduce((acc, s) => acc + s.actualDurationMinutes, 0);
    }

    allSessions.forEach((s) => {
      subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.actualDurationMinutes;
    });

    const subjectWise = Object.entries(subjectMap)
      .map(([subject, minutes]) => ({
        subject,
        minutes,
        percentage: totalMins > 0 ? Math.min(100, Math.round((minutes / totalMins) * 100)) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const totalPlanned = allSessions.reduce((acc, s) => acc + (s.plannedDurationMinutes || s.actualDurationMinutes), 0);
    const totalActual = allSessions.reduce((acc, s) => acc + s.actualDurationMinutes, 0);
    const ratio = totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 100;

    const averageFocusDuration =
      allSessions.length > 0
        ? Math.round(allSessions.reduce((acc, s) => acc + s.actualDurationMinutes, 0) / allSessions.length)
        : snap.todayFocusMinutes > 0
        ? snap.todayFocusMinutes
        : 0;

    const recentDays = this.getDayRecords(7);
    const activeDayCount = recentDays.filter((d) => d.focusMinutes > 0 || d.studyMinutes > 0).length;
    const focusConsistency = Math.min(100, Math.round((activeDayCount / 7) * 85 + (ratio > 80 ? 15 : 0)));

    return {
      totalStudyMinutes: Math.round(snap.studyHours * 60),
      todayStudyMinutes: snap.todayStudyMinutes,
      weekStudyMinutes: snap.weekStudyMinutes,
      subjectWise,
      completedLectures,
      pendingLectures,
      averageFocusDuration,
      plannedVsActual: {
        plannedMinutes: totalPlanned,
        actualMinutes: totalActual,
        ratio,
      },
      focusConsistency,
      dailyStreak: snap.studyStreak,
      weeklyStreak: Math.max(1, Math.ceil(snap.studyStreak / 7)),
    };
  }

  public ensureDayRollover(): void {
    const t = todayStr();
    if (this.store.lastDayRollover === t) {
      if (!this.store.days[t]) {
        this.store.days[t] = emptyDay(t);
        this.persist();
      }
      return;
    }

    this.logEvent({
      type: 'day_rollover',
      details: { previous: this.store.lastDayRollover, today: t },
    });
    this.store.lastDayRollover = t;
    if (!this.store.days[t]) this.store.days[t] = emptyDay(t);
    this.ensureWeekRollover();
    this.recalculateStreaksFromDays();
    this.persist();
    this.notify();
  }

  public ensureWeekRollover(): void {
    const t = todayStr();
    const thisMonday = mondayOf(t);
    if (this.store.lastWeekRollover === thisMonday) return;

    const prevMonday = this.store.lastWeekRollover;
    const prevSunday = sundayOf(prevMonday);
    const dailySummaries = Object.values(this.store.days)
      .filter((d) => d.date >= prevMonday && d.date <= prevSunday)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (dailySummaries.length > 0) {
      const subjectProgress: Record<string, number> = {};
      this.store.events
        .filter((e) => e.date >= prevMonday && e.date <= prevSunday && e.subject && e.durationMinutes)
        .forEach((e) => {
          subjectProgress[e.subject!] = (subjectProgress[e.subject!] || 0) + (e.durationMinutes || 0);
        });

      const archive: WeeklyArchive = {
        id: uid('week'),
        weekStart: prevMonday,
        weekEnd: prevSunday,
        totalStudyMinutes: dailySummaries.reduce((s, d) => s + d.studyMinutes, 0),
        totalFocusMinutes: dailySummaries.reduce((s, d) => s + d.focusMinutes, 0),
        totalBreakMinutes: dailySummaries.reduce((s, d) => s + d.breakMinutes, 0),
        tasksCompleted: dailySummaries.reduce((s, d) => s + d.tasksCompleted, 0),
        lecturesCompleted: dailySummaries.reduce((s, d) => s + d.lecturesCompleted, 0),
        productivityScore:
          dailySummaries.length > 0
            ? Math.round(
                dailySummaries.reduce((s, d) => s + d.productivityScore, 0) / dailySummaries.length
              )
            : 0,
        subjectProgress,
        dailySummaries,
        archivedAt: new Date().toISOString(),
      };
      this.store.weeklyArchives.unshift(archive);
      this.logEvent({
        type: 'week_rollover',
        details: { weekStart: prevMonday, weekEnd: prevSunday },
      });
    }

    this.store.lastWeekRollover = thisMonday;

    if (this.store.storagePolicy === 'archive_yearly') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      const cutoff = yearAgo.toISOString().split('T')[0] || '';
      Object.keys(this.store.days).forEach((d) => {
        if (d < cutoff) delete this.store.days[d];
      });
      this.store.events = this.store.events.filter((e) => e.date >= cutoff);
      this.store.verifiedSessions = this.store.verifiedSessions.filter((s) => s.date >= cutoff);
    }

    this.persist();
    this.notify();
  }

  private wireSync(): void {
    if (this.wired) return;
    this.wired = true;
    this.ensureDayRollover();

    try {
      syncService.subscribe('*', (payload) => {
        this.handleSyncPayload(payload as { type?: string; task?: TaskItem; taskId?: string; minutes?: number });
      });
    } catch (e) {
      console.warn('[AnalyticsService] sync wire failed', e);
    }

    if (typeof window !== 'undefined') {
      setInterval(() => this.ensureDayRollover(), 30000);
      window.addEventListener('focus', () => this.ensureDayRollover());
    }
  }

  private handleSyncPayload(payload: {
    type?: string;
    task?: TaskItem;
    taskId?: string;
    minutes?: number;
  }): void {
    const type = payload.type;
    if (!type) return;
    const task = payload.task;

    switch (type) {
      case 'task_started':
        this.logEvent({
          type: 'task_started',
          subject: task?.subject,
          topic: task?.title,
          details: { taskId: task?.id || payload.taskId },
        });
        break;
      case 'task_paused':
        this.logEvent({
          type: 'task_paused',
          subject: task?.subject,
          topic: task?.title,
          durationMinutes: typeof payload.minutes === 'number' ? payload.minutes : undefined,
          details: { taskId: task?.id || payload.taskId },
        });
        break;
      case 'task_completed':
        this.logEvent({
          type: 'task_completed',
          subject: task?.subject,
          topic: task?.title,
          details: { taskId: task?.id || payload.taskId },
        });
        break;
      case 'analytics_refresh':
        this.recalculateStreaksFromDays();
        this.notify();
        break;
      default:
        break;
    }
  }

  public trackLectureStarted(subject: string, topic?: string, course?: string): void {
    this.logEvent({ type: 'lecture_started', subject, topic, course });
  }

  public trackLectureCompleted(
    subject: string,
    topic?: string,
    durationMinutes?: number,
    course?: string
  ): void {
    this.logEvent({ type: 'lecture_completed', subject, topic, course, durationMinutes });
  }

  public trackFocusSession(
    subject: string,
    focusMinutes: number,
    breakMinutes = 0,
    topic?: string
  ): void {
    const now = Date.now();
    const sessionRecord: VerifiedSession = {
      id: `fs-${now}-${Math.random().toString(36).slice(2, 6)}`,
      activityType: 'focus',
      subject,
      topic,
      startTime: new Date(now - focusMinutes * 60000).toISOString(),
      endTime: new Date(now).toISOString(),
      durationMinutes: focusMinutes,
      breakMinutes,
      status: 'completed',
      date: new Date(now).toISOString().slice(0, 10),
      source: 'manual_or_timer',
      verifiedActive: true,
    };
    this.recordVerifiedSession(sessionRecord);
  }

  public trackNoteCreated(subject?: string): void {
    this.logEvent({ type: 'note_created', subject });
  }

  public trackRevision(subject: string, minutes: number, topic?: string): void {
    const now = Date.now();
    const sessionRecord: VerifiedSession = {
      id: `rev-${now}-${Math.random().toString(36).slice(2, 6)}`,
      activityType: 'revision',
      subject,
      topic,
      startTime: new Date(now - minutes * 60000).toISOString(),
      endTime: new Date(now).toISOString(),
      durationMinutes: minutes,
      status: 'completed',
      date: new Date(now).toISOString().slice(0, 10),
      source: 'revision_tracker',
      verifiedActive: true,
    };
    this.recordVerifiedSession(sessionRecord);
    this.logEvent({ type: 'revision_session', subject, topic, durationMinutes: minutes });
  }

  public trackTaskFromItem(task: TaskItem, eventType: AnalyticsEventType): void {
    this.logEvent({
      type: eventType,
      subject: task.subject,
      topic: task.title,
      details: {
        taskId: task.id,
        status: task.status,
        dueDate: task.dueDate,
        startTime: task.startTime,
        endTime: task.endTime,
      },
    });
  }
}

export const analyticsService = new AnalyticsService();
