/**
 * ActivityEventService — Centralized Activity Event System
 * Single source of truth for all activity logging across StudyOS:
 * - Study Browser
 * - PDF Workspace
 * - Study Hub
 * - Timetable
 * - Today's Tasks
 * - Focus Mode
 * - Planner
 * - Notes
 * - Mock Tests
 *
 * Local & offline only. No cloud tracking.
 */

import { analyticsService, AnalyticsEventType } from './analyticsService';
import { syncService } from './syncService';
import { db } from './db';

export interface ActivityEventRecord {
  id: string;
  timestamp: string;
  date: string;
  module:
    | 'study-browser'
    | 'pdf'
    | 'study-hub'
    | 'timetable'
    | 'tasks'
    | 'focus'
    | 'planner'
    | 'notes'
    | 'tests';
  action: string;
  title: string;
  subject?: string;
  topic?: string;
  course?: string;
  durationMinutes?: number;
  breakMinutes?: number;
  url?: string;
  details?: Record<string, unknown>;
}

const ACTIVITY_STORAGE_KEY = 'studyos_activity_events_v1';

class ActivityEventService {
  private events: ActivityEventRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.events = this.loadEvents();
  }

  private loadEvents(): ActivityEventRecord[] {
    try {
      const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(this.events.slice(-2000)));
    } catch (e) {
      console.warn('[ActivityEventService] Failed to persist activity events:', e);
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
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getEvents(limit = 100): ActivityEventRecord[] {
    return [...this.events].reverse().slice(0, limit);
  }

  public getEventsForDate(dateStr: string): ActivityEventRecord[] {
    return this.events.filter((e) => e.date === dateStr);
  }

  public logEvent(record: Omit<ActivityEventRecord, 'id' | 'timestamp' | 'date'>): ActivityEventRecord {
    const ts = new Date().toISOString();
    const date = ts.split('T')[0] || '';
    const fullRecord: ActivityEventRecord = {
      ...record,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: ts,
      date,
    };

    this.events.push(fullRecord);
    if (this.events.length > 3000) {
      this.events = this.events.slice(-3000);
    }
    this.persist();
    this.notify();

    // Route to analyticsService
    const analyticsType = this.mapModuleToActionType(record.module, record.action);
    analyticsService.logEvent({
      type: analyticsType,
      subject: record.subject,
      topic: record.topic || record.title,
      course: record.course,
      durationMinutes: record.durationMinutes,
      breakMinutes: record.breakMinutes,
      details: {
        module: record.module,
        action: record.action,
        url: record.url,
        ...record.details,
      },
    });

    syncService.emit({ type: 'analytics_refresh', timestamp: ts });
    return fullRecord;
  }

  public trackBrowserStudyStart(domain: string, title: string, url: string, subject?: string): void {
    this.logEvent({
      module: 'study-browser',
      action: 'BROWSER_STUDY_STARTED',
      title: title || domain,
      url,
      subject: subject || 'General Study',
      details: { domain, focusScore: 90 },
    });
  }

  public trackBrowserStudyComplete(
    domain: string,
    title: string,
    url: string,
    durationMinutes: number,
    subject?: string
  ): void {
    if (durationMinutes <= 0) return;
    this.logEvent({
      module: 'study-browser',
      action: 'BROWSER_STUDY_COMPLETED',
      title: title || domain,
      url,
      subject: subject || 'General Study',
      durationMinutes,
      details: { domain, focusScore: 92 },
    });
  }

  public trackWebBrowsing(url: string, title: string, durationMinutes: number, subject?: string): void {
    if (durationMinutes <= 0) return;
    this.logEvent({
      module: 'study-browser',
      action: 'page_studied',
      title,
      url,
      subject: subject || 'General Study',
      durationMinutes,
    });
  }

  public trackLectureSession(
    title: string,
    course: string | undefined,
    durationMinutes: number,
    completed: boolean,
    subject?: string
  ): void {
    this.logEvent({
      module: 'planner',
      action: completed ? 'lecture_completed' : 'lecture_studied',
      title,
      course,
      subject: subject || course || 'General',
      durationMinutes,
    });
  }

  public trackPDFReading(pdfName: string, durationMinutes: number, pageNum?: number, subject?: string): void {
    this.logEvent({
      module: 'pdf',
      action: 'pdf_read',
      title: `PDF: ${pdfName}`,
      subject: subject || 'General',
      durationMinutes,
      details: { pageNum },
    });
  }

  public trackFocusBreakSession(
    type: 'focus' | 'break',
    durationMinutes: number,
    subject?: string,
    topic?: string
  ): void {
    this.logEvent({
      module: 'focus',
      action: type === 'focus' ? 'focus_session' : 'break_session',
      title: type === 'focus' ? 'Pomodoro Focus Session' : 'Pomodoro Recovery Break',
      subject: subject || 'General',
      topic,
      durationMinutes: type === 'focus' ? durationMinutes : 0,
      breakMinutes: type === 'break' ? durationMinutes : 0,
    });
  }

  public clearAllEvents(): void {
    this.events = [];
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    this.notify();
  }

  private mapModuleToActionType(module: string, action: string): AnalyticsEventType {
    if (action.includes('completed') && module === 'planner') return 'lecture_completed';
    if (action.includes('lecture')) return 'lecture_started';
    if (action.includes('break')) return 'break_ended';
    if (action.includes('focus')) return 'focus_ended';
    if (action.includes('note')) return 'note_created';
    if (action.includes('task_completed')) return 'task_completed';
    if (action.includes('task_started')) return 'task_started';
    return 'study_session';
  }
}

export const activityEventService = new ActivityEventService();
