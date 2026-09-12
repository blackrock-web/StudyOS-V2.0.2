import { contentEngine, ContentItem } from '../contentEngine';
import { db } from '../db';
import { calculateNextSRSInterval } from '../srsEngine';

export interface MigrationTestResult {
  passed: boolean;
  testLogs: string[];
  countsBefore: Record<string, number>;
  countsAfter: Record<string, number>;
}

/**
 * Runs migration verification test and confirms item counts and key fields match before/after for each content type.
 */
export function runContentEngineMigrationTests(): MigrationTestResult {
  const logs: string[] = [];
  let allPassed = true;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      logs.push(`✅ PASS: ${testName}`);
    } else {
      logs.push(`❌ FAIL: ${testName}`);
      allPassed = false;
    }
  }

  // 1. Gather counts from legacy db.ts before/during migration
  const legacyNotes = db.getScratchpadNotes();
  const legacyCards = db.getFlashcards();
  const legacyPDFs = db.getPDFs();
  const legacyMCQs = db.getMCQs();
  const legacyMocks = db.getMockTests();

  const countsBefore = {
    note: legacyNotes.length,
    flashcard: legacyCards.length,
    pdf: legacyPDFs.length,
    pyq: legacyMCQs.length,
    mock_test: legacyMocks.length,
  };

  // 2. Trigger Migration
  const migrationRes = contentEngine.runMigration();

  // 3. Verify counts in ContentEngine
  const engineNotes = contentEngine.getItemsByType('note');
  const engineCards = contentEngine.getItemsByType('flashcard');
  const enginePDFs = contentEngine.getItemsByType('pdf');
  const enginePYQs = contentEngine.getItemsByType('pyq');
  const engineMocks = contentEngine.getItemsByType('mock_test');

  const countsAfter = {
    note: engineNotes.length,
    flashcard: engineCards.length,
    pdf: enginePDFs.length,
    pyq: enginePYQs.length,
    mock_test: engineMocks.length,
  };

  assert(countsBefore.note === countsAfter.note, `Notes count matches before (${countsBefore.note}) & after (${countsAfter.note})`);
  assert(countsBefore.flashcard === countsAfter.flashcard, `Flashcards count matches before (${countsBefore.flashcard}) & after (${countsAfter.flashcard})`);
  assert(countsBefore.pdf === countsAfter.pdf, `PDFs count matches before (${countsBefore.pdf}) & after (${countsAfter.pdf})`);
  assert(countsBefore.pyq === countsAfter.pyq, `PYQs count matches before (${countsBefore.pyq}) & after (${countsAfter.pyq})`);
  assert(countsBefore.mock_test === countsAfter.mock_test, `Mock Tests count matches before (${countsBefore.mock_test}) & after (${countsAfter.mock_test})`);

  // 4. Verify Key Field Integrity for Flashcards (SRS fields preserved)
  if (legacyCards.length > 0 && engineCards.length > 0) {
    const sampleLegacyCard = legacyCards[0];
    const sampleEngineCard = engineCards.find((c) => c.id === sampleLegacyCard.id);

    assert(sampleEngineCard !== undefined, 'Migrated flashcard exists in ContentEngine');
    if (sampleEngineCard) {
      assert(sampleEngineCard.title === sampleLegacyCard.front, 'Flashcard front title matches');
      assert(sampleEngineCard.body === sampleLegacyCard.back, 'Flashcard back content matches');
      assert(sampleEngineCard.metadata.intervalDays === sampleLegacyCard.intervalDays, 'Flashcard intervalDays preserved');
      assert(sampleEngineCard.metadata.confidence === sampleLegacyCard.confidence, 'Flashcard confidence preserved');
      assert(sampleEngineCard.metadata.nextReviewDate === sampleLegacyCard.nextReviewDate, 'Flashcard nextReviewDate preserved');
    }
  }

  // 5. Verify SRS Engine function on migrated flashcard
  if (engineCards.length > 0) {
    const cardToReview = engineCards[0];
    const initialInterval = cardToReview.metadata.intervalDays || 1;
    const reviewedItem = contentEngine.reviewSRSFlashcard(cardToReview.id, 4);

    const { nextIntervalDays } = calculateNextSRSInterval(initialInterval, 4);
    assert(reviewedItem.metadata.intervalDays === nextIntervalDays, `SRS Engine updated intervalDays to ${nextIntervalDays}`);
    assert(reviewedItem.metadata.repetitions === (cardToReview.metadata.repetitions || 0) + 1, 'SRS Engine incremented repetitions');
  }

  // 6. Verify CRUD & Version History Non-Destructive Edit
  const newNote = contentEngine.createItem({
    type: 'note',
    title: 'Content Engine Test Note',
    body: 'Version 1 Body',
    tags: ['test'],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  assert(newNote.versionHistory.length === 1, 'New item initialized with 1 version history entry');

  const updatedNote = contentEngine.updateItem(
    newNote.id,
    { body: 'Version 2 Updated Body' },
    'Tester',
    'Updated body text'
  );

  assert(updatedNote.body === 'Version 2 Updated Body', 'Updated item has new body text');
  assert(updatedNote.versionHistory.length === 2, 'Version history incremented to 2 entries');

  const restoredNote = contentEngine.restoreVersion(newNote.id, 1, 'Tester');
  assert(restoredNote.body === 'Version 1 Body', 'Restored item returned to Version 1 body text');
  assert(restoredNote.versionHistory.length === 3, 'Restoring created a new version history entry');

  // 7. Search Verification
  const searchResults = contentEngine.searchContentItems('Content Engine Test');
  assert(searchResults.length > 0, 'Unified search retrieved created test item');

  // Cleanup test item
  contentEngine.deleteItem(newNote.id);

  return {
    passed: allPassed,
    testLogs: logs,
    countsBefore,
    countsAfter,
  };
}
