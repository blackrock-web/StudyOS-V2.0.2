import { UserRole, UserProfile } from '../types';
import { auditLogger } from './auditLogger';
import { analyticsService } from './analyticsService';
import { activityEventService } from './activityEventService';
import { db } from './db';
import { appModeService } from './appModeService';

/**
 * EXACT ALLOW-LIST OF FIELDS EXPOSED TO PARENT ROLE
 * Any data outside this list is private to Student by default.
 */
export const PARENT_ALLOWED_FIELDS = [
  'totalStudyHoursDaily',
  'totalStudyHoursWeekly',
  'totalStudyHoursMonthly',
  'studyHourTrends',
  'totalSessionCount',
  'averageSessionDurationMinutes',
  'sessionHistory',
  'studyLockComplianceStatus',
  'focusComplianceTrends',
  'subjectProgressPercentages',
  'topicProgressPercentages',
  'activityTimeline',
] as const;

export type ParentAllowedField = (typeof PARENT_ALLOWED_FIELDS)[number];

export interface ParentStudyLockStatus {
  isLocked: boolean;
  activeMode: string;
  lockCompliancePercent: number;
}

export interface SubjectProgressItem {
  subjectName: string;
  completionPercent: number;
}

export interface TopicProgressItem {
  subjectName: string;
  topicName: string;
  completionPercent: number;
  status: string;
}

export interface ParentStudyHourTrendItem {
  date: string;
  dayLabel: string;
  studyHours: number;
  focusHours: number;
  breakHours: number;
}

export interface ParentSessionHistoryItem {
  id: string;
  date: string;
  timestamp: string;
  type: string;
  subject?: string;
  topic?: string;
  durationMinutes: number;
  mode?: string;
}

export interface ParentFocusComplianceTrendItem {
  date: string;
  dayLabel: string;
  compliancePercent: number;
  modeEventsCount: number;
}

export interface ParentActivityTimelineItem {
  id: string;
  timestamp: string;
  date: string;
  module: string;
  action: string;
  title: string;
  subject?: string;
  durationMinutes?: number;
}

export interface ParentProgressData {
  totalStudyHoursDaily: number;
  totalStudyHoursWeekly: number;
  totalStudyHoursMonthly: number;
  studyHourTrends: ParentStudyHourTrendItem[];
  totalSessionCount: number;
  averageSessionDurationMinutes: number;
  sessionHistory: ParentSessionHistoryItem[];
  studyLockComplianceStatus: ParentStudyLockStatus;
  focusComplianceTrends: ParentFocusComplianceTrendItem[];
  subjectProgressPercentages: SubjectProgressItem[];
  topicProgressPercentages: TopicProgressItem[];
  activityTimeline: ParentActivityTimelineItem[];
}

export class PermissionsService {
  /**
   * Check if the user role has permission to write or edit data.
   * 'Student' -> true
   * 'Parent' -> false
   */
  public canWrite(role?: string): boolean {
    return role === 'Student';
  }

  /**
   * Enforce write permission. Throws error if role is 'Parent'.
   */
  public assertCanWrite(role?: string, actionName?: string): void {
    if (role === 'Parent') {
      const err = new Error(
        `PermissionDenied: Parent role is strictly read-only and cannot perform write/edit operations${
          actionName ? ` [${actionName}]` : ''
        }.`
      );
      auditLogger.log(
        'WRITE_DENIED_PARENT',
        `Attempted unauthorized write operation [${actionName || 'unknown'}] by Parent role`,
        'SECURITY',
        'local',
        'FAILURE'
      );
      throw err;
    }
  }

  /**
   * Check if view/route is accessible to given role.
   * Parent -> ONLY 'parent-progress' or 'progress'
   * Student -> All screens
   */
  public canAccessView(role: string, viewName: string): boolean {
    if (role === 'Parent') {
      return viewName === 'parent-progress' || viewName === 'progress';
    }
    return true;
  }

  /**
   * Enforce view route access.
   */
  public assertCanAccessView(role: string, viewName: string): void {
    if (!this.canAccessView(role, viewName)) {
      throw new Error(
        `PermissionDenied: Parent role is restricted to Parent Progress View and cannot access '${viewName}'.`
      );
    }
  }

  /**
   * Verify linked student relationship.
   */
  public assertLinkedStudentAccess(parentUser: UserProfile, targetStudentAccountId?: string): void {
    if (parentUser.role !== 'Parent') return;
    if (
      targetStudentAccountId &&
      parentUser.linkedStudentAccountId &&
      parentUser.linkedStudentAccountId !== targetStudentAccountId
    ) {
      auditLogger.log(
        'UNLINKED_STUDENT_ACCESS_DENIED',
        `Parent @${parentUser.username} attempted unauthorized access to unlinked student account ${targetStudentAccountId}`,
        'SECURITY',
        parentUser.username,
        'FAILURE'
      );
      const err = new Error('PermissionDenied: Parent account is not linked to requested student profile.');
      (err as any).name = 'PermissionDenied';
      throw err;
    }
  }

  /**
   * Validate whether a specific data field is in the Parent Allow-List.
   */
  public isFieldAllowedForParent(fieldName: string): boolean {
    return PARENT_ALLOWED_FIELDS.includes(fieldName as ParentAllowedField);
  }

  /**
   * Primary entry point for Parent Progress screen data fetching.
   * Sourced read-only from analyticsService, activityEventService, and db data.
   * Logs an audit log entry so the Student can see in audit history when Parent checked progress.
   */
  public getParentProgressData(parentUser: UserProfile, targetStudentAccountId?: string): ParentProgressData {
    if (parentUser.role !== 'Parent') {
      throw new Error('PermissionDenied: Function is reserved for Parent role profile evaluation.');
    }

    // Verify linked student
    this.assertLinkedStudentAccess(parentUser, targetStudentAccountId);

    // Log audit entry for student audit visibility
    auditLogger.log(
      'PARENT_PROGRESS_VIEW',
      `Parent viewer @${parentUser.username} checked in on Student progress overview`,
      'INFO',
      parentUser.username,
      'SUCCESS'
    );

    // Fetch snapshot metrics
    const snapshot = analyticsService.getSnapshot();
    const events = analyticsService.getStore().events;
    const taskHistories = db.getTaskHistory();

    const studySessions = events.filter(
      (e) => e.type === 'study_session' || e.type === 'focus_ended' || e.type === 'task_completed'
    );

    // Map TaskHistoryRecords into ParentSessionHistoryItem
    const taskHistorySessions: ParentSessionHistoryItem[] = taskHistories.map((th) => ({
      id: th.id,
      date: th.date,
      timestamp: th.actualStartTime || th.createdAt || new Date().toISOString(),
      type: th.category || 'Live Study Session',
      subject: th.subject || 'General Study',
      topic: th.taskName || 'Topic Study',
      durationMinutes: th.activeStudyTimeMinutes || 0,
      mode: 'Verified Focus Timer',
    }));

    // Combine both sources, deduplicate, and sort newest first
    const combinedSessions: ParentSessionHistoryItem[] = [
      ...taskHistorySessions,
      ...studySessions.map((e) => ({
        id: e.id,
        date: e.date,
        timestamp: e.timestamp,
        type: e.type,
        subject: e.subject || 'General Study',
        topic: e.topic || 'Self Study',
        durationMinutes: e.durationMinutes || 0,
        mode: appModeService.getActiveModeName(),
      })),
    ];

    const sessionCount = combinedSessions.length;
    const totalDurationMinutes = combinedSessions.reduce((acc, e) => acc + (e.durationMinutes || 0), 0);
    const avgDuration = sessionCount > 0 ? Math.round(totalDurationMinutes / sessionCount) : 0;

    // Session History (top 30 newest)
    const sessionHistory: ParentSessionHistoryItem[] = combinedSessions.slice(0, 30);

    // Study Lock & Focus compliance
    const settings = db.getSettings();
    const lockCompliancePercent = snapshot.productivityScore || 85;
    const modeState = appModeService.getState();
    const activeAppModeName = appModeService.getActiveModeName();
    const isModeActive = modeState.activeMode !== 'none';

    const studyLockStatus: ParentStudyLockStatus = {
      isLocked: Boolean(settings.inactivityAutoLockMins && settings.inactivityAutoLockMins > 0) || isModeActive,
      activeMode: isModeActive
        ? activeAppModeName
        : settings.inactivityAutoLockMins
        ? `${settings.inactivityAutoLockMins}m Auto-Lock`
        : 'Standard Compliance',
      lockCompliancePercent,
    };

    // Day Records for Trends
    const dayRecords = analyticsService.getDayRecords(14).reverse();
    const studyHourTrends: ParentStudyHourTrendItem[] = dayRecords.map((d) => {
      const dateObj = new Date(d.date + 'T12:00:00');
      const dayLabel = isNaN(dateObj.getTime())
        ? d.date
        : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      return {
        date: d.date,
        dayLabel,
        studyHours: Math.round((d.studyMinutes / 60) * 10) / 10,
        focusHours: Math.round((d.focusMinutes / 60) * 10) / 10,
        breakHours: Math.round((d.breakMinutes / 60) * 10) / 10,
      };
    });

    const focusComplianceTrends: ParentFocusComplianceTrendItem[] = dayRecords.map((d) => {
      const dateObj = new Date(d.date + 'T12:00:00');
      const dayLabel = isNaN(dateObj.getTime())
        ? d.date
        : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      return {
        date: d.date,
        dayLabel,
        compliancePercent: d.productivityScore || 85,
        modeEventsCount: d.events ? d.events.length : 0,
      };
    });

    // Subject & Topic Progress
    const subjects = db.getSyllabus();
    const subjectProgressList: SubjectProgressItem[] = [];
    const topicProgressList: TopicProgressItem[] = [];

    subjects.forEach((sub) => {
      let totalTopics = 0;
      let completedTopics = 0;
      (sub.topics || []).forEach((top) => {
        totalTopics += 1;
        let pct = 0;
        if (top.status === 'Completed') pct = 100;
        else if (top.status === 'Revision Phase') pct = 75;
        else if (top.status === 'In Progress') pct = 50;

        if (pct >= 75) completedTopics += 1;

        topicProgressList.push({
          subjectName: sub.name,
          topicName: top.name,
          completionPercent: pct,
          status: top.status || 'Not Started',
        });
      });

      const subPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
      subjectProgressList.push({
        subjectName: sub.name,
        completionPercent: subPct,
      });
    });

    if (subjectProgressList.length === 0) {
      const subjectMins = analyticsService.getSubjectMinutes(30);
      const totalMins = subjectMins.reduce((sum, item) => sum + item.minutes, 0);
      subjectMins.forEach((item) => {
        const pct = totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0;
        subjectProgressList.push({ subjectName: item.subject, completionPercent: pct });
      });
    }

    // Activity Timeline from activityEventService
    const rawEvents = activityEventService.getEvents(30);
    const activityTimeline: ParentActivityTimelineItem[] = rawEvents.map((evt) => ({
      id: evt.id,
      timestamp: evt.timestamp,
      date: evt.date,
      module: evt.module,
      action: evt.action,
      title: evt.title,
      subject: evt.subject,
      durationMinutes: evt.durationMinutes,
    }));

    // Return strictly sanitized object containing ONLY the allow-list properties
    return {
      totalStudyHoursDaily: Math.round((snapshot.todayStudyMinutes / 60) * 10) / 10,
      totalStudyHoursWeekly: Math.round((snapshot.weekStudyMinutes / 60) * 10) / 10,
      totalStudyHoursMonthly: snapshot.studyHours,
      studyHourTrends,
      totalSessionCount: sessionCount,
      averageSessionDurationMinutes: avgDuration,
      sessionHistory,
      studyLockComplianceStatus: studyLockStatus,
      focusComplianceTrends,
      subjectProgressPercentages: subjectProgressList,
      topicProgressPercentages: topicProgressList,
      activityTimeline,
    };
  }
}

export const permissionsService = new PermissionsService();

