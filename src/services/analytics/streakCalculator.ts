/**
 * Streak and Qualifying Activity Calculation Engine
 * 
 * Invariants:
 * 1. Focus time strictly means verified active time (no application-open or idle time).
 * 2. DAILY_STREAK_THRESHOLD = 30 minutes of unique qualifying active time per calendar day.
 * 3. Qualifying activities: Focus Sessions, Reading Sessions, and Active Task Sessions.
 * 4. Deduplication: Overlapping time intervals are merged so the exact same minutes
 *    are never double counted across multiple categories.
 * 5. Streak Grace Rule: If exactly 1 calendar day is missed between qualifying days,
 *    the streak is preserved (1-day grace period). If more than 1 consecutive day is missed,
 *    the streak resets to 0 (and starts at 1 upon the next qualifying day).
 * 6. Brand-new users start with 0 for all statistics.
 */

export const DAILY_STREAK_THRESHOLD_MINUTES = 30;

export interface TimeInterval {
  startMs: number;
  endMs: number;
}

export type ActivityType = 'focus' | 'reading' | 'task' | 'lecture' | 'revision';

export interface VerifiedSession {
  id: string;
  userId?: string;
  activityType: ActivityType;
  subject?: string;
  topic?: string;
  chapter?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  durationMinutes: number;
  durationSeconds?: number;
  breakMinutes?: number;
  activeIntervals?: TimeInterval[];
  status: 'completed' | 'aborted' | 'in_progress';
  date: string; // YYYY-MM-DD
  source?: string;
  verifiedActive: boolean;
}

/**
 * Merges overlapping intervals and returns the total active milliseconds.
 */
export function mergeIntervalsMs(intervals: TimeInterval[]): number {
  if (!intervals || intervals.length === 0) return 0;

  // Filter valid intervals
  const valid = intervals
    .filter((iv) => iv.endMs > iv.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  if (valid.length === 0) return 0;

  let totalMs = 0;
  let curStart = valid[0].startMs;
  let curEnd = valid[0].endMs;

  for (let i = 1; i < valid.length; i++) {
    const next = valid[i];
    if (next.startMs <= curEnd) {
      curEnd = Math.max(curEnd, next.endMs);
    } else {
      totalMs += Math.max(0, curEnd - curStart);
      curStart = next.startMs;
      curEnd = next.endMs;
    }
  }
  totalMs += Math.max(0, curEnd - curStart);
  return totalMs;
}

/**
 * Calculates unique qualifying minutes for a list of sessions on a given day.
 * Merges overlapping intervals to prevent double-counting.
 */
export function calculateDailyMetricsFromSessions(sessions: VerifiedSession[]): {
  focusMinutes: number;
  readingMinutes: number;
  taskMinutes: number;
  uniqueQualifyingMinutes: number;
  qualifiesForStreak: boolean;
  remainingMinutesToGoal: number;
} {
  if (!sessions || sessions.length === 0) {
    return {
      focusMinutes: 0,
      readingMinutes: 0,
      taskMinutes: 0,
      uniqueQualifyingMinutes: 0,
      qualifiesForStreak: false,
      remainingMinutesToGoal: DAILY_STREAK_THRESHOLD_MINUTES,
    };
  }

  const allIntervals: TimeInterval[] = [];
  const focusIntervals: TimeInterval[] = [];
  const readingIntervals: TimeInterval[] = [];
  const taskIntervals: TimeInterval[] = [];

  sessions.forEach((s) => {
    if (!s.verifiedActive) return;

    let intervals: TimeInterval[] = [];
    if (s.activeIntervals && s.activeIntervals.length > 0) {
      intervals = s.activeIntervals.filter((iv) => iv.endMs > iv.startMs);
    } else {
      const sMs = new Date(s.startTime).getTime();
      let eMs = new Date(s.endTime).getTime();
      if (isNaN(eMs) || eMs <= sMs) {
        const durMs = (s.durationSeconds || s.durationMinutes * 60) * 1000;
        eMs = sMs + durMs;
      }
      if (eMs > sMs) {
        intervals = [{ startMs: sMs, endMs: eMs }];
      }
    }

    intervals.forEach((iv) => {
      allIntervals.push(iv);
      if (s.activityType === 'reading') {
        readingIntervals.push(iv);
      } else if (s.activityType === 'task') {
        taskIntervals.push(iv);
      } else {
        // focus, lecture, revision
        focusIntervals.push(iv);
      }
    });
  });

  const totalFocusMs = mergeIntervalsMs(focusIntervals);
  const totalReadingMs = mergeIntervalsMs(readingIntervals);
  const totalTaskMs = mergeIntervalsMs(taskIntervals);
  const totalQualifyingMs = mergeIntervalsMs(allIntervals);

  const focusMinutes = Math.round(totalFocusMs / 60000);
  const readingMinutes = Math.round(totalReadingMs / 60000);
  const taskMinutes = Math.round(totalTaskMs / 60000);
  const uniqueQualifyingMinutes = Math.round(totalQualifyingMs / 60000);

  const qualifiesForStreak = uniqueQualifyingMinutes >= DAILY_STREAK_THRESHOLD_MINUTES;
  const remainingMinutesToGoal = Math.max(0, DAILY_STREAK_THRESHOLD_MINUTES - uniqueQualifyingMinutes);

  return {
    focusMinutes,
    readingMinutes,
    taskMinutes,
    uniqueQualifyingMinutes,
    qualifiesForStreak,
    remainingMinutesToGoal,
  };
}

/**
 * Splits a session across midnight boundaries if it spans multiple calendar days.
 */
export function splitSessionByCalendarDay(session: VerifiedSession): VerifiedSession[] {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return [session];
  }

  const startDateStr = session.startTime.slice(0, 10);
  const endDateStr = session.endTime.slice(0, 10);

  if (startDateStr === endDateStr) {
    return [{ ...session, date: startDateStr }];
  }

  // Spans midnight: split into daily chunks
  const chunks: VerifiedSession[] = [];
  let curStart = new Date(start);

  while (curStart < end) {
    const curDateStr = curStart.toISOString().slice(0, 10);
    const endOfDay = new Date(curDateStr + 'T23:59:59.999Z');
    const chunkEnd = end < endOfDay ? end : endOfDay;

    const chunkDurationMs = chunkEnd.getTime() - curStart.getTime();
    const chunkDurationSecs = Math.max(1, Math.round(chunkDurationMs / 1000));
    const chunkDurationMins = Math.round(chunkDurationSecs / 60);

    chunks.push({
      ...session,
      id: `${session.id}-${curDateStr}`,
      startTime: curStart.toISOString(),
      endTime: chunkEnd.toISOString(),
      date: curDateStr,
      durationMinutes: chunkDurationMins,
      durationSeconds: chunkDurationSecs,
      activeIntervals: [{ startMs: curStart.getTime(), endMs: chunkEnd.getTime() }],
    });

    // Move to next day 00:00:00.000
    curStart = new Date(curStart);
    curStart.setUTCDate(curStart.getUTCDate() + 1);
    curStart.setUTCHours(0, 0, 0, 0);
  }

  return chunks;
}

export interface StreakCalculationResult {
  currentStreak: number;
  longestStreak: number;
  todayQualified: boolean;
  todayMinutes: number;
  remainingMinutesToday: number;
  isGraceActive: boolean;
  history: Record<string, { qualifyingMinutes: number; qualified: boolean; isGraceDay?: boolean }>;
}

/**
 * Helper to add days to a YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates current streak and longest streak from daily qualifying minutes map.
 * 
 * Rules:
 * - A day is qualifying iff qualifyingMinutes >= 30.
 * - If 1 calendar day is missed between qualifying days, the streak is preserved (grace).
 * - If more than 1 consecutive calendar day is missed, the streak resets to 0.
 * - Today's status:
 *   - If today >= 30m: streak includes today.
 *   - If today < 30m: streak reflects the active streak up to yesterday / day-before (with grace).
 */
export function calculateStreaks(
  dailyMinutesMap: Record<string, number>,
  todayDateStr: string
): StreakCalculationResult {
  const history: Record<string, { qualifyingMinutes: number; qualified: boolean; isGraceDay?: boolean }> = {};

  const todayMinutes = dailyMinutesMap[todayDateStr] || 0;
  const todayQualified = todayMinutes >= DAILY_STREAK_THRESHOLD_MINUTES;
  const remainingMinutesToday = Math.max(0, DAILY_STREAK_THRESHOLD_MINUTES - todayMinutes);

  // Populate history for known dates
  Object.entries(dailyMinutesMap).forEach(([date, mins]) => {
    history[date] = {
      qualifyingMinutes: mins,
      qualified: mins >= DAILY_STREAK_THRESHOLD_MINUTES,
    };
  });

  // Calculate current streak
  let currentStreak = 0;
  let isGraceActive = false;

  const yesterdayStr = addDays(todayDateStr, -1);
  const dayBeforeYesterdayStr = addDays(todayDateStr, -2);

  if (todayQualified) {
    currentStreak = 1;
    let checkDateStr = yesterdayStr;

    while (true) {
      const checkMins = dailyMinutesMap[checkDateStr] || 0;
      if (checkMins >= DAILY_STREAK_THRESHOLD_MINUTES) {
        currentStreak += 1;
        checkDateStr = addDays(checkDateStr, -1);
      } else {
        // Check if 1-day grace applies
        const priorDateStr = addDays(checkDateStr, -1);
        const priorMins = dailyMinutesMap[priorDateStr] || 0;
        if (priorMins >= DAILY_STREAK_THRESHOLD_MINUTES) {
          // 1 day missed: grace applies!
          if (history[checkDateStr]) history[checkDateStr].isGraceDay = true;
          checkDateStr = priorDateStr; // Continue checking from prior qualified day
        } else {
          // >1 consecutive missed days: streak terminates
          break;
        }
      }
    }
  } else {
    // Today not yet qualified (<30 min)
    const yMins = dailyMinutesMap[yesterdayStr] || 0;
    const yQualified = yMins >= DAILY_STREAK_THRESHOLD_MINUTES;

    if (yQualified) {
      // Streak active as of yesterday
      currentStreak = 1;
      let checkDateStr = addDays(yesterdayStr, -1);

      while (true) {
        const checkMins = dailyMinutesMap[checkDateStr] || 0;
        if (checkMins >= DAILY_STREAK_THRESHOLD_MINUTES) {
          currentStreak += 1;
          checkDateStr = addDays(checkDateStr, -1);
        } else {
          const priorDateStr = addDays(checkDateStr, -1);
          const priorMins = dailyMinutesMap[priorDateStr] || 0;
          if (priorMins >= DAILY_STREAK_THRESHOLD_MINUTES) {
            if (history[checkDateStr]) history[checkDateStr].isGraceDay = true;
            checkDateStr = priorDateStr;
          } else {
            break;
          }
        }
      }
    } else {
      // Yesterday was not qualified: check if 1-day grace applies to yesterday
      const dbyMins = dailyMinutesMap[dayBeforeYesterdayStr] || 0;
      const dbyQualified = dbyMins >= DAILY_STREAK_THRESHOLD_MINUTES;

      if (dbyQualified) {
        // Yesterday was 1 missed day: grace preserves streak ending at day-before-yesterday
        isGraceActive = true;
        currentStreak = 1;
        let checkDateStr = addDays(dayBeforeYesterdayStr, -1);

        while (true) {
          const checkMins = dailyMinutesMap[checkDateStr] || 0;
          if (checkMins >= DAILY_STREAK_THRESHOLD_MINUTES) {
            currentStreak += 1;
            checkDateStr = addDays(checkDateStr, -1);
          } else {
            const priorDateStr = addDays(checkDateStr, -1);
            const priorMins = dailyMinutesMap[priorDateStr] || 0;
            if (priorMins >= DAILY_STREAK_THRESHOLD_MINUTES) {
              if (history[checkDateStr]) history[checkDateStr].isGraceDay = true;
              checkDateStr = priorDateStr;
            } else {
              break;
            }
          }
        }
      } else {
        // More than 1 missed day (yesterday and day-before-yesterday missed): streak = 0
        currentStreak = 0;
      }
    }
  }

  // Calculate longest streak across all recorded history
  const allDates = Object.keys(dailyMinutesMap).sort();
  let longestStreak = 0;

  if (allDates.length > 0) {
    const firstDateStr = allDates[0];
    let curDateStr = firstDateStr;
    let runningStreak = 0;
    let missedConsecutive = 0;

    while (curDateStr <= todayDateStr) {
      const mins = dailyMinutesMap[curDateStr] || 0;
      if (mins >= DAILY_STREAK_THRESHOLD_MINUTES) {
        runningStreak += 1;
        missedConsecutive = 0;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else {
        missedConsecutive += 1;
        if (missedConsecutive > 1) {
          // More than 1 missed day: reset running streak
          runningStreak = 0;
        }
        // If missedConsecutive === 1, runningStreak is preserved (grace)
      }
      curDateStr = addDays(curDateStr, 1);
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    todayQualified,
    todayMinutes,
    remainingMinutesToday,
    isGraceActive,
    history,
  };
}
