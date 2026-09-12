/**
 * StudyOS Analytics, Focus Timer, Streak & New-User Defaults Test Suite
 * Run with: node src/tests/analyticsStreak.test.mjs
 */
import assert from 'node:assert/strict';

// Core streak & interval merge logic under test
function mergeIntervals(intervals) {
  if (!intervals || intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

function calculateDeduplicatedMinutes(intervals) {
  const merged = mergeIntervals(intervals);
  let totalMs = 0;
  for (const interval of merged) {
    totalMs += Math.max(0, interval.end - interval.start);
  }
  return Math.round(totalMs / 60000);
}

const DAILY_STREAK_THRESHOLD_MINUTES = 30;

function calculateStreak(dayRecords, todayStr) {
  const dates = Object.keys(dayRecords).sort();
  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let lastActiveDate = '';

  const minDate = dates[0];
  const maxDate = dates[dates.length - 1] > todayStr ? dates[dates.length - 1] : todayStr;

  const currentD = new Date(minDate + 'T12:00:00Z');
  const endD = new Date(maxDate + 'T12:00:00Z');

  let consecutiveMisses = 0;

  while (currentD <= endD) {
    const dateStr = currentD.toISOString().split('T')[0];
    const rec = dayRecords[dateStr];
    const studyMins = rec ? rec.studyMinutes || rec.focusMinutes || 0 : 0;
    const isToday = dateStr === todayStr;

    if (studyMins >= DAILY_STREAK_THRESHOLD_MINUTES) {
      runningStreak += 1;
      consecutiveMisses = 0;
      lastActiveDate = dateStr;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      if (isToday) {
        // Today is not over yet
      } else {
        consecutiveMisses += 1;
        if (consecutiveMisses > 1) {
          // More than 1 day missed: reset streak to 0 from base starting
          runningStreak = 0;
        }
        // If consecutiveMisses === 1, grace period saves the streak!
      }
    }

    currentD.setDate(currentD.getDate() + 1);
  }

  return {
    currentStreak: runningStreak,
    longestStreak,
    lastActiveDate,
  };
}

function splitSessionAcrossDays(session) {
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.endTime).getTime();

  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
    return [{ ...session, durationMinutes: Math.max(0, session.durationMinutes) }];
  }

  const startDate = session.startTime.split('T')[0];
  const endDate = session.endTime.split('T')[0];

  if (startDate === endDate) {
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
    return [{ ...session, date: startDate, durationMinutes }];
  }

  const segments = [];
  let currentCursor = new Date(startMs);

  while (currentCursor.getTime() < endMs) {
    const curDateStr = currentCursor.toISOString().split('T')[0];
    const nextMidnight = new Date(curDateStr + 'T23:59:59.999Z');
    const segEndMs = Math.min(endMs, nextMidnight.getTime() + 1);

    const segDurationMins = Math.max(1, Math.round((segEndMs - currentCursor.getTime()) / 60000));

    segments.push({
      ...session,
      id: `${session.id}-${curDateStr}`,
      date: curDateStr,
      startTime: currentCursor.toISOString(),
      endTime: new Date(segEndMs).toISOString(),
      durationMinutes: segDurationMins,
    });

    currentCursor = new Date(segEndMs);
  }

  return segments;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    console.error('  ✗', name, '\n   ', e.message);
  }
}

console.log('\n======================================================');
console.log('Running StudyOS Focus Analytics, Streak & Defaults Tests');
console.log('======================================================\n');

// 1. New User Defaults
test('Test Scenario 1: New user starting statistics start strictly at 0', () => {
  const initialDays = {};
  const streakRes = calculateStreak(initialDays, '2026-03-01');
  assert.equal(streakRes.currentStreak, 0);
  assert.equal(streakRes.longestStreak, 0);
  assert.equal(streakRes.lastActiveDate, '');
});

// 2. 29-Minute Session (Sub-threshold)
test('Test Scenario 2: 29-minute verified session does not qualify for streak', () => {
  const days = {
    '2026-03-01': { studyMinutes: 29, focusMinutes: 29 },
  };
  const streakRes = calculateStreak(days, '2026-03-01');
  assert.equal(streakRes.currentStreak, 0, 'Streak should remain 0 for < 30m');
});

// 3. 30-Minute Session (Reaches Threshold)
test('Test Scenario 3: 30-minute verified session qualifies for daily streak', () => {
  const days = {
    '2026-03-01': { studyMinutes: 30, focusMinutes: 30 },
  };
  const streakRes = calculateStreak(days, '2026-03-01');
  assert.equal(streakRes.currentStreak, 1, 'Streak should be 1 for 30m study');
  assert.equal(streakRes.longestStreak, 1);
  assert.equal(streakRes.lastActiveDate, '2026-03-01');
});

// 4. Multiple Sessions in One Day
test('Test Scenario 4: Multiple sessions on same day combine (15m + 20m = 35m) to qualify', () => {
  const intervals = [
    { start: new Date('2026-03-01T09:00:00Z').getTime(), end: new Date('2026-03-01T09:15:00Z').getTime() },
    { start: new Date('2026-03-01T14:00:00Z').getTime(), end: new Date('2026-03-01T14:20:00Z').getTime() },
  ];
  const totalMins = calculateDeduplicatedMinutes(intervals);
  assert.equal(totalMins, 35);
  const days = {
    '2026-03-01': { studyMinutes: totalMins },
  };
  const streakRes = calculateStreak(days, '2026-03-01');
  assert.equal(streakRes.currentStreak, 1);
});

// 5. Overlapping Intervals Deduplication
test('Test Scenario 5: Overlapping intervals (10:00-10:30 & 10:15-10:45) deduplicate to 45 mins', () => {
  const intervals = [
    { start: new Date('2026-03-01T10:00:00Z').getTime(), end: new Date('2026-03-01T10:30:00Z').getTime() },
    { start: new Date('2026-03-01T10:15:00Z').getTime(), end: new Date('2026-03-01T10:45:00Z').getTime() },
  ];
  const deduplicatedMins = calculateDeduplicatedMinutes(intervals);
  assert.equal(deduplicatedMins, 45, 'Overlapping intervals must be deduplicated');
});

// 6. Consecutive Daily Qualifying Activity
test('Test Scenario 6: Consecutive daily qualifying activity increments streak (Day1: 30m, Day2: 45m, Day3: 30m)', () => {
  const days = {
    '2026-03-01': { studyMinutes: 30 },
    '2026-03-02': { studyMinutes: 45 },
    '2026-03-03': { studyMinutes: 30 },
  };
  const streakRes = calculateStreak(days, '2026-03-03');
  assert.equal(streakRes.currentStreak, 3);
  assert.equal(streakRes.longestStreak, 3);
  assert.equal(streakRes.lastActiveDate, '2026-03-03');
});

// 7. 1-Day Streak Miss (Grace Period Saves Streak)
test('Test Scenario 7: 1 day missed saves streak; qualifying next day continues streak (1 -> saved -> 2)', () => {
  const days = {
    '2026-03-01': { studyMinutes: 30 },
    '2026-03-02': { studyMinutes: 0 },  // 1 day missed!
    '2026-03-03': { studyMinutes: 30 }, // Next day studied
  };
  const streakRes = calculateStreak(days, '2026-03-03');
  assert.equal(streakRes.currentStreak, 2, 'Streak should be preserved across 1 missed day');
  assert.equal(streakRes.longestStreak, 2);
});

// 8. More than 1-Day Streak Miss (Streak Resets to 0 / Base Starting)
test('Test Scenario 8: >1 day missed automatically resets streak to 0 from base starting', () => {
  const days = {
    '2026-03-01': { studyMinutes: 30 },
    '2026-03-02': { studyMinutes: 0 }, // Miss 1
    '2026-03-03': { studyMinutes: 0 }, // Miss 2 -> Streak reset!
    '2026-03-04': { studyMinutes: 30 }, // Resumes from base starting -> 1
  };
  const streakRes = calculateStreak(days, '2026-03-04');
  assert.equal(streakRes.currentStreak, 1, 'Streak must reset to 1 from base starting after >1 missed day');
  assert.equal(streakRes.longestStreak, 1);
});

// 9. Midnight Boundary Session Splitting
test('Test Scenario 9: Session crossing midnight (23:45 - 00:30) correctly splits into 15m and 30m', () => {
  const session = {
    id: 'night-sess-1',
    subject: 'Physics',
    startTime: '2026-03-01T23:45:00.000Z',
    endTime: '2026-03-02T00:30:00.000Z',
    durationMinutes: 45,
    sessionType: 'focus_timer',
  };

  const segments = splitSessionAcrossDays(session);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].date, '2026-03-01');
  assert.equal(segments[0].durationMinutes, 15);
  assert.equal(segments[1].date, '2026-03-02');
  assert.equal(segments[1].durationMinutes, 30);
});

// 10. Application Open Time is 0 Focus Time
test('Test Scenario 10: Application open with 0 verified sessions yields 0 focus time', () => {
  const emptySessions = [];
  const intervals = emptySessions.map(s => ({ start: 0, end: 0 }));
  const verifiedMinutes = calculateDeduplicatedMinutes(intervals);
  assert.equal(verifiedMinutes, 0, 'No focus sessions must equal 0 focus time');
});

console.log('\n======================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
