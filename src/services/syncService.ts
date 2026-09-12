/**
 * StudyOS Sync Service — Single Source of Truth event bus
 * Dashboard, Planner, Calendar, Focus Timer, Today's Focus, GATE, Analytics,
 * Notes, Flashcards, Formula Book, Revision, and Profile all subscribe here.
 */
import { TaskItem, SyllabusSubject, UserProfile, StudyActivityLog, TaskHistoryRecord } from '../types';
import { db, safeDispatch } from './db';
import { authService } from './auth';
import { notificationService } from './notificationService';
import { analyticsService } from './analyticsService';

export type SyncEventType =
  | 'tasks_updated'
  | 'task_completed'
  | 'task_started'
  | 'task_paused'
  | 'task_resumed'
  | 'task_archived'
  | 'focus_session_ended'
  | 'focus_session_recorded'
  | 'syllabus_updated'
  | 'lecture_progress'
  | 'profile_updated'
  | 'analytics_refresh'
  | 'reminder_due'
  | 'settings_updated';

export interface FocusSessionRecord {
  id: string;
  taskId?: string;
  subject: string;
  chapter?: string;
  topic?: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  breakMinutes: number;
  completed: boolean;
  source: 'pomodoro' | 'manual' | 'planner';
  date: string; // YYYY-MM-DD
}

export interface LiveAnalyticsSnapshot {
  todayStudyMinutes: number;
  todayBreakMinutes: number;
  totalStudyMinutes: number;
  totalStudyHours: number;
  currentStreak: number;
  completionPercent: number;
  remainingSyllabusPercent: number;
  predictedCompletionDate: string | null;
  examReadiness: number;
  daily: { date: string; minutes: number; tasksCompleted: number }[];
  weekly: { week: string; minutes: number; tasksCompleted: number }[];
  monthly: { month: string; minutes: number; tasksCompleted: number }[];
  subjectWise: { subject: string; minutes: number; tasksCompleted: number; topicsCompleted: number; totalTopics: number; percent: number }[];
  chapterWise: { subject: string; chapter: string; minutes: number; tasksCompleted: number }[];
  topicWise: { subject: string; chapter?: string; topic: string; minutes: number; tasksCompleted: number }[];
  heatmap: { date: string; intensity: number; minutes: number }[];
  completedTasks: number;
  pendingTasks: number;
  activeTask: TaskItem | null;
  upcomingTask: TaskItem | null;
  lastCompletedTask: TaskItem | null;
}

export interface SyncPayload {
  type: SyncEventType;
  taskId?: string;
  task?: TaskItem;
  tasks?: TaskItem[];
  minutes?: number;
  breakMinutes?: number;
  subject?: string;
  chapter?: string;
  topic?: string;
  profile?: UserProfile;
  session?: FocusSessionRecord;
  timestamp: string;
}

const FOCUS_SESSIONS_KEY = 'studyos_db_focus_sessions';
const ARCHIVED_TASKS_KEY = 'studyos_db_archived_tasks';
const ACTIVE_FOCUS_KEY = 'studyos_active_focus_task';
const PAUSED_FOCUS_KEY = 'studyos_paused_focus';

type Listener = (payload: SyncPayload) => void;

class SyncService {
  private listeners = new Map<SyncEventType | '*', Set<Listener>>();
  private reminderTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private quoteIndex = 0;
  private usedQuoteIndices = new Set<number>();

  constructor() {
    if (typeof window !== 'undefined') {
      // Bridge legacy db events into the unified bus
      const bridge = (type: SyncEventType) => () => {
        this.emit({ type, timestamp: new Date().toISOString() });
      };
      window.addEventListener('studyos_tasks_updated', bridge('tasks_updated'));
      window.addEventListener('studyos_syllabus_updated', bridge('syllabus_updated'));
      window.addEventListener('studyos_profile_updated', bridge('profile_updated'));
      window.addEventListener('studyos_lectures_updated', bridge('lecture_progress'));
    }
  }

  public subscribe(event: SyncEventType | '*', fn: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  public emit(payload: SyncPayload): void {
    const set = this.listeners.get(payload.type);
    set?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.warn('[SyncService] listener error', e);
      }
    });
    this.listeners.get('*')?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.warn('[SyncService] wildcard listener error', e);
      }
    });
    // Also fire a DOM event for any legacy listeners
    safeDispatch(new CustomEvent('studyos_sync', { detail: payload }));
  }

  // ─── Tasks (Today's Focus ↔ Planner) ─────────────────────────────────────

  // ─── Automatic Day Change Rollover & Timetable Sync Engine ────────────────

  public checkDailyRollover(): void {
    const today = new Date().toISOString().slice(0, 10);
    const settings = db.getSettings();
    const lastRollover = settings.lastRolloverDate;

    if (lastRollover === today) return; // Already processed today's rollover

    const tasks = db.getTasks();
    const pastTasks = tasks.filter((t) => t.dueDate < today);
    let changed = false;

    pastTasks.forEach((t) => {
      const completionStatus: 'Completed' | 'Incomplete' | 'Pending' | 'Missed' =
        t.completed || t.status === 'Completed'
          ? 'Completed'
          : t.status === 'In Progress'
          ? 'Incomplete'
          : 'Missed';

      const historyRecord: TaskHistoryRecord = {
        id: `th-${t.id}-${t.dueDate}`,
        taskId: t.id,
        taskName: t.title,
        date: t.dueDate,
        subject: t.subject || 'General',
        category: t.type || 'Study Session',
        scheduledStartTime: t.startTime,
        scheduledEndTime: t.endTime,
        actualStartTime: t.actualStartTime,
        actualEndTime: t.actualEndTime,
        completionStatus,
        completionPercentage: t.completed ? 100 : t.status === 'In Progress' ? 50 : 0,
        activeStudyTimeMinutes: t.actualDurationMinutes || 0,
        breakTimeMinutes: 0,
        pauseCount: 0,
        productivityScore: t.completed ? 100 : 0,
        focusScore: t.completed ? 90 : 30,
        notes: t.notes,
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.addTaskHistoryRecord(historyRecord);

      // Auto-rollover recurring daily or uncompleted high-priority tasks
      if (t.recurring === 'Daily' || (!t.completed && t.priority === 'High')) {
        const existingToday = tasks.find((x) => x.title === t.title && x.dueDate === today);
        if (!existingToday) {
          tasks.unshift({
            ...t,
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            dueDate: today,
            completed: false,
            status: 'Pending',
            actualStartTime: undefined,
            actualEndTime: undefined,
            actualDurationMinutes: 0,
            completedAt: undefined,
          });
          changed = true;
        }
      }
    });

    // Auto-populate Today's Workspace from default schedule if no tasks exist today
    const todaysCount = tasks.filter((t) => t.dueDate === today).length;
    if (todaysCount === 0) {
      const activeExam = db.getActiveExam();
      const examSubjects = db.getCurrentExamSubjects();
      const s1 = examSubjects[0] || 'Core Subject';
      const s2 = examSubjects[1] || s1;
      const s3 = examSubjects[2] || s1;

      const defaultRoutines: Partial<TaskItem>[] = [
        {
          title: `Morning Focus: ${s1} Concept Deep-Dive`,
          type: 'Lecture',
          subject: s1,
          timeSlot: 'Morning',
          startTime: '09:00',
          endTime: '11:00',
          priority: 'High',
          estimatedMinutes: 120,
        },
        {
          title: `Afternoon Practice: ${s2} Problem Solving & PYQs`,
          type: 'DPP',
          subject: s2,
          timeSlot: 'Afternoon',
          startTime: '14:00',
          endTime: '16:00',
          priority: 'High',
          estimatedMinutes: 120,
        },
        {
          title: `Evening Revision: ${s3} Active Recall & Flashcards`,
          type: 'Flashcards',
          subject: s3,
          timeSlot: 'Night',
          startTime: '19:30',
          endTime: '20:30',
          priority: 'Medium',
          estimatedMinutes: 60,
        },
      ];

      defaultRoutines.forEach((r, idx) => {
        tasks.unshift({
          id: `task-gen-${Date.now()}-${idx}`,
          title: r.title!,
          type: r.type as TaskItem['type'],
          subject: r.subject!,
          dueDate: today,
          timeSlot: r.timeSlot as TaskItem['timeSlot'],
          startTime: r.startTime,
          endTime: r.endTime,
          priority: r.priority as TaskItem['priority'],
          estimatedMinutes: r.estimatedMinutes!,
          completed: false,
          status: 'Pending',
          dayOfWeek: new Date().getDay(),
        });
      });
      changed = true;
    }

    if (changed) {
      db.setTasks(tasks);
    }

    db.setSettings({
      ...settings,
      lastRolloverDate: today,
    });

    this.emit({ type: 'tasks_updated', timestamp: new Date().toISOString() });
    this.refreshAnalyticsFromTasks();
  }

  public getTasks(): TaskItem[] {
    this.checkDailyRollover();
    return db.getTasks();
  }

  public getTodaysTasks(dateStr?: string): TaskItem[] {
    const d = dateStr || new Date().toISOString().slice(0, 10);
    if (!dateStr || dateStr === new Date().toISOString().slice(0, 10)) {
      this.checkDailyRollover();
    }
    return db.getTasks()
      .filter((t) => t.dueDate === d)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.startTime || '').localeCompare(b.startTime || ''));
  }

  public addTask(task: TaskItem): TaskItem {
    const full: TaskItem = {
      ...task,
      id: task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: task.status || (task.completed ? 'Completed' : 'Pending'),
      completed: Boolean(task.completed),
    };
    db.addTask(full);
    this.scheduleReminder(full);
    analyticsService.logEvent({
      type: 'custom',
      subject: full.subject,
      details: { action: 'task_created', taskId: full.id, title: full.title },
    });
    this.emit({ type: 'tasks_updated', task: full, taskId: full.id, timestamp: new Date().toISOString() });
    return full;
  }

  public updateTask(task: TaskItem): void {
    db.updateTask(task);
    this.scheduleReminder(task);
    this.emit({ type: 'tasks_updated', task, taskId: task.id, timestamp: new Date().toISOString() });
  }

  public deleteTask(taskId: string): void {
    this.clearReminder(taskId);
    db.deleteTask(taskId);
    this.emit({ type: 'tasks_updated', taskId, timestamp: new Date().toISOString() });
  }

  public duplicateTask(taskId: string): TaskItem | null {
    const tasks = this.getTasks();
    const src = tasks.find((t) => t.id === taskId);
    if (!src) return null;
    const copy: TaskItem = {
      ...src,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `${src.title} (copy)`,
      completed: false,
      completedAt: undefined,
      status: 'Pending',
      actualStartTime: undefined,
      actualEndTime: undefined,
      actualDurationMinutes: undefined,
    };
    return this.addTask(copy);
  }

  public markComplete(taskId: string, complete = true): void {
    const tasks = this.getTasks();
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const updated: TaskItem = {
      ...t,
      completed: complete,
      status: complete ? 'Completed' : 'Incomplete',
      completedAt: complete ? new Date().toISOString() : undefined,
    };
    this.updateTask(updated);
    if (complete) this.clearReminder(taskId);
    else if (updated.reminder) this.scheduleReminder(updated);

    analyticsService.logEvent({
      type: complete ? 'task_completed' : 'custom',
      subject: updated.subject,
      details: { action: complete ? 'task_completed' : 'task_uncompleted', taskId, title: updated.title },
    });

    this.emit({
      type: complete ? 'task_completed' : 'tasks_updated',
      task: updated,
      taskId,
      timestamp: new Date().toISOString(),
    });
    this.refreshAnalyticsFromTasks();
  }

  public rescheduleTask(taskId: string, dueDate: string, startTime?: string, endTime?: string): void {
    const t = this.getTasks().find((x) => x.id === taskId);
    if (!t) return;
    const updated: TaskItem = {
      ...t,
      dueDate,
      startTime: startTime ?? t.startTime,
      endTime: endTime ?? t.endTime,
    };
    this.updateTask(updated);
  }

  // ─── Focus session integration ───────────────────────────────────────────

  public getFocusSessions(): FocusSessionRecord[] {
    try {
      const raw = localStorage.getItem(FOCUS_SESSIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveFocusSessions(sessions: FocusSessionRecord[]): void {
    try {
      localStorage.setItem(FOCUS_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 2000)));
    } catch {
      /* quota */
    }
  }

  public getActiveFocusTaskId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_FOCUS_KEY);
    } catch {
      return null;
    }
  }

  public getActiveTask(): TaskItem | null {
    const taskId = this.getActiveFocusTaskId();
    if (!taskId) return null;
    return this.getTasks().find((t) => t.id === taskId) || null;
  }

  private setActiveFocusTaskId(id: string | null): void {
    try {
      if (id) localStorage.setItem(ACTIVE_FOCUS_KEY, id);
      else localStorage.removeItem(ACTIVE_FOCUS_KEY);
    } catch {
      /* ignore */
    }
  }

  public startFocusSession(taskId: string): TaskItem | null {
    const t = this.getTasks().find((x) => x.id === taskId);
    if (!t) return null;
    // Pause any other in-progress task first
    this.getTasks()
      .filter((x) => x.status === 'In Progress' && x.id !== taskId)
      .forEach((x) => this.pauseFocusSession(x.id));
    const updated: TaskItem = {
      ...t,
      status: 'In Progress',
      actualStartTime: t.actualStartTime || new Date().toISOString(),
    };
    this.updateTask(updated);
    this.setActiveFocusTaskId(taskId);
    analyticsService.logEvent({
      type: 'study_session',
      subject: updated.subject,
      topic: updated.topic,
      details: { action: 'task_started', taskId, title: updated.title, chapter: updated.chapter },
    });
    this.emit({ type: 'task_started', task: updated, taskId, timestamp: new Date().toISOString() });
    return updated;
  }

  public pauseFocusSession(taskId: string): TaskItem | null {
    const t = this.getTasks().find((x) => x.id === taskId);
    if (!t || t.status !== 'In Progress') return null;
    const end = new Date();
    const start = t.actualStartTime ? new Date(t.actualStartTime) : end;
    const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const updated: TaskItem = {
      ...t,
      status: 'Pending',
      actualDurationMinutes: (t.actualDurationMinutes || 0) + mins,
      actualEndTime: end.toISOString(),
    };
    this.updateTask(updated);
    if (this.getActiveFocusTaskId() === taskId) this.setActiveFocusTaskId(null);
    try {
      localStorage.setItem(PAUSED_FOCUS_KEY, JSON.stringify({ taskId, pausedAt: end.toISOString(), accumulated: updated.actualDurationMinutes }));
    } catch {
      /* ignore */
    }
    analyticsService.logEvent({
      type: 'custom',
      durationMinutes: mins,
      subject: updated.subject,
      topic: updated.topic,
      details: { action: 'task_paused', taskId, title: updated.title, minutesLogged: mins, chapter: updated.chapter },
    });
    this.emit({ type: 'task_paused', task: updated, taskId, minutes: mins, timestamp: end.toISOString() });
    return updated;
  }

  public resumeFocusSession(taskId: string): TaskItem | null {
    return this.startFocusSession(taskId);
  }

  public stopFocusSession(taskId: string, markComplete = false): TaskItem | null {
    return this.endFocusSession(taskId, markComplete);
  }

  public archiveTask(taskId: string): void {
    const t = this.getTasks().find((x) => x.id === taskId);
    if (!t) return;
    try {
      const archived = JSON.parse(localStorage.getItem(ARCHIVED_TASKS_KEY) || '[]');
      archived.unshift({ ...t, archivedAt: new Date().toISOString() });
      localStorage.setItem(ARCHIVED_TASKS_KEY, JSON.stringify(archived.slice(0, 500)));
    } catch {
      /* ignore */
    }
    this.clearReminder(taskId);
    this.deleteTask(taskId);
    this.emit({ type: 'task_archived', taskId, task: t, timestamp: new Date().toISOString() });
  }

  public endFocusSession(
    taskId: string | null | undefined,
    markComplete = false,
    opts?: { durationMinutes?: number; breakMinutes?: number; source?: FocusSessionRecord['source']; subject?: string; chapter?: string; topic?: string; title?: string }
  ): TaskItem | null {
    const end = new Date();
    const dateStr = end.toISOString().slice(0, 10);
    let updated: TaskItem | null = null;
    let mins = opts?.durationMinutes ?? 0;
    let subject = opts?.subject || 'General';
    let chapter = opts?.chapter;
    let topic = opts?.topic;
    let title = opts?.title || 'Focus Session';

    if (taskId) {
      const t = this.getTasks().find((x) => x.id === taskId);
      if (t) {
        const start = t.actualStartTime ? new Date(t.actualStartTime) : end;
        if (!opts?.durationMinutes) {
          mins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
        }
        subject = t.subject || subject;
        chapter = t.chapter || chapter;
        topic = t.topic || topic;
        title = t.title || title;
        updated = {
          ...t,
          actualEndTime: end.toISOString(),
          actualDurationMinutes: (t.actualDurationMinutes || 0) + mins,
          status: markComplete ? 'Completed' : t.status === 'In Progress' ? 'Pending' : t.status,
          completed: markComplete ? true : t.completed,
          completedAt: markComplete ? end.toISOString() : t.completedAt,
        };
        this.updateTask(updated);
        if (markComplete) this.clearReminder(taskId);
      }
    }

    if (mins <= 0) mins = opts?.durationMinutes || 0;
    const breakMins = opts?.breakMinutes || 0;

    // Persist focus session record
    if (mins > 0) {
      const session: FocusSessionRecord = {
        id: `fs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        taskId: taskId || undefined,
        subject,
        chapter,
        topic,
        title,
        startTime: updated?.actualStartTime || new Date(end.getTime() - mins * 60000).toISOString(),
        endTime: end.toISOString(),
        durationMinutes: mins,
        breakMinutes: breakMins,
        completed: markComplete,
        source: opts?.source || 'manual',
        date: dateStr,
      };
      const sessions = this.getFocusSessions();
      sessions.unshift(session);
      this.saveFocusSessions(sessions);
      this.emit({
        type: 'focus_session_recorded',
        session,
        taskId: taskId || undefined,
        minutes: mins,
        breakMinutes: breakMins,
        subject,
        chapter,
        topic,
        timestamp: end.toISOString(),
      });
    }

    // Update daily activity log
    if (mins > 0) {
      try {
        const logs: StudyActivityLog[] = (db.getActivityLogs?.() as StudyActivityLog[]) || [];
        const existing = logs.find((l) => l.date === dateStr);
        if (existing) {
          existing.studyMinutes = (existing.studyMinutes || 0) + mins;
          existing.breakMinutes = (existing.breakMinutes || 0) + breakMins;
          existing.productivityScore = Math.min(100, Math.round(((existing.studyMinutes || 0) / Math.max(1, (existing.studyMinutes || 0) + (existing.breakMinutes || 0) + (existing.idleMinutes || 0))) * 100));
        } else {
          logs.push({
            date: dateStr,
            studyMinutes: mins,
            idleMinutes: 0,
            breakMinutes: breakMins,
            lectureMinutes: 0,
            questionSolvingMinutes: 0,
            revisionMinutes: 0,
            flashcardsMinutes: 0,
            pdfReadingMinutes: 0,
            browserMinutes: 0,
            productivityScore: 100,
          } as StudyActivityLog);
        }
        db.setActivityLogs?.(logs);
      } catch {
        /* optional */
      }
    }

    if (this.getActiveFocusTaskId() === taskId) this.setActiveFocusTaskId(null);

    this.emit({
      type: 'focus_session_ended',
      task: updated || undefined,
      taskId: taskId || undefined,
      minutes: mins,
      breakMinutes: breakMins,
      subject,
      chapter,
      topic,
      timestamp: end.toISOString(),
    });
    this.refreshAnalyticsFromTasks();
    return updated;
  }

  public addBreakMinutes(mins: number): void {
    if (mins <= 0) return;
    const end = new Date();
    try {
      analyticsService.logEvent({
        type: 'break_ended',
        breakMinutes: mins,
        details: { action: 'break_stopwatch_ended', breakMinutes: mins },
      });
      this.refreshAnalyticsFromTasks();
      this.emit({ type: 'analytics_refresh', timestamp: end.toISOString() });
    } catch (e) {
      console.warn('addBreakMinutes failed:', e);
    }
  }

  /**
   * Called by Pomodoro when a focus block completes (with or without linked task).
   */
  public recordPomodoroSession(opts: {
    durationMinutes: number;
    breakMinutes?: number;
    subject?: string;
    chapter?: string;
    topic?: string;
    title?: string;
    markComplete?: boolean;
  }): void {
    const taskId = this.getActiveFocusTaskId();
    this.endFocusSession(taskId, opts.markComplete ?? false, {
      durationMinutes: opts.durationMinutes,
      breakMinutes: opts.breakMinutes || 0,
      source: 'pomodoro',
      subject: opts.subject,
      chapter: opts.chapter,
      topic: opts.topic,
      title: opts.title || 'Pomodoro Focus',
    });
  }

  // ─── Progress snapshot for Latest Progress widget ────────────────────────

  public getTodayProgressSnapshot() {
    const today = new Date().toISOString().slice(0, 10);
    const tasks = this.getTodaysTasks(today);
    const completed = tasks.filter((t) => t.completed || t.status === 'Completed');
    const pending = tasks.filter((t) => !t.completed && t.status !== 'Completed');
    const active = tasks.find((t) => t.status === 'In Progress');
    const lastCompleted = completed
      .slice()
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];
    const upcoming = pending
      .filter((t) => t.startTime)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))[0];
    const studyMinutes = tasks.reduce((s, t) => s + (t.actualDurationMinutes || 0), 0);
    return {
      completedCount: completed.length,
      pendingCount: pending.length,
      totalCount: tasks.length,
      todayStudyMinutes: studyMinutes,
      activeTask: active || null,
      lastCompletedSession: lastCompleted || null,
      upcomingSession: upcoming || null,
      tasks,
    };
  }

  // ─── Analytics refresh from planner / focus ──────────────────────────────

  public refreshAnalyticsFromTasks(): void {
    this.emit({ type: 'analytics_refresh', timestamp: new Date().toISOString() });
  }

  // ─── Offline reminders ───────────────────────────────────────────────────

  public scheduleReminder(task: TaskItem): void {
    this.clearReminder(task.id);
    if (!task.reminder || !task.dueDate) return;
    const timePart = task.reminderTime || task.startTime || '09:00';
    const when = new Date(`${task.dueDate}T${timePart.length === 5 ? timePart + ':00' : timePart}`);
    const delay = when.getTime() - Date.now();
    if (delay <= 0 || delay > 7 * 24 * 3600 * 1000) return; // only schedule within a week
    const timer = setTimeout(() => {
      notificationService.add(
        'Study Reminder',
        `${task.title} — ${task.subject}${task.chapter ? ' · ' + task.chapter : ''}`,
        { native: true }
      );
      this.emit({ type: 'reminder_due', task, taskId: task.id, timestamp: new Date().toISOString() });
      this.reminderTimers.delete(task.id);
    }, delay);
    this.reminderTimers.set(task.id, timer);
  }

  public clearReminder(taskId: string): void {
    const t = this.reminderTimers.get(taskId);
    if (t) {
      clearTimeout(t);
      this.reminderTimers.delete(taskId);
    }
  }

  public rescheduleAllReminders(): void {
    this.getTasks().forEach((t) => {
      if (t.reminder && !t.completed) this.scheduleReminder(t);
    });
  }

  // ─── Motivational quotes (no-repeat until exhausted) ─────────────────────

  public readonly MOTIVATIONAL_QUOTES = [
    { quote: 'Excellence is not an act, but a habit. Make revision a daily ritual.', author: 'SRS Active Recall' },
    { quote: 'Quality study hours always outperform mindless marathon cramming.', author: 'Deep Work Principle' },
    { quote: 'Clear concepts lead to confident solutions under examination pressure.', author: 'Accuracy Maxim' },
    { quote: 'Push yourself, because no one else is going to do it for you.', author: 'Self Motivation' },
    { quote: 'Syllabus coverage gives confidence; revision and practice give top ranks.', author: 'AIR Strategy' },
    { quote: 'The expert in anything was once a beginner who refused to quit.', author: 'Growth Mindset' },
    { quote: 'Consistency compounds. One focused hour every day beats sporadic sprints.', author: 'Habit Science' },
    { quote: 'Weak topics are opportunities. Attack them early, not the night before the exam.', author: 'GATE Strategy' },
    { quote: 'Write it, solve it, teach it — three paths to permanent memory.', author: 'Feynman Technique' },
    { quote: 'Your future self is watching. Make today count toward that rank.', author: 'Future Self' },
    { quote: 'Mock tests are not failures — they are diagnostic maps to rank improvement.', author: 'Test Analytics' },
    { quote: 'Sleep, nutrition, and breaks are study tools, not distractions.', author: 'Peak Performance' },
  ];

  public getNextQuote(): { quote: string; author: string } {
    const list = this.MOTIVATIONAL_QUOTES;
    if (this.usedQuoteIndices.size >= list.length) this.usedQuoteIndices.clear();
    let idx = this.quoteIndex % list.length;
    let attempts = 0;
    while (this.usedQuoteIndices.has(idx) && attempts < list.length) {
      idx = (idx + 1) % list.length;
      attempts++;
    }
    this.usedQuoteIndices.add(idx);
    this.quoteIndex = (idx + 1) % list.length;
    return list[idx] || { quote: 'Consistency is key to GATE success.', author: 'StudyOS' };
  }

  // ─── Live GATE Analytics (from sessions + tasks + syllabus) ──────────────

  public getLiveAnalytics(): LiveAnalyticsSnapshot {
    const today = new Date().toISOString().slice(0, 10);
    const sessions = this.getFocusSessions();
    const tasks = this.getTasks();
    const logs = (db.getActivityLogs?.() as StudyActivityLog[]) || [];
    const syllabus = db.getSyllabus?.() || [];
    const settings = db.getSettings?.() || { targetExamDate: '2027-02-07', dailyGoalHours: 7 };

    const minutesByDate = new Map<string, number>();
    const tasksByDate = new Map<string, number>();
    sessions.forEach((s) => {
      minutesByDate.set(s.date, (minutesByDate.get(s.date) || 0) + s.durationMinutes);
    });
    logs.forEach((l) => {
      if (!minutesByDate.has(l.date)) minutesByDate.set(l.date, l.studyMinutes || 0);
      else minutesByDate.set(l.date, Math.max(minutesByDate.get(l.date) || 0, l.studyMinutes || 0));
    });
    tasks
      .filter((t) => t.completed && t.completedAt)
      .forEach((t) => {
        const d = t.completedAt!.slice(0, 10);
        tasksByDate.set(d, (tasksByDate.get(d) || 0) + 1);
      });

    const todayStudyMinutes =
      minutesByDate.get(today) ||
      tasks.filter((t) => t.dueDate === today).reduce((s, t) => s + (t.actualDurationMinutes || 0), 0);

    let totalStudyMinutes = 0;
    minutesByDate.forEach((v) => {
      totalStudyMinutes += v;
    });
    // Fallback: sum task actual durations if no sessions yet
    if (totalStudyMinutes === 0) {
      totalStudyMinutes = tasks.reduce((s, t) => s + (t.actualDurationMinutes || 0), 0);
    }

    // Streak: consecutive days with study > 0 ending today or yesterday
    const sortedDates = Array.from(minutesByDate.keys()).sort();
    let streak = 0;
    const check = new Date();
    for (let i = 0; i < 400; i++) {
      const ds = check.toISOString().slice(0, 10);
      const mins = minutesByDate.get(ds) || 0;
      if (mins > 0) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else if (i === 0) {
        // allow missing today — start from yesterday
        check.setDate(check.getDate() - 1);
      } else break;
    }

    // Syllabus completion
    let totalTopics = 0;
    let completedTopics = 0;
    syllabus.forEach((sub: any) => {
      (sub.topics || []).forEach((top: any) => {
        totalTopics++;
        if (top.status === 'Completed' || (top.completedHours || 0) >= (top.idealHours || 1)) completedTopics++;
      });
    });
    const completionPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    const remainingSyllabusPercent = 100 - completionPercent;

    // Predicted completion date
    let predictedCompletionDate: string | null = null;
    const dailyGoal = (settings.dailyGoalHours || 7) * 60;
    const avgDaily =
      sortedDates.length > 0
        ? totalStudyMinutes / Math.max(1, sortedDates.length)
        : dailyGoal;
    if (avgDaily > 0 && remainingSyllabusPercent > 0 && totalTopics > 0) {
      const remainingTopics = totalTopics - completedTopics;
      const estDays = Math.ceil((remainingTopics / Math.max(1, completedTopics || 1)) * (sortedDates.length || 7));
      const pred = new Date();
      pred.setDate(pred.getDate() + Math.min(estDays, 400));
      predictedCompletionDate = pred.toISOString().slice(0, 10);
    }

    // Exam readiness: blend syllabus + study consistency + mock proxy
    const consistency = Math.min(100, streak * 5);
    const volumeScore = Math.min(100, Math.round((totalStudyMinutes / 60 / 100) * 100)); // ~100h → 100
    const examReadiness = Math.round(completionPercent * 0.5 + consistency * 0.25 + volumeScore * 0.25);

    // Daily (last 30)
    const daily: LiveAnalyticsSnapshot['daily'] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      daily.push({
        date: ds,
        minutes: minutesByDate.get(ds) || 0,
        tasksCompleted: tasksByDate.get(ds) || 0,
      });
    }

    // Weekly (last 12 weeks)
    const weeklyMap = new Map<string, { minutes: number; tasksCompleted: number }>();
    daily.forEach((d) => {
      const dt = new Date(d.date);
      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      const key = weekStart.toISOString().slice(0, 10);
      const cur = weeklyMap.get(key) || { minutes: 0, tasksCompleted: 0 };
      cur.minutes += d.minutes;
      cur.tasksCompleted += d.tasksCompleted;
      weeklyMap.set(key, cur);
    });
    const weekly = Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, v]) => ({ week, ...v }));

    // Monthly (last 12)
    const monthlyMap = new Map<string, { minutes: number; tasksCompleted: number }>();
    sessions.forEach((s) => {
      const m = s.date.slice(0, 7);
      const cur = monthlyMap.get(m) || { minutes: 0, tasksCompleted: 0 };
      cur.minutes += s.durationMinutes;
      monthlyMap.set(m, cur);
    });
    tasks
      .filter((t) => t.completed && t.completedAt)
      .forEach((t) => {
        const m = t.completedAt!.slice(0, 7);
        const cur = monthlyMap.get(m) || { minutes: 0, tasksCompleted: 0 };
        cur.tasksCompleted += 1;
        monthlyMap.set(m, cur);
      });
    const monthly = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));

    // Subject / chapter / topic wise
    const subjectMap = new Map<string, { minutes: number; tasksCompleted: number }>();
    const chapterMap = new Map<string, { subject: string; chapter: string; minutes: number; tasksCompleted: number }>();
    const topicMap = new Map<string, { subject: string; chapter?: string; topic: string; minutes: number; tasksCompleted: number }>();

    sessions.forEach((s) => {
      const sub = s.subject || 'General';
      const sc = subjectMap.get(sub) || { minutes: 0, tasksCompleted: 0 };
      sc.minutes += s.durationMinutes;
      subjectMap.set(sub, sc);
      if (s.chapter) {
        const key = `${sub}||${s.chapter}`;
        const ch = chapterMap.get(key) || { subject: sub, chapter: s.chapter, minutes: 0, tasksCompleted: 0 };
        ch.minutes += s.durationMinutes;
        chapterMap.set(key, ch);
      }
      if (s.topic) {
        const key = `${sub}||${s.chapter || ''}||${s.topic}`;
        const tp = topicMap.get(key) || { subject: sub, chapter: s.chapter, topic: s.topic, minutes: 0, tasksCompleted: 0 };
        tp.minutes += s.durationMinutes;
        topicMap.set(key, tp);
      }
    });

    tasks.forEach((t) => {
      if (!t.completed) return;
      const sub = t.subject || 'General';
      const sc = subjectMap.get(sub) || { minutes: 0, tasksCompleted: 0 };
      sc.tasksCompleted += 1;
      sc.minutes += t.actualDurationMinutes || 0;
      subjectMap.set(sub, sc);
      if (t.chapter) {
        const key = `${sub}||${t.chapter}`;
        const ch = chapterMap.get(key) || { subject: sub, chapter: t.chapter, minutes: 0, tasksCompleted: 0 };
        ch.tasksCompleted += 1;
        ch.minutes += t.actualDurationMinutes || 0;
        chapterMap.set(key, ch);
      }
      if (t.topic) {
        const key = `${sub}||${t.chapter || ''}||${t.topic}`;
        const tp = topicMap.get(key) || { subject: sub, chapter: t.chapter, topic: t.topic, minutes: 0, tasksCompleted: 0 };
        tp.tasksCompleted += 1;
        tp.minutes += t.actualDurationMinutes || 0;
        topicMap.set(key, tp);
      }
    });

    const subjectTopicTotals = new Map<string, { total: number; done: number }>();
    syllabus.forEach((sub: any) => {
      const name = sub.name;
      let total = 0;
      let done = 0;
      (sub.topics || []).forEach((top: any) => {
        total++;
        if (top.status === 'Completed') done++;
      });
      subjectTopicTotals.set(name, { total, done });
    });

    const subjectWise = Array.from(subjectMap.entries()).map(([subject, v]) => {
      const totals = subjectTopicTotals.get(subject) || { total: 0, done: 0 };
      return {
        subject,
        minutes: v.minutes,
        tasksCompleted: v.tasksCompleted,
        topicsCompleted: totals.done,
        totalTopics: totals.total,
        percent: totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0,
      };
    });

    const chapterWise = Array.from(chapterMap.values());
    const topicWise = Array.from(topicMap.values());

    // Heatmap intensity 0-4 based on minutes
    const heatmap = daily.map((d) => {
      let intensity = 0;
      if (d.minutes >= 240) intensity = 4;
      else if (d.minutes >= 120) intensity = 3;
      else if (d.minutes >= 60) intensity = 2;
      else if (d.minutes > 0) intensity = 1;
      return { date: d.date, intensity, minutes: d.minutes };
    });

    const todaySnap = this.getTodayProgressSnapshot();

    return {
      todayStudyMinutes,
      todayBreakMinutes: 0,
      totalStudyMinutes,
      totalStudyHours: Math.round((totalStudyMinutes / 60) * 10) / 10,
      currentStreak: streak,
      completionPercent,
      remainingSyllabusPercent,
      predictedCompletionDate,
      examReadiness,
      daily,
      weekly,
      monthly,
      subjectWise,
      chapterWise,
      topicWise,
      heatmap,
      completedTasks: todaySnap.completedCount,
      pendingTasks: todaySnap.pendingCount,
      activeTask: todaySnap.activeTask,
      upcomingTask: todaySnap.upcomingSession,
      lastCompletedTask: todaySnap.lastCompletedSession,
    };
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  public getProfile(): UserProfile {
    return authService.getCurrentUser();
  }

  public updateProfile(partial: Partial<UserProfile>): UserProfile {
    const current = authService.getCurrentUser();
    const next = { ...current, ...partial, updatedAt: new Date().toISOString() };
    authService.updateUserProfile(next);
    this.emit({ type: 'profile_updated', profile: next, timestamp: new Date().toISOString() });
    safeDispatch(new Event('studyos_profile_updated'));
    return next;
  }
}

export const syncService = new SyncService();
