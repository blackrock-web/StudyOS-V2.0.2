import { PWLectureRecord } from '../types';

/**
 * Re-anchors PW lectures starting from a user-specified base start date.
 * Preserves sequence, chapter order, relative day differences, DPP assignments, and test order.
 */
export function reanchorLectures(
  lectures: PWLectureRecord[],
  newStartDateStr: string // YYYY-MM-DD
): PWLectureRecord[] {
  if (!lectures || lectures.length === 0) return [];

  // Parse target start date
  const targetStart = new Date(newStartDateStr);
  if (isNaN(targetStart.getTime())) return lectures;

  // Find the earliest original date among lectures to determine baseline
  const sortedByOriginal = [...lectures].sort(
    (a, b) => new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime()
  );

  if (sortedByOriginal.length === 0 || !sortedByOriginal[0]?.originalDate) return lectures;

  const baseOriginalTime = new Date(sortedByOriginal[0].originalDate).getTime();

  return lectures.map((lecture) => {
    const origTime = new Date(lecture.originalDate).getTime();
    const diffDays = Math.round((origTime - baseOriginalTime) / (1000 * 60 * 60 * 24));

    // Shift new date by diffDays
    const shiftedDate = new Date(targetStart.getTime() + diffDays * 24 * 60 * 60 * 1000);
    const reanchoredDateStr = shiftedDate.toISOString().split('T')[0] || lecture.originalDate;

    return {
      ...lecture,
      reanchoredDate: reanchoredDateStr,
    };
  });
}
