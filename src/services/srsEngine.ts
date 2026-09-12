import { Flashcard } from '../types';

export const SRS_INTERVALS = [1, 3, 7, 15, 30, 60, 90];

/**
 * Calculates the next review date and interval for a flashcard or topic revision.
 * @param currentIntervalDays Current interval in days
 * @param confidence Confidence level from 1 (Hard/Forgotten) to 5 (Mastered/Easy)
 */
export function calculateNextSRSInterval(
  currentIntervalDays: number,
  confidence: number
): { nextIntervalDays: number; nextReviewDateStr: string } {
  let nextIndex = 0;

  // Find index of current interval
  const currentIndex = SRS_INTERVALS.indexOf(currentIntervalDays);

  if (confidence <= 1) {
    // Reset back to Day 1
    nextIndex = 0;
  } else if (confidence === 2) {
    // Step back or stay at Day 1 / Day 3
    nextIndex = Math.max(0, (currentIndex >= 0 ? currentIndex - 1 : 0));
  } else if (confidence === 3) {
    // Standard progression to next interval
    nextIndex = currentIndex >= 0 ? Math.min(SRS_INTERVALS.length - 1, currentIndex + 1) : 1;
  } else if (confidence >= 4) {
    // Skip a step forward for high confidence
    nextIndex = currentIndex >= 0 ? Math.min(SRS_INTERVALS.length - 1, currentIndex + 2) : 2;
  }

  const nextIntervalDays = SRS_INTERVALS[nextIndex] ?? 1;

  // Calculate future date
  const now = new Date();
  const futureDate = new Date(now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000);
  const nextReviewDateStr = futureDate.toISOString().split('T')[0] || '';

  return { nextIntervalDays, nextReviewDateStr };
}

export function reviewFlashcard(card: Flashcard, confidence: number): Flashcard {
  const { nextIntervalDays, nextReviewDateStr } = calculateNextSRSInterval(
    card.intervalDays,
    confidence
  );

  return {
    ...card,
    lastReviewedDate: new Date().toISOString().split('T')[0],
    nextReviewDate: nextReviewDateStr,
    intervalDays: nextIntervalDays,
    repetitions: card.repetitions + 1,
    confidence,
  };
}
