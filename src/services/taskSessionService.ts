import { db } from './db';
import { syncService } from './syncService';
import { analyticsService, AnalyticsEventType } from './analyticsService';
import { TaskItem, TaskHistoryRecord } from '../types';

export interface TodaySummary {
  currentTask: TaskItem | null;
  upcomingTasks: TaskItem[];
  completedTasks: TaskItem[];
  runningTimer: {
    taskId: string;
    elapsedSeconds: number;
    isRunning: boolean;
    isPaused: boolean;
  } | null;
  focusTimeMinutes: number;
  breakTimeMinutes: number;
  completionPercentage: number;
  remainingTimeMinutes: number;
  dailyProductivityScore: number;
}

class TaskSessionService {
  private lastRolloverDate: string = '';
  private checkIntervalTimer: any = null;

  constructor() {
    // Constructor kept clean to avoid premature initialization or TDZ execution during module load
  }

  public initDayRolloverCheck(): void {
    const today = this.getTodayDateString();
    this.lastRolloverDate = localStorage.getItem('studyos_last_rollover_date') || today;
    localStorage.setItem('studyos_last_rollover_date', today);

    // Initial check on load
    this.checkAndPerformDayRollover();

    // Setup periodic check every 30 seconds
    if (typeof window !== 'undefined') {
      if (this.checkIntervalTimer) clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = setInterval(() => {
        this.checkAndPerformDayRollover();
      }, 30000);

      window.addEventListener('focus', () => {
        this.checkAndPerformDayRollover();
      });
    }
  }

  public getTodayDateString(): string {
    return new Date().toISOString().split('T')[0] || '';
  }

  /**
   * Automatically resets Today's Tasks on day change (12:00 AM)
   * Moves previous tasks to Task History, preserves all metrics, never deletes tasks.
   */
  public checkAndPerformDayRollover(): void {
    const todayStr = this.getTodayDateString();
    if (this.lastRolloverDate && this.lastRolloverDate !== todayStr) {
      console.log(`[TaskSessionService] Performing Midnight Rollover: ${this.lastRolloverDate} -> ${todayStr}`);
      this.performDayRollover(this.lastRolloverDate, todayStr);
      this.lastRolloverDate = todayStr;
      localStorage.setItem('studyos_last_rollover_date', todayStr);
    } else {
      // Sync timetable entries for today
      this.syncTimetableToTasks(todayStr);
    }
  }

  public performDayRollover(previousDate: string, todayDate: string): void {
    const allTasks = db.getTasks();
    const pastTasks = allTasks.filter((t) => t.dueDate < todayDate && !t.archived);

    pastTasks.forEach((task) => {
      // 1. Convert past task to permanent Task History record
      const isDone = task.completed || task.status === 'Completed';
      const historyRecord: TaskHistoryRecord = {
        id: `hist-${task.id}-${task.dueDate}`,
        taskId: task.id,
        taskName: task.title,
        date: task.dueDate,
        subject: task.subject || 'General',
        category: task.type || task.category || 'Study Session',
        scheduledStartTime: task.startTime || '09:00',
        scheduledEndTime: task.endTime || '10:00',
        actualStartTime: task.actualStartTime,
        actualEndTime: task.actualEndTime,
        completionStatus: isDone ? 'Completed' : 'Missed',
        completionPercentage: isDone ? 100 : task.actualDurationMinutes && task.estimatedMinutes ? Math.min(100, Math.round((task.actualDurationMinutes / task.estimatedMinutes) * 100)) : 0,
        activeStudyTimeMinutes: task.actualDurationMinutes || (isDone ? task.estimatedMinutes : 0),
        breakTimeMinutes: 0,
        pauseCount: 0,
        productivityScore: isDone ? 90 : 30,
        focusScore: isDone ? 85 : 20,
        notes: task.notes || task.description,
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.addTaskHistoryRecord(historyRecord);

      // Log analytics event for missed or historical completed task
      if (!isDone) {
        analyticsService.logEvent({
          type: 'task_missed',
          subject: task.subject,
          details: { taskId: task.id, title: task.title, date: task.dueDate },
        });
      }

      // Mark task as archived in active tasks list to avoid double counting, but NEVER delete
      task.archived = true;
      if (!isDone) {
        task.status = 'Incomplete';
      }
    });

    db.setTasks(allTasks);

    analyticsService.logEvent({
      type: 'day_rollover',
      details: { previousDate, todayDate, archivedCount: pastTasks.length },
    });

    // 2. Sync timetable slots for today
    this.syncTimetableToTasks(todayDate);

    // 3. Emit sync events to refresh all components
    syncService.emit({ type: 'tasks_updated', timestamp: new Date().toISOString() });
    syncService.emit({ type: 'analytics_refresh', timestamp: new Date().toISOString() });
  }

  /**
   * Bidirectional Timetable <-> Today's Tasks
   * Creates today's tasks from timetable routine slots
   */
  public syncTimetableToTasks(todayDate: string = this.getTodayDateString()): void {
    const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const settings = db.getSettings();
    const timetableSlots = settings.timetableSlots || [];
    const todaySlots = timetableSlots.filter((s) => s.day === todayDayName || s.day === 'Daily');

    if (todaySlots.length === 0) return;

    const currentTasks = db.getTasks();
    let updated = false;

    todaySlots.forEach((slot) => {
      const existing = currentTasks.find(
        (t) => t.dueDate === todayDate && (t.linkedSessionId === slot.id || (t.title === slot.subject && t.startTime === slot.startTime))
      );

      if (!existing) {
        const startHour = slot.startTime ? parseInt(slot.startTime.split(':')[0] || '9', 10) : 9;
        const slotTimeSlot: 'Morning' | 'Afternoon' | 'Night' =
          startHour < 12 ? 'Morning' : startHour < 17 ? 'Afternoon' : 'Night';

        const newTask: TaskItem = {
          id: `task-tt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: slot.subject || 'Timetable Study Slot',
          subject: slot.subject || 'General',
          type: 'Study Session',
          dueDate: todayDate,
          timeSlot: slotTimeSlot,
          priority: 'High',
          estimatedMinutes: slot.durationMinutes || 60,
          completed: false,
          status: 'Pending',
          startTime: slot.startTime || '09:00',
          endTime: slot.endTime || '10:00',
          linkedSessionId: slot.id,
          category: 'Timetable Routine',
          notes: slot.topic ? `Topic: ${slot.topic}` : undefined,
          createdAt: new Date().toISOString(),
        };

        currentTasks.unshift(newTask);
        updated = true;

        this.logAnalyticsEvent('task_created', newTask);
      }
    });

    if (updated) {
      db.setTasks(currentTasks);
      syncService.emit({ type: 'tasks_updated', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Add or update a task with bidirectional timetable sync
   */
  public saveTask(task: TaskItem): void {
    const allTasks = db.getTasks();
    const existingIdx = allTasks.findIndex((t) => t.id === task.id);
    const isNew = existingIdx === -1;

    if (isNew) {
      allTasks.unshift(task);
      this.logAnalyticsEvent('task_created', task);
    } else {
      allTasks[existingIdx] = { ...task, updatedAt: new Date().toISOString() };
    }

    db.setTasks(allTasks);

    // Bidirectional sync: Update or create timetable entry if applicable
    if (task.startTime && task.dueDate === this.getTodayDateString()) {
      const settings = db.getSettings();
      const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      let ttSlots = settings.timetableSlots || [];
      const slotIdx = ttSlots.findIndex((s) => s.id === task.linkedSessionId || (s.subject === task.subject && s.startTime === task.startTime));

      if (slotIdx !== -1) {
        ttSlots[slotIdx] = {
          ...ttSlots[slotIdx],
          subject: task.subject,
          topic: task.title,
          startTime: task.startTime,
          endTime: task.endTime || '10:00',
          durationMinutes: task.estimatedMinutes,
        };
      } else {
        ttSlots.push({
          id: `tt-${Date.now()}`,
          day: todayDayName,
          subject: task.subject,
          topic: task.title,
          startTime: task.startTime,
          endTime: task.endTime || '10:00',
          durationMinutes: task.estimatedMinutes,
        });
      }
      settings.timetableSlots = ttSlots;
      db.setSettings(settings);
    }

    // Save to task history
    this.recordTaskHistory(task);

    syncService.emit({ type: 'tasks_updated', task, taskId: task.id, timestamp: new Date().toISOString() });
  }

  /**
   * Complete or reopen a task
   */
  public toggleTaskCompletion(taskId: string): void {
    const allTasks = db.getTasks();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    task.status = task.completed ? 'Completed' : 'Pending';
    task.completedAt = task.completed ? new Date().toISOString() : undefined;
    task.actualEndTime = task.completed ? new Date().toLocaleTimeString('en-US', { hour12: false }) : undefined;
    if (task.completed && !task.actualDurationMinutes) {
      task.actualDurationMinutes = task.estimatedMinutes;
    }

    db.setTasks(allTasks);

    this.recordTaskHistory(task);
    this.logAnalyticsEvent(task.completed ? 'task_completed' : 'task_resumed', task);

    syncService.emit({ type: 'task_completed', task, taskId: task.id, timestamp: new Date().toISOString() });
  }

  /**
   * Start focus session on a task
   */
  public startTaskFocus(taskId: string): void {
    const allTasks = db.getTasks();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    task.status = 'In Progress';
    task.actualStartTime = task.actualStartTime || new Date().toLocaleTimeString('en-US', { hour12: false });
    db.setTasks(allTasks);

    syncService.startFocusSession(taskId);
    this.logAnalyticsEvent('task_started', task);
    this.logAnalyticsEvent('focus_started', task);
  }

  /**
   * Pause focus session
   */
  public pauseTaskFocus(taskId: string): void {
    const allTasks = db.getTasks();
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    syncService.pauseFocusSession(taskId);
    this.logAnalyticsEvent('task_paused', task);
    this.logAnalyticsEvent('break_started', task);
  }

  /**
   * Calculates productivity score dynamically based on focus-to-break ratio,
   * completion status, planned vs actual duration, and total session duration.
   */
  public calculateProductivityScore(params: {
    focusMinutes: number;
    breakMinutes: number;
    isCompleted: boolean;
    plannedMinutes: number;
    actualMinutes: number;
    pauseCount?: number;
  }): number {
    const {
      focusMinutes,
      breakMinutes,
      isCompleted,
      plannedMinutes,
      actualMinutes,
      pauseCount = 0,
    } = params;

    const totalMins = focusMinutes + breakMinutes;
    const focusRatio = totalMins > 0 ? focusMinutes / totalMins : 1.0;

    // 1. Ratio Component (35% weight)
    const ratioScore = Math.min(100, Math.round(focusRatio * 115));

    // 2. Completion Status (35% weight)
    const completionScore = isCompleted ? 100 : 40;

    // 3. Planned vs Actual Duration Alignment (30% weight)
    let durationScore = 80;
    if (plannedMinutes > 0) {
      const variance = actualMinutes / plannedMinutes;
      if (variance >= 0.8 && variance <= 1.25) {
        durationScore = 100;
      } else if (variance < 0.8) {
        durationScore = Math.max(30, Math.round(variance * 100));
      } else {
        durationScore = Math.max(40, Math.round(100 - (variance - 1.25) * 50));
      }
    }

    let rawScore = Math.round(ratioScore * 0.35 + completionScore * 0.35 + durationScore * 0.30);

    // Pause Penalty
    if (pauseCount > 0) {
      rawScore = Math.max(10, rawScore - Math.min(15, pauseCount * 3));
    }

    return Math.min(100, Math.max(0, rawScore));
  }

  /**
   * Record a TaskHistoryRecord from a TaskItem
   */
  public recordTaskHistory(task: TaskItem): void {
    const isDone = task.completed || task.status === 'Completed';
    const focusMins = task.actualDurationMinutes || (isDone ? task.estimatedMinutes : 0);
    const breakMins = 0;
    const prodScore = this.calculateProductivityScore({
      focusMinutes: focusMins,
      breakMinutes: breakMins,
      isCompleted: isDone,
      plannedMinutes: task.estimatedMinutes,
      actualMinutes: focusMins,
      pauseCount: 0,
    });

    const historyRecord: TaskHistoryRecord = {
      id: `hist-${task.id}`,
      taskId: task.id,
      taskName: task.title,
      date: task.dueDate || this.getTodayDateString(),
      subject: task.subject || 'General',
      category: task.type || task.category || 'Study Session',
      scheduledStartTime: task.startTime,
      scheduledEndTime: task.endTime,
      actualStartTime: task.actualStartTime,
      actualEndTime: task.actualEndTime,
      completionStatus: isDone ? 'Completed' : (task.status as any) || 'Pending',
      completionPercentage: isDone ? 100 : task.actualDurationMinutes && task.estimatedMinutes ? Math.min(100, Math.round((task.actualDurationMinutes / task.estimatedMinutes) * 100)) : 0,
      activeStudyTimeMinutes: focusMins,
      breakTimeMinutes: breakMins,
      pauseCount: 0,
      productivityScore: prodScore,
      focusScore: Math.min(100, Math.round(prodScore * 0.95)),
      notes: task.notes || task.description,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.addTaskHistoryRecord(historyRecord);
  }

  /**
   * Log analytics event into the single global Analytics source of truth
   */
  private logAnalyticsEvent(eventType: AnalyticsEventType, task: TaskItem): void {
    analyticsService.logEvent({
      type: eventType,
      subject: task.subject,
      durationMinutes: task.actualDurationMinutes || task.estimatedMinutes,
      details: {
        taskId: task.id,
        title: task.title,
        dueDate: task.dueDate,
        timeSlot: task.timeSlot,
        status: task.status,
      },
    });
  }

  /**
   * Today's Summary & Live Dashboard Metrics
   */
  public getTodaySummary(): TodaySummary {
    const todayStr = this.getTodayDateString();
    const allTasks = db.getTasks();
    const todayTasks = allTasks.filter((t) => t.dueDate === todayStr && !t.archived);

    const completed = todayTasks.filter((t) => t.completed || t.status === 'Completed');
    const upcoming = todayTasks.filter((t) => !t.completed && t.status !== 'Completed');

    const inProgressTask = todayTasks.find((t) => t.status === 'In Progress') || upcoming[0] || null;

    const liveAnalytics = syncService.getLiveAnalytics();

    const totalEstMins = todayTasks.reduce((a, t) => a + (t.estimatedMinutes || 30), 0);
    const completedEstMins = completed.reduce((a, t) => a + (t.estimatedMinutes || 30), 0);
    const remainingMins = Math.max(0, totalEstMins - completedEstMins);

    const completionPct = todayTasks.length > 0 ? Math.round((completed.length / todayTasks.length) * 100) : 0;

    return {
      currentTask: inProgressTask,
      upcomingTasks: upcoming,
      completedTasks: completed,
      runningTimer: syncService.getActiveTask()
        ? {
            taskId: syncService.getActiveTask()!.id,
            elapsedSeconds: 0,
            isRunning: true,
            isPaused: false,
          }
        : null,
      focusTimeMinutes: liveAnalytics.todayStudyMinutes,
      breakTimeMinutes: liveAnalytics.todayBreakMinutes,
      completionPercentage: completionPct,
      remainingTimeMinutes: remainingMins,
      dailyProductivityScore: todayTasks.length > 0 ? Math.min(100, Math.round(completionPct * 0.7 + (liveAnalytics.todayStudyMinutes > 0 ? 30 : 0))) : 85,
    };
  }
}

export const taskSessionService = new TaskSessionService();
