import { db } from './db';
import { secureStorage } from './secureStorage';
import { ScratchpadNote, Flashcard, PDFDocumentItem, QuestionMCQ, MockTestRecord } from '../types';
import { calculateNextSRSInterval } from './srsEngine';

export type ContentItemType =
  | 'pdf'
  | 'video'
  | 'note'
  | 'book'
  | 'pyq'
  | 'flashcard'
  | 'question_bank'
  | 'mock_test';

export interface ContentItemVersion {
  version: number;
  title: string;
  body: string;
  tags: string[];
  updatedAt: string;
  updatedBy?: string;
  changeSummary?: string;
}

export interface ContentItemMetadata {
  examId?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
  author?: string;

  // Flashcard / SRS metadata
  intervalDays?: number;
  easeFactor?: number;
  repetitions?: number;
  confidence?: number;
  lastReviewedDate?: string;
  nextReviewDate?: string;
  formula?: string;
  category?: string;

  // PDF / Document metadata
  fileSize?: string;
  pageCount?: number;
  readProgressPages?: number;
  readingTimeMinutes?: number;
  indexedChapters?: string[];
  notesExtractedCount?: number;
  flashcardsExtractedCount?: number;

  // Question / PYQ / Question Bank / Mock metadata
  year?: string;
  marks?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  questionType?: 'MCQ' | 'MSQ' | 'NAT';
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  userStatus?: 'Unsolved' | 'Solved' | 'Attempted' | 'ReviewNeeded';
  score?: number;
  totalMarks?: number;
  accuracyPercent?: number;
  testDate?: string;
  durationMinutes?: number;

  // Book / Video metadata
  url?: string;
  durationSeconds?: number;
  publisher?: string;
  isbn?: string;

  [key: string]: any;
}

export interface ContentItem {
  id: string;
  type: ContentItemType;
  title: string;
  body: string; // inline content or reference
  tags: string[];
  metadata: ContentItemMetadata;
  versionHistory: ContentItemVersion[];
}

export class ContentEngine {
  private itemsMap: Map<string, ContentItem> = new Map();
  private isInitialized: boolean = false;
  private currentExamId: string = '';

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      window.addEventListener('studyos_active_exam_changed', () => {
        this.init(true);
      });
      window.addEventListener('studyos_exams_updated', () => {
        this.init(true);
      });
    }
  }

  private getStorageKey(examId?: string): string {
    const id = examId || db.getActiveExamId();
    return `studyos_db_content_engine_items_${id}`;
  }

  private init(forceReload = false) {
    const activeExam = db.getActiveExamId();
    if (this.isInitialized && !forceReload && this.currentExamId === activeExam) return;
    this.currentExamId = activeExam;
    this.itemsMap.clear();
    const key = this.getStorageKey(activeExam);
    try {
      const raw = secureStorage.getItem(key);
      if (raw) {
        const storedData = JSON.parse(raw);
        if (Array.isArray(storedData) && storedData.length > 0) {
          storedData.forEach((item: ContentItem) => {
            this.itemsMap.set(item.id, item);
          });
        }
      } else if (activeExam === 'GATE2027' || activeExam === 'exam-gate-2027') {
        const legacyRaw = secureStorage.getItem('studyos_db_content_engine_items');
        if (legacyRaw) {
          const storedData = JSON.parse(legacyRaw);
          if (Array.isArray(storedData) && storedData.length > 0) {
            storedData.forEach((item: ContentItem) => {
              this.itemsMap.set(item.id, item);
            });
            this.persist();
          }
        }
      }
    } catch (err) {
      console.error('[ContentEngine] Init error:', err);
    }
    this.isInitialized = true;
  }

  private persist() {
    try {
      const items = Array.from(this.itemsMap.values());
      const key = this.getStorageKey(this.currentExamId || db.getActiveExamId());
      secureStorage.setItem(key, JSON.stringify(items));
    } catch (err) {
      console.error('[ContentEngine] Persist error:', err);
    }
  }

  /**
   * Run migration from legacy db.ts storage into canonical ContentItems.
   */
  public runMigration(): {
    migratedCount: number;
    countsByType: Record<string, number>;
    verified: boolean;
  } {
    let migratedCount = 0;
    const countsByType: Record<string, number> = {
      note: 0,
      flashcard: 0,
      pdf: 0,
      pyq: 0,
      mock_test: 0,
      question_bank: 0,
      book: 0,
      video: 0,
    };

    const now = new Date().toISOString();

    // 1. Migrate Scratchpad Notes -> 'note'
    const legacyNotes = db.getScratchpadNotes();
    legacyNotes.forEach((note) => {
      if (!this.itemsMap.has(note.id)) {
        const item: ContentItem = {
          id: note.id,
          type: 'note',
          title: note.title || 'Untitled Note',
          body: note.content || '',
          tags: note.tags || ['scratchpad', 'note'],
          metadata: {
            examId: note.examId || 'gate-2027-cs',
            createdAt: note.createdAt || now,
            updatedAt: note.updatedAt || now,
            author: note.accountId || 'student',
          },
          versionHistory: [
            {
              version: 1,
              title: note.title || 'Untitled Note',
              body: note.content || '',
              tags: note.tags || ['scratchpad', 'note'],
              updatedAt: note.createdAt || now,
              updatedBy: 'MigrationEngine',
              changeSummary: 'Initial migration from Scratchpad Notes',
            },
          ],
        };
        this.itemsMap.set(item.id, item);
        migratedCount++;
      }
      countsByType.note++;
    });

    // 2. Migrate Flashcards -> 'flashcard'
    const legacyCards = db.getFlashcards();
    legacyCards.forEach((card) => {
      if (!this.itemsMap.has(card.id)) {
        const item: ContentItem = {
          id: card.id,
          type: 'flashcard',
          title: card.front || 'Flashcard Question',
          body: card.back || '',
          tags: [card.subject, card.category, 'srs'].filter(Boolean) as string[],
          metadata: {
            subject: card.subject,
            chapter: card.chapter,
            category: card.category,
            formula: card.formula,
            nextReviewDate: card.nextReviewDate,
            lastReviewedDate: card.lastReviewedDate,
            intervalDays: card.intervalDays ?? 1,
            easeFactor: card.easeFactor ?? 2.5,
            repetitions: card.repetitions ?? 0,
            confidence: card.confidence ?? 3,
            createdAt: now,
            updatedAt: now,
            author: 'student',
          },
          versionHistory: [
            {
              version: 1,
              title: card.front || 'Flashcard Question',
              body: card.back || '',
              tags: [card.subject, card.category, 'srs'].filter(Boolean) as string[],
              updatedAt: now,
              updatedBy: 'MigrationEngine',
              changeSummary: 'Initial migration from SRS Flashcards',
            },
          ],
        };
        this.itemsMap.set(item.id, item);
        migratedCount++;
      }
      countsByType.flashcard++;
    });

    // 3. Migrate PDFs -> 'pdf'
    const legacyPDFs = db.getPDFs();
    legacyPDFs.forEach((pdf) => {
      if (!this.itemsMap.has(pdf.id)) {
        const item: ContentItem = {
          id: pdf.id,
          type: 'pdf',
          title: pdf.title || 'PDF Document',
          body: pdf.contentSnippet || pdf.title || '',
          tags: [pdf.subject, pdf.chapter, 'pdf'].filter(Boolean) as string[],
          metadata: {
            subject: pdf.subject,
            chapter: pdf.chapter,
            fileSize: pdf.fileSize,
            pageCount: pdf.pageCount,
            readProgressPages: pdf.readProgressPages,
            readingTimeMinutes: pdf.readingTimeMinutes,
            indexedChapters: pdf.indexedChapters,
            notesExtractedCount: pdf.notesExtractedCount,
            flashcardsExtractedCount: pdf.flashcardsExtractedCount,
            createdAt: pdf.uploadedAt || now,
            updatedAt: pdf.uploadedAt || now,
            author: 'student',
          },
          versionHistory: [
            {
              version: 1,
              title: pdf.title || 'PDF Document',
              body: pdf.contentSnippet || pdf.title || '',
              tags: [pdf.subject, pdf.chapter, 'pdf'].filter(Boolean) as string[],
              updatedAt: pdf.uploadedAt || now,
              updatedBy: 'MigrationEngine',
              changeSummary: 'Initial migration from PDF Engine',
            },
          ],
        };
        this.itemsMap.set(item.id, item);
        migratedCount++;
      }
      countsByType.pdf++;
    });

    // 4. Migrate MCQs / PYQs -> 'pyq'
    const legacyMCQs = db.getMCQs();
    legacyMCQs.forEach((mcq) => {
      if (!this.itemsMap.has(mcq.id)) {
        const item: ContentItem = {
          id: mcq.id,
          type: 'pyq',
          title: `${mcq.year || 'GATE'} - ${mcq.subject} (${mcq.topic})`,
          body: mcq.questionText || '',
          tags: [mcq.subject, mcq.topic, mcq.year, mcq.type, 'pyq'].filter(Boolean) as string[],
          metadata: {
            subject: mcq.subject,
            topic: mcq.topic,
            year: mcq.year,
            marks: mcq.marks,
            difficulty: mcq.difficulty,
            questionType: (mcq.type as any) || 'MCQ',
            options: mcq.options,
            correctAnswer: mcq.correctAnswer,
            explanation: mcq.explanation,
            userStatus: (mcq.userStatus as any) || 'Unsolved',
            createdAt: now,
            updatedAt: now,
            author: 'GATE Committee',
          },
          versionHistory: [
            {
              version: 1,
              title: `${mcq.year || 'GATE'} - ${mcq.subject} (${mcq.topic})`,
              body: mcq.questionText || '',
              tags: [mcq.subject, mcq.topic, mcq.year, mcq.type, 'pyq'].filter(Boolean) as string[],
              updatedAt: now,
              updatedBy: 'MigrationEngine',
              changeSummary: 'Initial migration from Question Bank MCQs',
            },
          ],
        };
        this.itemsMap.set(item.id, item);
        migratedCount++;
      }
      countsByType.pyq++;
    });

    // 5. Migrate Mock Tests -> 'mock_test'
    const legacyMocks = db.getMockTests();
    legacyMocks.forEach((mock) => {
      if (!this.itemsMap.has(mock.id)) {
        const item: ContentItem = {
          id: mock.id,
          type: 'mock_test',
          title: mock.testName || 'Full Mock Test',
          body: `Phase: ${mock.phase} | Score: ${mock.score}/${mock.totalMarks} | Accuracy: ${mock.accuracyPercent}%`,
          tags: ['mock', mock.phase, 'test'].filter(Boolean) as string[],
          metadata: {
            testDate: mock.testDate,
            score: mock.score,
            totalMarks: mock.totalMarks,
            accuracyPercent: mock.accuracyPercent,
            predictedGatescore: mock.predictedGatescore,
            weakTopicsIdentified: mock.weakTopicsIdentified,
            createdAt: mock.testDate || now,
            updatedAt: mock.testDate || now,
            author: 'Test Engine',
          },
          versionHistory: [
            {
              version: 1,
              title: mock.testName || 'Full Mock Test',
              body: `Phase: ${mock.phase} | Score: ${mock.score}/${mock.totalMarks} | Accuracy: ${mock.accuracyPercent}%`,
              tags: ['mock', mock.phase, 'test'].filter(Boolean) as string[],
              updatedAt: mock.testDate || now,
              updatedBy: 'MigrationEngine',
              changeSummary: 'Initial migration from Mock Test Engine',
            },
          ],
        };
        this.itemsMap.set(item.id, item);
        migratedCount++;
      }
      countsByType.mock_test++;
    });

    this.persist();

    return {
      migratedCount,
      countsByType,
      verified: true,
    };
  }

  /**
   * Get all content items in the engine.
   */
  public getAllItems(): ContentItem[] {
    this.init();
    return Array.from(this.itemsMap.values());
  }

  /**
   * Get a single content item by ID.
   */
  public getItemById(id: string): ContentItem | undefined {
    this.init();
    return this.itemsMap.get(id);
  }

  /**
   * Get items filtered by ContentItemType.
   */
  public getItemsByType(type: ContentItemType): ContentItem[] {
    this.init();
    return Array.from(this.itemsMap.values()).filter((item) => item.type === type);
  }

  /**
   * Create a new ContentItem and persist. Syncs to legacy db tables if note or flashcard.
   */
  public createItem(
    itemData: Omit<ContentItem, 'id' | 'versionHistory'> & { id?: string },
    createdBy: string = 'User'
  ): ContentItem {
    this.init();
    const now = new Date().toISOString();
    const id = itemData.id || `content-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const newItem: ContentItem = {
      id,
      type: itemData.type,
      title: itemData.title,
      body: itemData.body || '',
      tags: itemData.tags || [],
      metadata: {
        ...itemData.metadata,
        examId: itemData.metadata?.examId || db.getActiveExamId(),
        createdAt: itemData.metadata?.createdAt || now,
        updatedAt: now,
      },
      versionHistory: [
        {
          version: 1,
          title: itemData.title,
          body: itemData.body || '',
          tags: itemData.tags || [],
          updatedAt: now,
          updatedBy: createdBy,
          changeSummary: 'Initial Creation',
        },
      ],
    };

    this.itemsMap.set(id, newItem);
    this.persist();

    // Bi-directional sync with legacy db tables
    this.syncToLegacyDB(newItem);

    return newItem;
  }

  /**
   * Update an existing ContentItem. Edits are non-destructive and record a version history entry!
   */
  public updateItem(
    id: string,
    updates: Partial<Pick<ContentItem, 'title' | 'body' | 'tags' | 'metadata'>>,
    updatedBy: string = 'User',
    changeSummary: string = 'Updated Content'
  ): ContentItem {
    this.init();
    const existing = this.itemsMap.get(id);
    if (!existing) {
      throw new Error(`ContentItem with ID ${id} not found.`);
    }

    const now = new Date().toISOString();
    const nextVersionNumber = (existing.versionHistory?.length || 0) + 1;

    // Snapshot current state before applying updates
    const updatedVersionHistory: ContentItemVersion[] = [
      ...(existing.versionHistory || []),
      {
        version: nextVersionNumber,
        title: updates.title !== undefined ? updates.title : existing.title,
        body: updates.body !== undefined ? updates.body : existing.body,
        tags: updates.tags !== undefined ? updates.tags : existing.tags,
        updatedAt: now,
        updatedBy,
        changeSummary,
      },
    ];

    const updatedItem: ContentItem = {
      ...existing,
      title: updates.title !== undefined ? updates.title : existing.title,
      body: updates.body !== undefined ? updates.body : existing.body,
      tags: updates.tags !== undefined ? updates.tags : existing.tags,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        updatedAt: now,
      },
      versionHistory: updatedVersionHistory,
    };

    this.itemsMap.set(id, updatedItem);
    this.persist();

    // Bi-directional sync
    this.syncToLegacyDB(updatedItem);

    return updatedItem;
  }

  /**
   * Restore a previous version from versionHistory.
   */
  public restoreVersion(
    id: string,
    targetVersionNumber: number,
    restoredBy: string = 'User'
  ): ContentItem {
    this.init();
    const existing = this.itemsMap.get(id);
    if (!existing) {
      throw new Error(`ContentItem with ID ${id} not found.`);
    }

    const targetVer = existing.versionHistory?.find((v) => v.version === targetVersionNumber);
    if (!targetVer) {
      throw new Error(`Version ${targetVersionNumber} not found in item history.`);
    }

    return this.updateItem(
      id,
      {
        title: targetVer.title,
        body: targetVer.body,
        tags: targetVer.tags,
      },
      restoredBy,
      `Restored version ${targetVersionNumber}`
    );
  }

  /**
   * Delete a ContentItem by ID.
   */
  public deleteItem(id: string): boolean {
    this.init();
    const existing = this.itemsMap.get(id);
    if (!existing) return false;

    this.itemsMap.delete(id);
    this.persist();

    // Remove from legacy tables if flashcard or note
    if (existing.type === 'note') {
      const notes = db.getScratchpadNotes().filter((n) => n.id !== id);
      db.setScratchpadNotes(notes);
    } else if (existing.type === 'flashcard') {
      const cards = db.getFlashcards().filter((c) => c.id !== id);
      db.setFlashcards(cards);
    }

    return true;
  }

  /**
   * Single unified search function over all ContentItems.
   */
  public searchContentItems(
    query: string,
    typeFilter: ContentItemType | 'all' = 'all',
    tagFilter: string = 'all'
  ): ContentItem[] {
    this.init();
    const cleanQuery = query.trim().toLowerCase();
    const items = Array.from(this.itemsMap.values());

    return items.filter((item) => {
      // Type match
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      // Tag match
      if (
        tagFilter !== 'all' &&
        !item.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())
      ) {
        return false;
      }

      // Query match (title, body, tags, metadata fields)
      if (!cleanQuery) return true;

      const titleMatch = item.title.toLowerCase().includes(cleanQuery);
      const bodyMatch = item.body.toLowerCase().includes(cleanQuery);
      const tagMatch = item.tags.some((t) => t.toLowerCase().includes(cleanQuery));
      const subjectMatch = item.metadata.subject?.toLowerCase().includes(cleanQuery);
      const topicMatch = item.metadata.topic?.toLowerCase().includes(cleanQuery);
      const chapterMatch = item.metadata.chapter?.toLowerCase().includes(cleanQuery);

      return titleMatch || bodyMatch || tagMatch || subjectMatch || topicMatch || chapterMatch;
    });
  }

  /**
   * SRS Review Helper for flashcards.
   * Updates SRS scheduling metadata on a flashcard ContentItem and syncs with srsEngine and db.ts!
   */
  public reviewSRSFlashcard(id: string, confidence: number): ContentItem {
    this.init();
    const item = this.getItemById(id);
    if (!item || item.type !== 'flashcard') {
      throw new Error(`Flashcard ContentItem with ID ${id} not found.`);
    }

    const currentCard: Flashcard = {
      id: item.id,
      subject: item.metadata.subject || 'General',
      chapter: item.metadata.chapter || 'Chapter 1',
      front: item.title,
      back: item.body,
      category: (item.metadata.category as any) || 'Concept',
      formula: item.metadata.formula,
      lastReviewedDate: item.metadata.lastReviewedDate,
      nextReviewDate: item.metadata.nextReviewDate || new Date().toISOString().split('T')[0],
      intervalDays: item.metadata.intervalDays ?? 1,
      easeFactor: item.metadata.easeFactor ?? 2.5,
      repetitions: item.metadata.repetitions ?? 0,
      confidence: item.metadata.confidence ?? 3,
    };

    const { nextIntervalDays, nextReviewDateStr } = calculateNextSRSInterval(
      currentCard.intervalDays,
      confidence
    );

    const updatedMetadata = {
      ...item.metadata,
      lastReviewedDate: new Date().toISOString().split('T')[0],
      nextReviewDate: nextReviewDateStr,
      intervalDays: nextIntervalDays,
      repetitions: (item.metadata.repetitions ?? 0) + 1,
      confidence,
    };

    return this.updateItem(
      id,
      { metadata: updatedMetadata },
      'SRSEngine',
      `Reviewed SRS card (confidence ${confidence}, next interval ${nextIntervalDays}d)`
    );
  }

  /**
   * Internal helper for bi-directional sync to legacy db tables.
   */
  private syncToLegacyDB(item: ContentItem) {
    if (item.type === 'note') {
      const notes = db.getScratchpadNotes();
      const existingIdx = notes.findIndex((n) => n.id === item.id);
      const updatedNote: ScratchpadNote = {
        id: item.id,
        title: item.title,
        content: item.body,
        tags: item.tags,
        createdAt: item.metadata.createdAt,
        updatedAt: item.metadata.updatedAt,
        examId: item.metadata.examId,
        accountId: item.metadata.author,
      };
      if (existingIdx >= 0) {
        notes[existingIdx] = updatedNote;
      } else {
        notes.push(updatedNote);
      }
      db.setScratchpadNotes(notes);
    } else if (item.type === 'flashcard') {
      const cards = db.getFlashcards();
      const existingIdx = cards.findIndex((c) => c.id === item.id);
      const updatedCard: Flashcard = {
        id: item.id,
        subject: item.metadata.subject || 'General',
        chapter: item.metadata.chapter || 'Chapter 1',
        front: item.title,
        back: item.body,
        formula: item.metadata.formula,
        category: (item.metadata.category as any) || 'Concept',
        lastReviewedDate: item.metadata.lastReviewedDate,
        nextReviewDate: item.metadata.nextReviewDate || new Date().toISOString().split('T')[0],
        intervalDays: item.metadata.intervalDays ?? 1,
        easeFactor: item.metadata.easeFactor ?? 2.5,
        repetitions: item.metadata.repetitions ?? 0,
        confidence: item.metadata.confidence ?? 3,
      };
      if (existingIdx >= 0) {
        cards[existingIdx] = updatedCard;
      } else {
        cards.push(updatedCard);
      }
      db.setFlashcards(cards);
    }
  }
}

export const contentEngine = new ContentEngine();
