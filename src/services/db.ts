import {
  PWLectureRecord,
  SyllabusSubject,
  TaskItem,
  Flashcard,
  PDFDocumentItem,
  PDFCaptureItem,
  BrowserVisitLog,
  MockTestRecord,
  StudyActivityLog,
  DesktopSettings,
  BreakGameStats,
  QuestionMCQ,
  MistakeEntry,
  ExamItem,
  ResourceItem,
  ProjectItem,
  DailyObjective,
  ScratchpadNote,
  TaskHistoryRecord,
  BookmarkItem,
  SubjectPlan,
  ChapterPlan,
  GeneratedTestSeries,
  FocusModePlan,
  DailyAvailabilityRecord,
  AutoScheduleSlot,
  AutoScheduleResult,
  LiveStudySessionState,
} from '../types';
import { CANONICAL_PW_LECTURES, GATE_SYLLABUS_SUBJECTS, INITIAL_GATE_PW_SUBJECT_PLANS } from '../data/canonicalData';
import { OFFICIAL_GATE_SYLLABUS, ALL_SUBJECT_NAMES, SUBJECT_REGISTRY } from '../data/subjectRegistry';
import { BUILTIN_EXAMS, getExamDefinition } from '../data/examDefinitions';
import { reanchorLectures } from './reanchoring';
import { authService } from './auth';
import { permissionsService } from './permissions';
import { validateBackupJSON } from './backupValidation';
// backupIntegrity used optionally at call sites for envelope backups

export function safeDispatch(event: Event | CustomEvent): void {
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      try {
        window.dispatchEvent(event);
      } catch (err) {
        console.error('[StudyOS Event Dispatch Error]', err);
      }
    }, 0);
  }
}

const DB_KEYS = {
  LECTURES: 'studyos_db_lectures',
  SYLLABUS: 'studyos_db_syllabus',
  TASKS: 'studyos_db_tasks',
  FLASHCARDS: 'studyos_db_flashcards',
  PDFS: 'studyos_db_pdfs',
  PDF_CAPTURES: 'studyos_db_pdf_captures',
  BROWSER_LOGS: 'studyos_db_browser_logs',
  MOCK_TESTS: 'studyos_db_mock_tests',
  ACTIVITY_LOGS: 'studyos_db_activity_logs',
  SETTINGS: 'studyos_db_settings',
  BREAK_GAME_STATS: 'studyos_db_break_game_stats',
  MCQS: 'studyos_db_mcqs',
  MISTAKES: 'studyos_db_mistakes',
  EXAMS: 'studyos_db_exams',
  RESOURCES: 'studyos_db_resources',
  PROJECTS: 'studyos_db_projects',
  SCRATCHPAD_NOTES: 'studyos_db_scratchpad_notes',
  TASK_HISTORY: 'studyos_db_task_history',
  BOOKMARKS: 'studyos_db_bookmarks',
  TEST_SERIES: 'studyos_db_test_series',
  FOCUS_MODE: 'studyos_db_focus_mode',
  DAILY_AVAILABILITY: 'studyos_db_daily_availability',
};

const SEED_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-1',
    title: 'AManager Offline Desktop Platform',
    category: 'Full-Stack',
    status: 'In Progress',
    priority: 'Critical',
    description: 'Local-first offline study OS for GATE CSE & DA aspirants with PDF snip engine, exam analytics, and PW lecture synchronization.',
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Lucide React'],
    repoUrl: '',
    demoUrl: '',
    targetCompletionDate: '2026-10-15',
    progressPercent: 75,
    tasks: [
      { id: 'pt-1', title: 'Implement Offline PDF Snip Engine', completed: true },
      { id: 'pt-2', title: 'Unlimited Multi-Exam Dashboard & Analytics', completed: true },
      { id: 'pt-3', title: 'Projects Workspace CRUD Management', completed: true },
      { id: 'pt-4', title: 'Local SQLite/IndexedDB Sync', completed: false },
    ],
    createdDate: '2026-07-01',
    updatedDate: '2026-07-24',
  },
  {
    id: 'proj-2',
    title: 'AI High-Performance Matrix Engine (Tensorix)',
    category: 'AI / Machine Learning',
    status: 'In Progress',
    priority: 'High',
    description: 'Custom C++/Python CUDA acceleration library for LLM inference on edge devices.',
    techStack: ['C++', 'CUDA', 'Python', 'PyTorch', 'CMake'],
    repoUrl: '',
    targetCompletionDate: '2026-12-01',
    progressPercent: 40,
    tasks: [
      { id: 'pt-21', title: 'Implement Fast GEMM CUDA Kernels', completed: true },
      { id: 'pt-22', title: 'FP16 Quantization Pipeline', completed: false },
      { id: 'pt-23', title: 'Benchmarking vs cuBLAS', completed: false },
    ],
    createdDate: '2026-06-10',
    updatedDate: '2026-07-20',
  },
];

// Default Initial Settings
export const DEFAULT_SETTINGS: DesktopSettings = {
  theme: 'light',
  reanchorStartDate: '2026-07-23', // Default 23 July 2026 as per user prompt example
  targetExamDate: '2027-02-07', // GATE 2027
  dailyGoalHours: 7,
  weeklyGoalHours: 48,
  autoSaveIntervalMs: 10000,
  offlineMode: true,
  allowBackgroundFocusTimer: false,
  soundNotifications: true,
  activeProfile: 'John Doe',
  showStudyBrowser: true, // Visible in navigation by default
  plannerDefaultDuration: 60,
  plannerDefaultSlotTime: '09:00',
  practiceNegativeMarking: true,
  practiceDefaultDurationMins: 60,
  pomodoroBreakConfig: {
    autoLaunchGames: false,
    defaultGame: '2048',
    randomizeGames: false,
    difficulty: 'medium',
    autoResumeStudy: true,
    allowSkipBreak: true,
    muteSounds: false,
    breakTheme: 'dark',
  },
  studyCoachConfig: {
    enabled: true,
    volume: 85,
    muted: false,
    repeatIntervalMinutes: 5,
    welcomeOnStart: true,
    encourageOnFinish: true,
  },
  themeScheduleConfig: {
    mode: 'auto',
    nightStartHour: 19,
    dayStartHour: 7,
  },
};

// Initial Seed Tasks
const SEED_TASKS: TaskItem[] = [
  {
    id: 'task-1',
    title: 'Watch Lecture 1: Analysis of Algorithms (Asymptotic Notation)',
    type: 'Lecture',
    subject: 'Algorithms',
    chapter: 'Analysis of Algorithms',
    dueDate: '2026-07-23',
    timeSlot: 'Morning',
    priority: 'High',
    estimatedMinutes: 90,
    completed: false,
  },
  {
    id: 'task-2',
    title: 'Solve DPP 01: Discrete Math Logic & Propositional Equivalence',
    type: 'DPP',
    subject: 'Discrete Mathematics',
    chapter: 'Mathematical Logic',
    dueDate: '2026-07-23',
    timeSlot: 'Afternoon',
    priority: 'High',
    estimatedMinutes: 60,
    completed: false,
  },
  {
    id: 'task-3',
    title: 'Flashcard Revision: Time Complexities & Master Theorem Formulas',
    type: 'Flashcards',
    subject: 'Algorithms',
    dueDate: '2026-07-23',
    timeSlot: 'Night',
    priority: 'Medium',
    estimatedMinutes: 30,
    completed: false,
  },
  {
    id: 'task-4',
    title: 'Review Operating Systems CPU Scheduling Notes',
    type: 'Revision',
    subject: 'Operating Systems',
    dueDate: '2026-07-24',
    timeSlot: 'Morning',
    priority: 'Medium',
    estimatedMinutes: 45,
    completed: false,
  },
];

// Initial Seed Flashcards
const SEED_FLASHCARDS: Flashcard[] = [
  {
    id: 'fc-1',
    subject: 'Algorithms',
    chapter: 'Analysis of Algorithms',
    front: 'What is Master Theorem for Divide & Conquer T(n) = aT(n/b) + f(n)?',
    back: 'Compare f(n) with n^(log_b a):\n1. f(n) = O(n^(log_b a - ε)) ⇒ T(n) = Θ(n^(log_b a))\n2. f(n) = Θ(n^(log_b a)) ⇒ T(n) = Θ(n^(log_b a) * log n)\n3. f(n) = Ω(n^(log_b a + ε)) & regularity condition ⇒ T(n) = Θ(f(n))',
    formula: 'T(n) = aT(n/b) + f(n)',
    category: 'Formula',
    nextReviewDate: '2026-07-23',
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
    confidence: 3,
  },
  {
    id: 'fc-2',
    subject: 'Discrete Mathematics',
    chapter: 'Mathematical Logic',
    front: 'What is the Contrapositive of statement P → Q?',
    back: 'The contrapositive of P → Q is ¬Q → ¬P. It is logically EQUIVALENT to P → Q.',
    category: 'Concept',
    nextReviewDate: '2026-07-23',
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
    confidence: 4,
  },
  {
    id: 'fc-3',
    subject: 'Operating Systems',
    chapter: 'CPU Scheduling',
    front: 'Which CPU scheduling algorithm gives minimum average waiting time?',
    back: 'Shortest Remaining Time First (SRTF) / Shortest Job First (SJF) (Optimal for average waiting time).',
    category: 'Short Note',
    nextReviewDate: '2026-07-23',
    intervalDays: 3,
    easeFactor: 2.5,
    repetitions: 1,
    confidence: 4,
  },
  {
    id: 'fc-4',
    subject: 'Computer Networks',
    chapter: 'Flow Control',
    front: 'What is the formula for Efficiency (η) in Stop-and-Wait protocol?',
    back: 'η = 1 / (1 + 2a), where a = T_propagation / T_transmission.',
    formula: 'η = 1 / (1 + 2a)',
    category: 'Formula',
    nextReviewDate: '2026-07-24',
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
    confidence: 3,
  },
  {
    id: 'fc-5',
    subject: 'Linear Algebra',
    chapter: 'Matrices',
    front: 'What is the relation between Eigenvalues and Trace / Determinant of a matrix?',
    back: 'Sum of Eigenvalues = Trace(A)\nProduct of Eigenvalues = Det(A)',
    formula: 'Σλ_i = Trace(A), Πλ_i = Det(A)',
    category: 'Formula',
    nextReviewDate: '2026-07-23',
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
    confidence: 5,
  },
];

// Initial Seed PDFs (start at 0 reading progress / minutes)
const SEED_PDFS: PDFDocumentItem[] = [
  {
    id: 'pdf-1',
    title: 'Tensorix Framework GATE CSE Roadmap 2027.pdf',
    subject: 'General Strategy',
    chapter: 'Tensorix 7-Month Master Strategy',
    fileSize: '4.2 MB',
    pageCount: 34,
    readProgressPages: 0,
    readingTimeMinutes: 0,
    indexedChapters: [
      'Executive Summary',
      'Syllabus Categorization (Tiers 1-4)',
      'Time Allocation Model (65/35 Split)',
      'Depth vs Breadth Strategy',
      'Performance Benchmarking',
    ],
    notesExtractedCount: 0,
    flashcardsExtractedCount: 0,
    uploadedAt: '2026-07-20',
    contentSnippet: 'Target Exam: GATE 2027 (Feb 1-15, 2027). Weekly Commitment: 45-50 hrs/week. First contact deadline: Week 20 (Nov 30, 2026).',
  },
  {
    id: 'pdf-2',
    title: 'CLRS Algorithms Chapter 4 - Recurrences & Master Theorem.pdf',
    subject: 'Algorithms',
    chapter: 'Analysis of Algorithms',
    fileSize: '8.1 MB',
    pageCount: 45,
    readProgressPages: 0,
    readingTimeMinutes: 0,
    indexedChapters: [
      'Substitution Method',
      'Recursion Tree Method',
      'Master Method for Solving Recurrences',
      'Akra-Bazzi Theorem',
    ],
    notesExtractedCount: 0,
    flashcardsExtractedCount: 0,
    uploadedAt: '2026-07-21',
    contentSnippet: 'The master method provides a cookbook method for solving recurrences of the form T(n) = aT(n/b) + f(n)...',
  },
];

// Initial Mock Tests (clean slate - user creates or imports tests)
const SEED_MOCKS: MockTestRecord[] = [];

// Initial MCQs (clean slate - user creates or imports questions)
export const SEED_MCQS: QuestionMCQ[] = [];

// Initial Mistakes (clean slate - user records actual test/practice mistakes)
export const SEED_MISTAKES: MistakeEntry[] = [];

// Initial Activity Log (Starts strictly at zero for all new users)
const SEED_ACTIVITY: StudyActivityLog[] = [];

// Seed Multi-Exams
export function getSeedExams(): ExamItem[] {
  return BUILTIN_EXAMS.map((def) => {
    const isGate = def.examId === 'GATE2027';
    return {
      id: def.examId,
      title: def.examName,
      code: def.examId,
      category: def.category,
      priority: 'Critical',
      targetScore: def.studyGoals.targetScore,
      examDate: def.examDates.examDate,
      registrationStartDate: def.examDates.registrationStart,
      registrationEndDate: def.examDates.registrationEnd,
      admitCardDate: def.examDates.admitCardDate,
      resultDate: def.examDates.resultDate,
      color: isGate
        ? 'purple'
        : def.category === 'Civil Services'
        ? 'amber'
        : def.category === 'Medical'
        ? 'cyan'
        : def.category === 'Management'
        ? 'rose'
        : 'indigo',
      status: 'Active',
      readinessPercent: def.progress.completionPercent,
      targetDailyHours: def.studyGoals.dailyTargetHours,
      notes: def.metadata.description,
      officialWebsiteUrl: def.metadata.officialUrl,
      createdDate: '2026-07-31',
      updatedDate: '2026-07-31',
      subjects: def.topicTree.map((s) => ({
        id: s.id,
        name: s.name,
        weightagePercent: 10,
        chapters: s.chapters.map((c) => ({
          id: c.id,
          name: c.name,
          completed: false,
          topics: c.topics.map((t) => ({
            id: t.id,
            name: t.name,
            status: 'Not Started' as const,
            confidence: 3,
          })),
        })),
      })),
    };
  });
}


// Seed Resource Library Items
export const SEED_RESOURCES: ResourceItem[] = [
  {
    id: 'res-1',
    title: 'Master Theorem Cheat Sheet & Proof Summary',
    type: 'Notes',
    examId: 'exam-gate-2027',
    subjectId: 'subj-algo',
    chapterId: 'chap-analysis',
    topicId: 'top-master-theorem',
    content: `# Master Theorem for Divide & Conquer Recurrences\nT(n) = a T(n/b) + f(n) where a >= 1, b > 1.\n\n1. Case 1: If f(n) = O(n^{log_b a - e}), T(n) = Theta(n^{log_b a})\n2. Case 2: If f(n) = Theta(n^{log_b a} * log^k n), T(n) = Theta(n^{log_b a} * log^{k+1} n)\n3. Case 3: If f(n) = Omega(n^{log_b a + e}), T(n) = Theta(f(n))`,
    fileSize: '12 KB',
    tags: ['Algorithms', 'Formula', 'GATE 2027', 'Important'],
    isFavorite: true,
    createdDate: '2026-07-22',
    updatedDate: '2026-07-24',
    linkedModule: 'Flashcards',
  },
  {
    id: 'res-2',
    title: 'AWS VPC Architecture Diagram & Subnet Design Guide.pdf',
    type: 'PDF',
    examId: 'exam-aws-cert-2026',
    subjectId: 'subj-aws-network',
    chapterId: 'chap-vpc',
    topicId: 'top-subnets',
    content: 'Comprehensive VPC Reference Architecture covering Internet Gateways, NAT Gateways, Security Groups vs NACLs, and Bastion Hosts.',
    fileSize: '3.4 MB',
    tags: ['AWS', 'Cloud', 'VPC', 'Architecture'],
    isFavorite: true,
    createdDate: '2026-07-21',
    updatedDate: '2026-07-23',
    linkedModule: 'PDF',
  },
  {
    id: 'res-3',
    title: 'GATE 2024 Question on Recurrence Bound T(n) = 2T(n/2) + n log n',
    type: 'PYQs',
    examId: 'exam-gate-2027',
    subjectId: 'subj-algo',
    chapterId: 'chap-analysis',
    topicId: 'top-master-theorem',
    content: 'Question: Tightest asymptotic bound for T(n) = 2T(n/2) + n log n.\nAnswer: Theta(n log^2 n).\nKey learning: f(n) = n log n matches Case 2 extension (k=1).',
    fileSize: '2 KB',
    tags: ['PYQ', 'GATE CS 2024', 'Recurrence'],
    isFavorite: false,
    createdDate: '2026-07-23',
    updatedDate: '2026-07-23',
    linkedModule: 'MCQs',
  },
];


// ---------------------------------------------------------------------------
// IndexedDB primary store + in-memory cache. localStorage kept only for
// lightweight preference keys / active exam id / migration bootstrap.
// ---------------------------------------------------------------------------
const IDB_NAME = 'StudyOS_Offline_DB_v2';
const IDB_STORE = 'kv';
const IDB_VERSION = 1;

/** Keys that must stay small and may remain in localStorage as preference mirrors */
const LIGHTWEIGHT_KEYS = new Set<string>([
  DB_KEYS.SETTINGS,
  DB_KEYS.BREAK_GAME_STATS,
]);

class LocalDatabaseManager {
  private memoryCache: Map<string, unknown> = new Map();
  private idb: IDBDatabase | null = null;
  private idbReady: Promise<void>;
  private pendingWrites: Map<string, unknown> = new Map();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private migrationDone = false;

  constructor() {
    this.idbReady = this.openIDB();
  }

  private openIDB(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve();
        return;
      }
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = () => {
          this.idb = req.result;
          this.migrateFromLocalStorage().finally(() => resolve());
        };
        req.onerror = () => {
          console.warn('[StudyOS DB] IndexedDB unavailable, using memory + localStorage fallback');
          resolve();
        };
      } catch {
        resolve();
      }
    });
  }

  /** One-time migration of large localStorage payloads into IndexedDB */
  private async migrateFromLocalStorage(): Promise<void> {
    if (this.migrationDone || typeof localStorage === 'undefined') return;
    this.migrationDone = true;
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('studyos_acc_') && k.includes('studyos_db_')) {
        keysToMigrate.push(k);
      }
    }
    for (const fullKey of keysToMigrate) {
      try {
        const raw = localStorage.getItem(fullKey);
        if (!raw) continue;
        if (raw.length < 200 && fullKey.includes(DB_KEYS.SETTINGS)) continue;
        const parsed = JSON.parse(raw);
        await this.idbPut(fullKey, parsed);
        this.memoryCache.set(fullKey, parsed);
        const isHeavy =
          fullKey.includes(DB_KEYS.PDFS) ||
          fullKey.includes(DB_KEYS.PDF_CAPTURES) ||
          fullKey.includes(DB_KEYS.LECTURES) ||
          fullKey.includes(DB_KEYS.SYLLABUS) ||
          fullKey.includes(DB_KEYS.FLASHCARDS) ||
          fullKey.includes(DB_KEYS.MCQS) ||
          fullKey.includes(DB_KEYS.MOCK_TESTS) ||
          fullKey.includes(DB_KEYS.ACTIVITY_LOGS) ||
          fullKey.includes(DB_KEYS.SCRATCHPAD_NOTES) ||
          fullKey.includes(DB_KEYS.BROWSER_LOGS) ||
          fullKey.includes(DB_KEYS.MISTAKES) ||
          fullKey.includes(DB_KEYS.RESOURCES) ||
          fullKey.includes(DB_KEYS.PROJECTS) ||
          fullKey.includes(DB_KEYS.TASKS) ||
          raw.length > 4000;
        if (isHeavy) {
          localStorage.removeItem(fullKey);
        }
      } catch (e) {
        console.warn('[StudyOS DB] Migration skip for', fullKey, e);
      }
    }
  }

  private idbPut(fullKey: string, value: unknown): Promise<void> {
    return new Promise((resolve) => {
      if (!this.idb) {
        resolve();
        return;
      }
      try {
        const tx = this.idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, fullKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private idbGet(fullKey: string): Promise<unknown | undefined> {
    return new Promise((resolve) => {
      if (!this.idb) {
        resolve(undefined);
        return;
      }
      try {
        const tx = this.idb.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(fullKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushPendingWrites(), 280);
  }

  private async flushPendingWrites(): Promise<void> {
    const entries = Array.from(this.pendingWrites.entries());
    this.pendingWrites.clear();
    await this.idbReady;
    for (const [fullKey, value] of entries) {
      let retries = 3;
      while (retries > 0) {
        try {
          await this.idbPut(fullKey, value);
          break;
        } catch {
          retries--;
          await new Promise((r) => setTimeout(r, 80));
        }
      }
    }
  }

  private isExamScopedKey(key: string): boolean {
    return key !== DB_KEYS.EXAMS;
  }

  private resolveKey(key: string): string {
    const accId = authService.getCurrentAccountId();
    if (this.isExamScopedKey(key)) {
      const activeExamId = this.getActiveExamId();
      return `studyos_acc_${accId}_exam_${activeExamId}_${key}`;
    }
    return `studyos_acc_${accId}_${key}`;
  }

  private get<T>(key: string, defaultValue: T): T {
    try {
      const fullKey = this.resolveKey(key);
      if (this.memoryCache.has(fullKey)) {
        return this.memoryCache.get(fullKey) as T;
      }
      if (typeof localStorage !== 'undefined') {
        let data = localStorage.getItem(fullKey);
        if (!data && this.isExamScopedKey(key) && this.getActiveExamId() === 'GATE2027') {
          const accId = authService.getCurrentAccountId();
          const oldExamKey = `studyos_acc_${accId}_exam_exam-gate-2027_${key}`;
          data = localStorage.getItem(oldExamKey);
          if (!data) {
            const legacyKey = `studyos_acc_${accId}_${key}`;
            data = localStorage.getItem(legacyKey);
          }
          if (data) {
            localStorage.setItem(fullKey, data);
          }
        }
        if (data) {
          const parsed = JSON.parse(data) as T;
          this.memoryCache.set(fullKey, parsed);
          return parsed;
        }
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setSilent<T>(key: string, value: T): void {
    const fullKey = this.resolveKey(key);
    this.memoryCache.set(fullKey, value);
    this.pendingWrites.set(fullKey, value);
    this.scheduleFlush();

    if (LIGHTWEIGHT_KEYS.has(key) && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(fullKey, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    }
  }

  private set<T>(key: string, value: T): void {
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role === 'Parent') {
      permissionsService.assertCanWrite(currentUser.role, `db.set [${key}]`);
    }
    const fullKey = this.resolveKey(key);
    this.memoryCache.set(fullKey, value);
    this.pendingWrites.set(fullKey, value);
    this.scheduleFlush();

    if (LIGHTWEIGHT_KEYS.has(key) && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(fullKey, JSON.stringify(value));
      } catch {
        try {
          authService.cleanOrphanAndHeavySeedKeys?.();
        } catch {
          /* ignore */
        }
      }
    }

    safeDispatch(new Event('studyos_db_updated'));
  }

  /** Force immediate persistence of all pending writes (call on unload) */
  public async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushPendingWrites();
  }

  /** Prefetch a key from IndexedDB into memory (async hydration) */
  public async hydrateKey(key: string): Promise<void> {
    await this.idbReady;
    const fullKey = this.resolveKey(key);
    if (this.memoryCache.has(fullKey)) return;
    const val = await this.idbGet(fullKey);
    if (val !== undefined) {
      this.memoryCache.set(fullKey, val);
    }
  }

  // --- INITIALIZATION / SEEDING ---
  public initializeExamWorkspace(examType: 'GATE' | 'CUSTOM', targetDate?: string, dailyHours?: number): void {
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const settings: DesktopSettings = {
      theme: 'light',
      reanchorStartDate: todayStr,
      targetExamDate: targetDate || (examType === 'GATE' ? '2027-02-07' : todayStr),
      dailyGoalHours: dailyHours || 6,
      weeklyGoalHours: (dailyHours || 6) * 7,
      autoSaveIntervalMs: 10000,
      offlineMode: true,
      soundNotifications: true,
      activeProfile: authService.getCurrentUser().fullName || 'Personal Workspace',
    };
    this.setSettings(settings);

    // Clean out heavy default keys so getters fall back dynamically to built-in canonical data without wasting localStorage
    const lecturesKey = this.resolveKey(DB_KEYS.LECTURES);
    const syllabusKey = this.resolveKey(DB_KEYS.SYLLABUS);
    const mockKey = this.resolveKey(DB_KEYS.MOCK_TESTS);
    const mcqKey = this.resolveKey(DB_KEYS.MCQS);
    const mistakeKey = this.resolveKey(DB_KEYS.MISTAKES);
    const projectKey = this.resolveKey(DB_KEYS.PROJECTS);

    if (examType === 'GATE') {
      localStorage.removeItem(lecturesKey);
      localStorage.removeItem(syllabusKey);
    } else {
      // CUSTOM EXAM: empty workspace
      this.setLectures([]);
      this.setSyllabus([]);
    }

    localStorage.removeItem(mockKey);
    localStorage.removeItem(mcqKey);
    localStorage.removeItem(mistakeKey);
    localStorage.removeItem(projectKey);

    this.setTasks([]);
    this.setFlashcards([]);
    this.setPDFs([]);
    this.setActivityLogs([]);

    safeDispatch(new Event('studyos_lectures_updated'));
    safeDispatch(new Event('storage'));
  }

  public initDB(): void {
    const accId = authService.getCurrentAccountId();
    if (accId) {
      try {
        const lecturesKey = `studyos_acc_${accId}_${DB_KEYS.LECTURES}`;
        const raw = localStorage.getItem(lecturesKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const hasUserChanges = parsed.some(
              (l: any) => Boolean(l.notes) || l.status !== 'Pending' || l.timeSpentMinutes > 0 || l.dppCompleted || (l.revisionCount && l.revisionCount > 0)
            );
            if (!hasUserChanges) {
              localStorage.removeItem(lecturesKey);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const settingsKey = this.resolveKey(DB_KEYS.SETTINGS);
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(settingsKey) && !this.memoryCache.has(settingsKey)) {
      const user = authService.getCurrentUser();
      const type = user.targetExamType || 'GATE';
      this.initializeExamWorkspace(type, user.targetExamDate, user.dailyGoalHours);
    }

    // Async hydrate heavy datasets from IndexedDB into memory cache
    const heavyKeys = [
      DB_KEYS.LECTURES,
      DB_KEYS.SYLLABUS,
      DB_KEYS.TASKS,
      DB_KEYS.FLASHCARDS,
      DB_KEYS.PDFS,
      DB_KEYS.PDF_CAPTURES,
      DB_KEYS.MCQS,
      DB_KEYS.MOCK_TESTS,
      DB_KEYS.ACTIVITY_LOGS,
      DB_KEYS.SCRATCHPAD_NOTES,
      DB_KEYS.BROWSER_LOGS,
      DB_KEYS.MISTAKES,
      DB_KEYS.RESOURCES,
      DB_KEYS.PROJECTS,
      DB_KEYS.EXAMS,
      DB_KEYS.SETTINGS,
    ];
    void this.idbReady.then(() =>
      Promise.all(heavyKeys.map((k) => this.hydrateKey(k))).then(() => {
        safeDispatch(new Event('studyos_db_updated'));
        safeDispatch(new Event('studyos_exams_updated'));
      })
    );
  }

  // --- SETTINGS & DATE RE-ANCHORING ---
  public getSettings(): DesktopSettings {
    return this.get<DesktopSettings>(DB_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  public setSettings(settings: DesktopSettings): void {
    this.set(DB_KEYS.SETTINGS, settings);
  }

  // --- DAILY OBJECTIVE ---
  public getDailyObjective(): DailyObjective {
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const key = `daily_obj_${todayStr}`;
    const defaultObj: DailyObjective = {
      goalText: 'Master Core Concepts & Complete Daily Problem Sets',
      subgoals: [
        { id: '1', text: 'Complete planned lecture modules', completed: true },
        { id: '2', text: 'Solve 10 GATE PYQ practice questions', completed: false },
        { id: '3', text: 'Conduct SRS Flashcard Active Recall', completed: false },
      ],
      completionPercent: 33,
      date: todayStr,
    };
    return this.get<DailyObjective>(key, defaultObj);
  }

  public setDailyObjective(objective: DailyObjective): void {
    const todayStr = new Date().toISOString().split('T')[0];
    const key = `daily_obj_${todayStr}`;
    this.set(key, objective);
  }

  // --- SCRATCHPAD PERSISTENT NOTES CRUD ---
  public getScratchpadNotes(examId?: string): ScratchpadNote[] {
    const notes = this.get<ScratchpadNote[]>(DB_KEYS.SCRATCHPAD_NOTES, []);
    if (notes && Array.isArray(notes) && notes.length > 0) {
      return notes;
    }
    // Migration/Legacy check: if legacy string note exists, convert to initial note
    const legacyText = this.getLegacyScratchpadText(examId);
    const activeExamId = examId || this.getActiveExamId();
    const accId = authService.getCurrentAccountId();
    const initialNote: ScratchpadNote = {
      id: `scratch-default-${activeExamId}`,
      title: 'Session Scratchpad Note',
      content: legacyText || '',
      isPinned: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      examId: activeExamId,
      accountId: accId,
    };
    const initialNotes = [initialNote];
    this.setSilent(DB_KEYS.SCRATCHPAD_NOTES, initialNotes);
    return initialNotes;
  }

  public setScratchpadNotes(notes: ScratchpadNote[], examId?: string): void {
    this.set(DB_KEYS.SCRATCHPAD_NOTES, notes);
    safeDispatch(
      new CustomEvent('studyos_scratchpad_updated', {
        detail: { examId: examId || this.getActiveExamId(), notes },
      })
    );
  }

  public getScratchpadActiveNoteId(examId?: string): string {
    const key = `active_scratchpad_note_id`;
    return this.get<string>(key, '');
  }

  public setScratchpadActiveNoteId(noteId: string): void {
    const key = `active_scratchpad_note_id`;
    this.set(key, noteId);
    safeDispatch(new Event('studyos_scratchpad_updated'));
  }

  public getScratchpadActiveNote(examId?: string): ScratchpadNote {
    const notes = this.getScratchpadNotes(examId);
    const activeId = this.getScratchpadActiveNoteId(examId);
    let found = notes.find((n) => n.id === activeId);
    if (!found && notes.length > 0) {
      found = notes[0];
    }
    if (!found) {
      const activeExamId = examId || this.getActiveExamId();
      const accId = authService.getCurrentAccountId();
      found = {
        id: `scratch-${Date.now()}`,
        title: 'New Scratch Note',
        content: '',
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        examId: activeExamId,
        accountId: accId,
      };
      notes.unshift(found);
      this.setSilent(DB_KEYS.SCRATCHPAD_NOTES, notes);
      this.setSilent('active_scratchpad_note_id', found.id);
    }
    return found;
  }

  public saveScratchpadNote(
    noteData: Partial<ScratchpadNote> & { id?: string },
    examId?: string
  ): ScratchpadNote {
    const notes = this.getScratchpadNotes(examId);
    const activeExamId = examId || this.getActiveExamId();
    const accId = authService.getCurrentAccountId();
    const now = new Date().toISOString();

    let targetId = noteData.id;
    let existingIndex = targetId ? notes.findIndex((n) => n.id === targetId) : -1;

    let savedNote: ScratchpadNote;

    if (existingIndex >= 0 && notes[existingIndex]) {
      savedNote = {
        ...notes[existingIndex]!,
        ...noteData,
        updatedAt: now,
      };
      notes[existingIndex] = savedNote;
    } else {
      targetId = targetId || `scratch-${Date.now()}`;
      savedNote = {
        id: targetId,
        title: noteData.title || (noteData.content ? noteData.content.slice(0, 25).trim() : 'Untitled Scratch Note'),
        content: noteData.content || '',
        isPinned: noteData.isPinned || false,
        createdAt: now,
        updatedAt: now,
        examId: activeExamId,
        accountId: accId,
        tags: noteData.tags || [],
      };
      notes.unshift(savedNote);
    }

    this.setScratchpadNotes(notes, activeExamId);
    this.setScratchpadActiveNoteId(savedNote.id);
    return savedNote;
  }

  public deleteScratchpadNote(id: string, examId?: string): void {
    let notes = this.getScratchpadNotes(examId);
    notes = notes.filter((n) => n.id !== id);
    this.setScratchpadNotes(notes, examId);
    const activeId = this.getScratchpadActiveNoteId(examId);
    if (activeId === id) {
      this.setScratchpadActiveNoteId(notes[0]?.id || '');
    }
  }

  public clearScratchpadNotes(examId?: string): void {
    const activeExamId = examId || this.getActiveExamId();
    const accId = authService.getCurrentAccountId();
    const defaultNote: ScratchpadNote = {
      id: `scratch-${Date.now()}`,
      title: 'Session Scratchpad Note',
      content: '',
      isPinned: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      examId: activeExamId,
      accountId: accId,
    };
    this.setScratchpadNotes([defaultNote], activeExamId);
    this.setScratchpadActiveNoteId(defaultNote.id);
  }

  // Backwards compatibility wrappers for single string note
  public getScratchpadNote(examId?: string): string {
    const activeNote = this.getScratchpadActiveNote(examId);
    return activeNote ? activeNote.content : '';
  }

  public setScratchpadNote(noteText: string, examId?: string): void {
    const activeNote = this.getScratchpadActiveNote(examId);
    this.saveScratchpadNote({ id: activeNote.id, content: noteText }, examId);
  }

  private getLegacyScratchpadText(examId?: string): string {
    const accId = authService.getCurrentAccountId();
    const activeId = examId || this.getActiveExamId();
    const fullKey = `studyos_acc_${accId}_exam_${activeId}_scratchpad_note`;
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) return '';
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch {
      return '';
    }
  }

  public updateReanchorStartDate(newDate: string): void {
    const settings = this.getSettings();
    settings.reanchorStartDate = newDate;
    this.setSettings(settings);

    // Re-anchor all lecture dates
    const currentLectures = this.getLectures();
    const updated = reanchorLectures(currentLectures, newDate);
    this.setLectures(updated);
  }

  // --- LECTURES & LECTURE PLANS ---
  public isGateActive(examId?: string): boolean {
    const id = examId || this.getActiveExamId();
    if (id === 'GATE2027' || id === 'exam-gate-2027') return true;
    const exams = this.getExams();
    const exam = exams.find((e) => e.id === id);
    if (!exam) return false;
    return (
      (exam.code ? exam.code.toUpperCase().includes('GATE') : false) ||
      (exam.title ? exam.title.toUpperCase().includes('GATE') : false)
    );
  }

  public getLecturePlans(examId?: string): SubjectPlan[] {
    const targetExamId = examId || this.getActiveExamId();
    const isGate = this.isGateActive(targetExamId);
    const key = `studyos_lecture_plans_${targetExamId}`;

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed as SubjectPlan[];
        } catch (e) {
          console.error('Failed to parse lecture plans for exam', targetExamId, e);
        }
      }
      // If active exam is GATE, check legacy fallback
      if (isGate) {
        const legacy = localStorage.getItem('studyos_lecture_plans');
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed) && parsed.length > 0) {
              localStorage.setItem(key, legacy);
              return parsed as SubjectPlan[];
            }
          } catch {
            /* ignore */
          }
        }
        return INITIAL_GATE_PW_SUBJECT_PLANS;
      }
    }

    // For non-GATE exams: generate initial plans from exam definition topic tree
    if (!isGate) {
      const def = getExamDefinition(targetExamId);
      if (def && def.topicTree && def.topicTree.length > 0) {
        const generatedPlans: SubjectPlan[] = def.topicTree.map((s) => ({
          id: s.id,
          name: s.name,
          chapters: s.chapters.map((c) => ({
            id: c.id,
            name: c.name,
            lecturesCount: (c.topics.length * 2) || 4,
            dppCount: 2,
            dppType: 'DPP' as const,
            lecturesCompleted: 0,
            dppsCompleted: 0,
          })),
        }));
        return generatedPlans;
      }
    }

    return isGate ? INITIAL_GATE_PW_SUBJECT_PLANS : [];
  }

  public setLecturePlans(plans: SubjectPlan[], examId?: string): void {
    const targetExamId = examId || this.getActiveExamId();
    const isGate = this.isGateActive(targetExamId);
    const key = `studyos_lecture_plans_${targetExamId}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(plans));
      if (isGate) {
        localStorage.setItem('studyos_lecture_plans', JSON.stringify(plans));
      }
      safeDispatch(new Event('studyos_lecture_plans_updated'));
      safeDispatch(new Event('storage'));
    }
  }

  public getLectures(examId?: string): PWLectureRecord[] {
    const accId = authService.getCurrentAccountId();
    const targetExamId = examId || this.getActiveExamId();
    const fullKey = `studyos_acc_${accId}_exam_${targetExamId}_${DB_KEYS.LECTURES}`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(fullKey) : null;
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PWLectureRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        /* proceed to generation */
      }
    }

    // Generate comprehensive lecture records mapped from syllabus subjects & chapters
    const isGate = this.isGateActive(targetExamId);
    const settings = this.getSettings();
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const startDate = settings.reanchorStartDate || todayStr;

    const baseLectures: PWLectureRecord[] = [];
    let globalLecCount = 1;
    const today = new Date(startDate || todayStr);

    if (isGate) {
      // 1. Include base canonical lectures
      const reanchoredCanonical = reanchorLectures(CANONICAL_PW_LECTURES, startDate).map((l) => ({
        ...l,
        status: 'Pending' as const,
        timeSpentMinutes: 0,
        dppCompleted: false,
        revisionCount: 0,
        notes: '',
      }));
      baseLectures.push(...reanchoredCanonical);

      // 2. Identify subjects present in official GATE syllabus/registry but missing from canonical lectures
      const coveredSubjects = new Set(baseLectures.map((l) => l.subject.toLowerCase()));
      
      SUBJECT_REGISTRY.forEach((regSubj, sIdx) => {
        const isCovered = Array.from(coveredSubjects).some(
          (c) => c === regSubj.name.toLowerCase() || 
                 regSubj.name.toLowerCase().includes(c) || 
                 c.includes(regSubj.name.toLowerCase())
        );

        if (!isCovered) {
          regSubj.chapters.forEach((chap, cIdx) => {
            const chapTopics = chap.topics && chap.topics.length > 0
              ? chap.topics
              : [{ id: `${chap.id}-top-1`, name: `${chap.name} Concepts & Principles`, subtopics: [] }];

            chapTopics.forEach((top, tIdx) => {
              const dayOffset = (sIdx * 5 + cIdx * 2 + tIdx) % 180;
              const lecDate = new Date(today.getTime() + dayOffset * 86400000).toISOString().slice(0, 10);
              const lecNum = (chapTopics.length > 1 ? tIdx + 1 : cIdx + 1);

              baseLectures.push({
                id: `lec-gate-reg-${regSubj.id}-${chap.id}-${tIdx + 1}`,
                subject: regSubj.name,
                chapter: chap.name,
                title: top.name,
                lectureNumber: lecNum,
                originalDate: lecDate,
                reanchoredDate: lecDate,
                durationMinutes: 90,
                timeSpentMinutes: 0,
                dpp: `DPP-${String(cIdx + 1).padStart(2, '0')}.${tIdx + 1}`,
                weeklyTest: tIdx === chapTopics.length - 1 ? `WT-${regSubj.name.slice(0, 3).toUpperCase()}` : '',
                status: 'Pending',
                watchSpeed: 1,
                notes: '',
                dppCompleted: false,
                revisionCount: 0,
                confidence: 3,
                mistakesLogged: '',
                bookmarkTimestamp: '',
              });
            });
          });
        }
      });

      return baseLectures;
    }

    // Non-GATE Exams (Custom Exams, UPSC, NEET, CAT, JEE, etc.)
    const def = getExamDefinition(targetExamId);
    const syllabus = this.getSyllabus(targetExamId);

    if (def && def.topicTree && def.topicTree.length > 0) {
      def.topicTree.forEach((sub, sIdx) => {
        sub.chapters.forEach((chap, cIdx) => {
          const chapTopics = chap.topics && chap.topics.length > 0
            ? chap.topics
            : [{ id: `${chap.id}-top-1`, name: `${chap.name} Foundations`, subtopics: [] }];

          chapTopics.forEach((top, tIdx) => {
            const dayOffset = (sIdx * 4 + cIdx * 2 + tIdx) % 180;
            const targetDate = new Date(today.getTime() + dayOffset * 86400000).toISOString().slice(0, 10);

            baseLectures.push({
              id: `lec-${targetExamId.toLowerCase()}-${globalLecCount}`,
              subject: sub.name,
              chapter: chap.name,
              title: top.name,
              lectureNumber: globalLecCount++,
              originalDate: targetDate,
              reanchoredDate: targetDate,
              durationMinutes: 90,
              timeSpentMinutes: 0,
              dpp: `DPP-${sIdx + 1}.${cIdx + 1}`,
              weeklyTest: tIdx === chapTopics.length - 1 ? `WT-${sIdx + 1}` : '',
              status: 'Pending',
              watchSpeed: 1,
              notes: '',
              dppCompleted: false,
              revisionCount: 0,
              confidence: 3,
              mistakesLogged: '',
              bookmarkTimestamp: '',
            });
          });
        });
      });
    } else if (syllabus && syllabus.length > 0) {
      syllabus.forEach((sub, sIdx) => {
        (sub.topics || []).forEach((top, tIdx) => {
          const parts = top.name.split(':');
          const chapName = parts.length > 1 ? parts[0].trim() : 'Core Chapter';
          const topName = parts.length > 1 ? parts[1].trim() : top.name;
          const dayOffset = (sIdx * 3 + tIdx) % 180;
          const targetDate = new Date(today.getTime() + dayOffset * 86400000).toISOString().slice(0, 10);

          baseLectures.push({
            id: `lec-${targetExamId.toLowerCase()}-${globalLecCount}`,
            subject: sub.name,
            chapter: chapName,
            title: topName,
            lectureNumber: globalLecCount++,
            originalDate: targetDate,
            reanchoredDate: targetDate,
            durationMinutes: 90,
            timeSpentMinutes: 0,
            dpp: `DPP-${sIdx + 1}.${tIdx + 1}`,
            weeklyTest: '',
            status: top.status === 'Completed' ? 'Completed' : 'Pending',
            watchSpeed: 1,
            notes: '',
            dppCompleted: false,
            revisionCount: 0,
            confidence: top.confidence || 3,
            mistakesLogged: '',
            bookmarkTimestamp: '',
          });
        });
      });
    }

    return baseLectures;
  }

  /**
   * Retrieves all lectures strictly belonging to a specific subject name within an exam context.
   */
  public getLecturesForSubject(subjectName: string, examId?: string): PWLectureRecord[] {
    if (!subjectName) return [];
    const targetExamId = examId || this.getActiveExamId();
    const allLectures = this.getLectures(targetExamId);
    const q = subjectName.trim().toLowerCase();

    const matched = allLectures.filter((l) => {
      const sub = l.subject.trim().toLowerCase();
      return (
        sub === q ||
        sub.replace(/s\b/g, '') === q.replace(/s\b/g, '') ||
        sub.replace(/system/g, 'systems') === q.replace(/system/g, 'systems') ||
        (q.includes('operating') && sub.includes('operat')) ||
        (q.includes('dbms') && (sub.includes('database') || sub.includes('dbms'))) ||
        (q.includes('database') && sub.includes('database')) ||
        (q.includes('network') && sub.includes('network')) ||
        (q.includes('algorithm') && sub.includes('algo')) ||
        (q.includes('compiler') && sub.includes('compiler')) ||
        (q.includes('computation') && (sub.includes('toc') || sub.includes('computat') || sub.includes('automata'))) ||
        (q.includes('discrete') && sub.includes('discrete'))
      );
    });

    return matched;
  }

  public setLectures(lectures: PWLectureRecord[]): void {
    this.set(DB_KEYS.LECTURES, lectures);
    safeDispatch(new Event('studyos_lectures_updated'));
    safeDispatch(new Event('storage'));
  }

  public updateLecture(updated: PWLectureRecord): void {
    const lectures = this.getLectures();
    const idx = lectures.findIndex((l) => l.id === updated.id);
    if (idx !== -1) {
      lectures[idx] = updated;
      this.setLectures(lectures);
    }
  }

  public addLecture(newLecture: PWLectureRecord): void {
    const lectures = this.getLectures();
    lectures.unshift(newLecture);
    this.setLectures(lectures);
  }

  public deleteLecture(id: string): void {
    const lectures = this.getLectures();
    const filtered = lectures.filter((l) => l.id !== id);
    this.setLectures(filtered);
  }

  public resetLecturesToCanonical(): void {
    if (!this.isGateActive()) {
      this.setLectures([]);
      return;
    }
    const settings = this.getSettings();
    const reanchored = reanchorLectures(CANONICAL_PW_LECTURES, settings.reanchorStartDate);
    this.setLectures(reanchored);
  }

  // --- SYLLABUS ---
  public getSyllabus(examId?: string): SyllabusSubject[] {
    const targetExamId = examId || this.getActiveExamId();
    const isGate = this.isGateActive(targetExamId);

    if (isGate) {
      const defaultGate: SyllabusSubject[] =
        OFFICIAL_GATE_SYLLABUS && OFFICIAL_GATE_SYLLABUS.length > 0
          ? (OFFICIAL_GATE_SYLLABUS as SyllabusSubject[])
          : GATE_SYLLABUS_SUBJECTS;
      return this.get<SyllabusSubject[]>(`${DB_KEYS.SYLLABUS}_${targetExamId}`, defaultGate);
    }

    const examDef = getExamDefinition(targetExamId);
    const exams = this.getExams();
    const activeExam = exams.find((e) => e.id === targetExamId || e.code === targetExamId);

    let defaultSyllabus: SyllabusSubject[] = [];
    if (examDef && examDef.subjects && examDef.subjects.length > 0) {
      defaultSyllabus = examDef.subjects;
    } else if (activeExam && activeExam.subjects && activeExam.subjects.length > 0) {
      defaultSyllabus = activeExam.subjects.map((sub, sIdx) => ({
        id: sub.id || `${targetExamId.toLowerCase()}-sub-${sIdx + 1}`,
        name: sub.name,
        course: 'CS' as const,
        tier: 'TIER_1' as const,
        weightage: `${sub.weightagePercent || 10}%`,
        coreHours7Month: 40,
        idealHours: 50,
        priorityRank: sIdx + 1,
        prerequisites: 'Core Fundamentals',
        topics: (sub.chapters || []).flatMap((chap) =>
          (chap.topics || []).map((top) => ({
            id: top.id,
            subjectId: sub.id,
            name: `${chap.name}: ${top.name}`,
            course: 'CS' as const,
            tier: 'TIER_1' as const,
            approach: 'DEPTH' as const,
            weightagePercent: 8,
            idealHours: 12,
            completedHours: top.status === 'Completed' ? 12 : top.status === 'In Progress' ? 6 : 0,
            status: top.status === 'Completed' ? 'Completed' : top.status === 'In Progress' ? 'In Progress' : 'Not Started',
            confidence: top.confidence || 3,
            difficulty: 'Medium' as const,
            notesCount: 2,
            questionsSolved: top.status === 'Completed' ? 20 : 0,
            revisionCount: 1,
            subtopics: [chap.name],
          }))
        ),
      }));
    }

    return this.get<SyllabusSubject[]>(`${DB_KEYS.SYLLABUS}_${targetExamId}`, defaultSyllabus);
  }

  public setSyllabus(subjects: SyllabusSubject[], examId?: string): void {
    const targetExamId = examId || this.getActiveExamId();
    this.set(`${DB_KEYS.SYLLABUS}_${targetExamId}`, subjects);
    safeDispatch(new Event('studyos_syllabus_updated'));
    safeDispatch(new Event('studyos_db_updated'));
  }

  // --- DYNAMIC SYLLABUS-DRIVEN SUBJECT SYSTEM ---
  /**
   * Retrieves the subjects belonging strictly to the currently selected exam.
   * Exam → Syllabus → Subject → Chapter → Topic.
   * Never hardcoded; all dropdowns derive from here.
   */
  public getCurrentExamSubjects(examId?: string): string[] {
    const targetExamId = examId || this.getActiveExamId();
    const isGate = this.isGateActive(targetExamId);

    // 1. Check if the active exam item in db.getExams() has explicit subjects
    const exams = this.getExams();
    const activeExam = exams.find(
      (e) =>
        e.id.toUpperCase() === targetExamId.toUpperCase() ||
        (e.code && e.code.toUpperCase() === targetExamId.toUpperCase())
    );

    if (activeExam && Array.isArray(activeExam.subjects) && activeExam.subjects.length > 0) {
      const names = activeExam.subjects
        .map((s: any) => (typeof s === 'string' ? s : s?.name))
        .filter(Boolean);
      if (names.length > 0) return names;
    }

    // 2. Check stored syllabus for this exam
    const syllabus = this.getSyllabus(targetExamId);
    if (Array.isArray(syllabus) && syllabus.length > 0) {
      const names = syllabus.map((s) => s.name).filter(Boolean);
      if (names.length > 0) return names;
    }

    // 3. Check exam definitions
    const examDef = getExamDefinition(targetExamId);
    if (examDef && examDef.subjects && examDef.subjects.length > 0) {
      const names = examDef.subjects.map((s) => s.name).filter(Boolean);
      if (names.length > 0) return names;
    }

    if (examDef && examDef.topicTree && examDef.topicTree.length > 0) {
      const names = examDef.topicTree.map((s) => s.name).filter(Boolean);
      if (names.length > 0) return names;
    }

    // 4. Check lecture planner for this exam
    const lectures = this.getLectures(targetExamId);
    if (lectures && lectures.length > 0) {
      const subSet = new Set<string>();
      lectures.forEach((l) => {
        if (l.subject) subSet.add(l.subject.trim());
      });
      if (subSet.size > 0) return Array.from(subSet);
    }

    // 5. If GATE active, fallback to official GATE syllabus subjects
    if (isGate) {
      return ALL_SUBJECT_NAMES;
    }

    return [];
  }

  // --- SINGLE-SUBJECT FOCUS MODE & PLANNING MODES ---
  public getFocusModePlan(examId?: string): FocusModePlan {
    const targetExamId = examId || this.getActiveExamId();
    const key = `${DB_KEYS.FOCUS_MODE}_${targetExamId}`;
    const subjects = this.getCurrentExamSubjects(targetExamId);
    const defaultSubject = subjects[0] || '';
    const activeExam = this.getExams().find((e) => e.id === targetExamId);

    const defaultPlan: FocusModePlan = {
      examId: targetExamId,
      mode: 'focus',
      subjectId: defaultSubject ? `subj-${defaultSubject.toLowerCase().replace(/\s+/g, '-')}` : '',
      subjectName: defaultSubject,
      requiredHours: 40,
      completedStudyHours: 0,
      targetDate: activeExam?.examDate || '2027-02-15',
      priority: 'High',
      autoAdvanceNextSubject: true,
      isCompleted: false,
      preferredSessionLengthMinutes: 60,
      maxDailyStudyHours: 6,
      updatedAt: new Date().toISOString(),
    };

    const stored = this.get<FocusModePlan>(key, defaultPlan);
    if (!stored.subjectName && defaultSubject) {
      stored.subjectName = defaultSubject;
    }
    return stored;
  }

  public saveFocusModePlan(planData: Partial<FocusModePlan>, examId?: string): FocusModePlan {
    const targetExamId = examId || this.getActiveExamId();
    const key = `${DB_KEYS.FOCUS_MODE}_${targetExamId}`;
    const current = this.getFocusModePlan(targetExamId);
    const updated: FocusModePlan = {
      ...current,
      ...planData,
      examId: targetExamId,
      updatedAt: new Date().toISOString(),
    };

    // Calculate completion status
    const remaining = Math.max(0, updated.requiredHours - updated.completedStudyHours);
    if (remaining <= 0 && !updated.isCompleted) {
      updated.isCompleted = true;
      updated.completedAt = new Date().toISOString();
    } else if (remaining > 0 && updated.isCompleted) {
      updated.isCompleted = false;
    }

    this.set(key, updated);
    safeDispatch(new CustomEvent('studyos_focus_mode_updated', { detail: { plan: updated } }));
    safeDispatch(new Event('studyos_db_updated'));
    return updated;
  }

  /**
   * Records verified live study session data directly to database logs,
   * updates the active Focus Subject's completed study hours,
   * updates the matching TaskItem if supplied, and recalculates remaining hours.
   */
  public recordActualStudySession(session: {
    examId?: string;
    subject: string;
    chapter?: string;
    topic?: string;
    durationMinutes: number;
    notes?: string;
    type?: string;
    taskId?: string;
  }): { remainingHours: number; subjectCompleted: boolean; nextSubject?: string } {
    const targetExamId = session.examId || this.getActiveExamId();
    const durationHours = session.durationMinutes / 60;

    // 1. Log to activity logs
    this.logStudyMinutes('studyMinutes', session.durationMinutes);
    if (session.type === 'Lecture') this.logStudyMinutes('lectureMinutes', session.durationMinutes);
    else if (session.type === 'Revision') this.logStudyMinutes('revisionMinutes', session.durationMinutes);
    else if (session.type === 'Practice' || session.type === 'DPP') this.logStudyMinutes('questionSolvingMinutes', session.durationMinutes);

    // 2. Update task if taskId provided
    if (session.taskId) {
      const tasks = this.getTasks();
      const task = tasks.find((t) => t.id === session.taskId);
      if (task) {
        task.completed = true;
        task.status = 'Completed';
        task.timeSpentMinutes = (task.timeSpentMinutes || 0) + session.durationMinutes;
        this.setTasks(tasks);
      }
    }

    // 3. Update Focus Mode Plan
    const focusPlan = this.getFocusModePlan(targetExamId);
    let isSameSubject = focusPlan.subjectName.toLowerCase() === session.subject.toLowerCase();
    let newCompletedHours = focusPlan.completedStudyHours + durationHours;

    let subjectCompleted = false;
    let nextSubject: string | undefined;

    if (isSameSubject || focusPlan.mode === 'balanced') {
      focusPlan.completedStudyHours = Number(newCompletedHours.toFixed(2));
      const remaining = Math.max(0, focusPlan.requiredHours - focusPlan.completedStudyHours);

      if (remaining <= 0) {
        focusPlan.isCompleted = true;
        focusPlan.completedAt = new Date().toISOString();
        subjectCompleted = true;

        if (focusPlan.autoAdvanceNextSubject) {
          const subjects = this.getCurrentExamSubjects(targetExamId);
          const currentIdx = subjects.findIndex((s) => s.toLowerCase() === focusPlan.subjectName.toLowerCase());
          if (currentIdx !== -1 && currentIdx + 1 < subjects.length) {
            nextSubject = subjects[currentIdx + 1];
            focusPlan.subjectName = nextSubject!;
            focusPlan.subjectId = `subj-${nextSubject!.toLowerCase().replace(/\s+/g, '-')}`;
            focusPlan.completedStudyHours = 0;
            focusPlan.isCompleted = false;
          }
        }
      }
      this.saveFocusModePlan(focusPlan, targetExamId);
    }

    // 4. Save Task History entry for audit and Parent Verified Analytics
    const historyLogs = this.get<TaskHistoryRecord[]>(DB_KEYS.TASK_HISTORY, []);
    const historyEntry: TaskHistoryRecord = {
      id: `th-${Date.now()}`,
      taskId: session.taskId || `ad-hoc-${Date.now()}`,
      taskName: session.topic || session.chapter || `${session.subject} Study Session`,
      date: new Date().toISOString().split('T')[0] || '',
      subject: session.subject,
      category: session.type || 'Lecture',
      scheduledStartTime: undefined,
      scheduledEndTime: undefined,
      actualStartTime: new Date(Date.now() - session.durationMinutes * 60000).toISOString(),
      actualEndTime: new Date().toISOString(),
      completionStatus: 'Completed',
      completionPercentage: 100,
      activeStudyTimeMinutes: session.durationMinutes,
      breakTimeMinutes: 0,
      pauseCount: 0,
      productivityScore: 92,
      focusScore: 95,
      notes: session.notes,
      createdAt: new Date().toISOString(),
    };
    historyLogs.unshift(historyEntry);
    this.set(DB_KEYS.TASK_HISTORY, historyLogs);

    safeDispatch(new Event('studyos_activity_updated'));
    safeDispatch(new Event('studyos_tasks_updated'));
    safeDispatch(new Event('studyos_db_updated'));

    const finalRemaining = Math.max(0, focusPlan.requiredHours - focusPlan.completedStudyHours);
    return {
      remainingHours: Number(finalRemaining.toFixed(2)),
      subjectCompleted,
      nextSubject,
    };
  }

  // --- DAILY AVAILABILITY & QUESTIONNAIRE ---
  public getDailyAvailability(dateStr?: string, examId?: string): DailyAvailabilityRecord {
    const todayStr = dateStr || new Date().toISOString().split('T')[0] || '';
    const targetExamId = examId || this.getActiveExamId();
    const key = `${DB_KEYS.DAILY_AVAILABILITY}_${targetExamId}_${todayStr}`;

    const defaultAvail: DailyAvailabilityRecord = {
      date: todayStr,
      examId: targetExamId,
      collegeOption: 'no_college',
      morningSlot: '6-9',
      commitments: [],
      eveningMode: 'standard',
      specialPriority: 'focus_subject',
      answersSubmitted: false,
      updatedAt: new Date().toISOString(),
    };

    return this.get<DailyAvailabilityRecord>(key, defaultAvail);
  }

  public saveDailyAvailability(
    data: Partial<DailyAvailabilityRecord>,
    examId?: string
  ): DailyAvailabilityRecord {
    const targetExamId = examId || this.getActiveExamId();
    const targetDate = data.date || new Date().toISOString().split('T')[0] || '';
    const key = `${DB_KEYS.DAILY_AVAILABILITY}_${targetExamId}_${targetDate}`;
    const current = this.getDailyAvailability(targetDate, targetExamId);

    const updated: DailyAvailabilityRecord = {
      ...current,
      ...data,
      date: targetDate,
      examId: targetExamId,
      answersSubmitted: true,
      updatedAt: new Date().toISOString(),
    };

    this.set(key, updated);
    safeDispatch(
      new CustomEvent('studyos_daily_availability_updated', { detail: { availability: updated } })
    );
    safeDispatch(new Event('studyos_db_updated'));
    return updated;
  }

  // --- DETERMINISTIC AUTOMATIC DAILY SCHEDULER ---
  /**
   * Generates a fully feasible, conflict-free study schedule for the given date.
   * Respects Protected Sleep, Meals (Breakfast 9-10 AM, Dinner 9-10 PM), Leisure (6-7 PM),
   * and College Block (10 AM-1 PM, 2-6 PM, or custom).
   * Prioritizes Single-Subject Focus Mode and recovers carry-over uncompleted hours.
   */
  public generateDailySchedule(dateStr?: string, examId?: string): AutoScheduleResult {
    const targetDate = dateStr || new Date().toISOString().split('T')[0] || '';
    const targetExamId = examId || this.getActiveExamId();
    const avail = this.getDailyAvailability(targetDate, targetExamId);
    const focusPlan = this.getFocusModePlan(targetExamId);
    const subjects = this.getCurrentExamSubjects(targetExamId);
    const activeExam = this.getExams().find((e) => e.id === targetExamId);

    const preferredSessionMinutes = focusPlan.preferredSessionLengthMinutes || 60;
    const maxDailyHours = focusPlan.maxDailyStudyHours || 6;
    const maxDailyMinutes = maxDailyHours * 60;

    const slots: AutoScheduleSlot[] = [];
    const recommendations: string[] = [];

    // 1. Calculate uncompleted carry-over from yesterday
    const prevDate = new Date(new Date(targetDate).getTime() - 86400000).toISOString().split('T')[0];
    const prevTasks = this.getTasks().filter((t) => t.dueDate === prevDate);
    const uncompletedPrevTasks = prevTasks.filter((t) => !t.completed && t.status !== 'Completed');
    let carryOverMinutes = 0;
    uncompletedPrevTasks.forEach((t) => {
      carryOverMinutes += t.estimatedMinutes || 60;
    });

    if (carryOverMinutes > 0) {
      recommendations.push(
        `Carried over ${Math.round(carryOverMinutes / 60 * 10) / 10} hours of uncompleted sessions from yesterday.`
      );
    }

    // Determine target subject for today
    let primarySubject = focusPlan.subjectName || subjects[0] || 'General Studies';
    if (avail.specialPriority === 'other_subject' && avail.specialSubjectName) {
      primarySubject = avail.specialSubjectName;
    }

    // 2. Allocate Morning Slot
    if (avail.morningSlot === '6-9') {
      slots.push({
        id: `slot-morn-1-${Date.now()}`,
        title: `Deep Concept Focus: ${primarySubject} (Part 1)`,
        type: avail.specialPriority === 'revision' ? 'Revision' : 'Lecture',
        subject: primarySubject,
        startTime: '06:00',
        endTime: '07:30',
        durationMinutes: 90,
      });
      slots.push({
        id: `slot-morn-2-${Date.now()}`,
        title: `Intensive Problem Solving: ${primarySubject}`,
        type: avail.specialPriority === 'practice_test' ? 'Practice' : 'DPP',
        subject: primarySubject,
        startTime: '07:30',
        endTime: '09:00',
        durationMinutes: 90,
      });
    } else if (avail.morningSlot === '7-9') {
      slots.push({
        id: `slot-morn-1-${Date.now()}`,
        title: `Morning Focus Session: ${primarySubject}`,
        type: 'Lecture',
        subject: primarySubject,
        startTime: '07:00',
        endTime: '09:00',
        durationMinutes: 120,
      });
    }

    // 3. Protected Breakfast: 09:00 - 10:00
    slots.push({
      id: `slot-breakfast-${Date.now()}`,
      title: 'Protected Breakfast & Refreshment',
      type: 'Break',
      subject: 'Leisure',
      startTime: '09:00',
      endTime: '10:00',
      durationMinutes: 60,
      isProtected: true,
    });

    // 4. College / Midday Block
    if (avail.collegeOption === 'morning_college') {
      slots.push({
        id: `slot-college-${Date.now()}`,
        title: 'College Lectures / Labs',
        type: 'College',
        subject: 'Academic',
        startTime: '10:00',
        endTime: '13:00',
        durationMinutes: 180,
        isProtected: true,
      });
      // Free afternoon window 14:00 - 18:00
      slots.push({
        id: `slot-afternoon-${Date.now()}`,
        title: `Afternoon Study Block: ${primarySubject}`,
        type: 'Revision',
        subject: primarySubject,
        startTime: '14:30',
        endTime: '16:30',
        durationMinutes: 120,
      });
    } else if (avail.collegeOption === 'afternoon_college') {
      // Free morning window 10:00 - 13:00
      slots.push({
        id: `slot-midday-${Date.now()}`,
        title: `Midday Focus Block: ${primarySubject}`,
        type: 'Lecture',
        subject: primarySubject,
        startTime: '10:30',
        endTime: '12:30',
        durationMinutes: 120,
      });
      slots.push({
        id: `slot-college-${Date.now()}`,
        title: 'College Lectures / Labs',
        type: 'College',
        subject: 'Academic',
        startTime: '14:00',
        endTime: '18:00',
        durationMinutes: 240,
        isProtected: true,
      });
    } else if (avail.collegeOption === 'full_college') {
      slots.push({
        id: `slot-college-${Date.now()}`,
        title: 'Full Day College Schedule',
        type: 'College',
        subject: 'Academic',
        startTime: '09:00',
        endTime: '17:00',
        durationMinutes: 480,
        isProtected: true,
      });
    } else if (avail.collegeOption === 'multi_slot_college' && avail.collegeSlots && avail.collegeSlots.length > 0) {
      avail.collegeSlots.forEach((cs, idx) => {
        const startMins = cs.startTime.split(':').map(Number).reduce((acc, v, i) => i === 0 ? v * 60 : acc + v, 0);
        const endMins = cs.endTime.split(':').map(Number).reduce((acc, v, i) => i === 0 ? v * 60 : acc + v, 0);
        const dur = Math.max(30, endMins - startMins);
        slots.push({
          id: `slot-college-multi-${idx}-${Date.now()}`,
          title: cs.title || `College Lecture Period ${idx + 1}`,
          type: 'College',
          subject: 'Academic',
          startTime: cs.startTime,
          endTime: cs.endTime,
          durationMinutes: dur,
          isProtected: true,
        });
      });
    } else if (avail.collegeOption === 'custom_college') {
      const cStart = avail.customCollegeStart || '10:00';
      const cEnd = avail.customCollegeEnd || '16:00';
      slots.push({
        id: `slot-college-${Date.now()}`,
        title: 'Custom College Schedule',
        type: 'College',
        subject: 'Academic',
        startTime: cStart,
        endTime: cEnd,
        durationMinutes: 240,
        isProtected: true,
      });
    } else {
      // No College -> Extra afternoon study session
      slots.push({
        id: `slot-free-day-${Date.now()}`,
        title: `Core Afternoon Masterclass: ${primarySubject}`,
        type: 'Lecture',
        subject: primarySubject,
        startTime: '11:00',
        endTime: '13:00',
        durationMinutes: 120,
      });
      slots.push({
        id: `slot-free-afternoon-${Date.now()}`,
        title: `Targeted Problem Solving & PYQs: ${primarySubject}`,
        type: 'Practice',
        subject: primarySubject,
        startTime: '15:00',
        endTime: '17:00',
        durationMinutes: 120,
      });
    }

    // 5. Commitments
    if (avail.commitments && avail.commitments.length > 0) {
      avail.commitments.forEach((c) => {
        slots.push({
          id: `slot-comm-${c.id}`,
          title: c.title,
          type: 'Commitment',
          subject: 'Personal',
          startTime: c.startTime,
          endTime: c.endTime,
          durationMinutes: 60,
          isProtected: true,
        });
      });
    }

    // 6. Protected Evening Leisure: 18:00 - 19:00
    slots.push({
      id: `slot-leisure-${Date.now()}`,
      title: 'Protected Evening Leisure / Exercise',
      type: 'Break',
      subject: 'Leisure',
      startTime: '18:00',
      endTime: '19:00',
      durationMinutes: 60,
      isProtected: true,
    });

    // 7. Evening Study Slot 1: 19:00 - 21:00
    const eveningSubject = focusPlan.mode === 'balanced' && subjects.length > 1
      ? subjects[1] || primarySubject
      : primarySubject;

    slots.push({
      id: `slot-eve-1-${Date.now()}`,
      title: `Evening Study Slot: ${eveningSubject}`,
      type: avail.specialPriority === 'revision' ? 'Revision' : 'Practice',
      subject: eveningSubject,
      startTime: '19:00',
      endTime: '21:00',
      durationMinutes: 120,
    });

    // 8. Protected Dinner: 21:00 - 22:00
    slots.push({
      id: `slot-dinner-${Date.now()}`,
      title: 'Protected Dinner & Family Time',
      type: 'Break',
      subject: 'Leisure',
      startTime: '21:00',
      endTime: '22:00',
      durationMinutes: 60,
      isProtected: true,
    });

    // 9. Night Study Slot 2: 22:00 - 00:00 (Midnight)
    slots.push({
      id: `slot-night-2-${Date.now()}`,
      title: `Daily Wrap-up & Flashcard Active Recall: ${primarySubject}`,
      type: 'Revision',
      subject: primarySubject,
      startTime: '22:00',
      endTime: '23:30',
      durationMinutes: 90,
    });

    // Sort slots by startTime
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Calculate total planned study minutes (excluding breaks/college)
    const studySlots = slots.filter((s) => s.type !== 'Break' && s.type !== 'College' && s.type !== 'Commitment');
    const totalPlannedMinutes = studySlots.reduce((acc, s) => acc + s.durationMinutes, 0);

    // Feasibility & Conflict Calculation
    const remainingHours = Math.max(0, focusPlan.requiredHours - focusPlan.completedStudyHours);
    const targetExamDate = activeExam?.examDate || focusPlan.targetDate || '2027-02-15';
    const daysUntilTarget = Math.max(
      1,
      Math.ceil((new Date(targetExamDate).getTime() - new Date(targetDate).getTime()) / 86400000)
    );
    const maxCapacityHours = daysUntilTarget * maxDailyHours;

    let hasConflict = false;
    let conflictReason: string | undefined;

    if (remainingHours > maxCapacityHours) {
      hasConflict = true;
      conflictReason = `Schedule Conflict: You need ${remainingHours} hours for ${focusPlan.subjectName}, but only ${daysUntilTarget} days remain before your target date (${maxCapacityHours} hrs max at ${maxDailyHours} hrs/day). Consider adjusting target hours or daily study limit.`;
    }

    // Synchronize generated study sessions into Planner Tasks
    const existingTasks = this.getTasks();
    const otherDateTasks = existingTasks.filter((t) => t.dueDate !== targetDate);
    const manualTasksOnDate = existingTasks.filter((t) => t.dueDate === targetDate && (t as any).isManual);

    const generatedTaskItems: TaskItem[] = studySlots.map((s, idx) => ({
      id: `auto-task-${targetDate}-${idx}-${Date.now()}`,
      title: s.title,
      type: (s.type === 'Lecture' || s.type === 'Revision' || s.type === 'Practice' || s.type === 'DPP' ? s.type : 'Custom') as TaskItem['type'],
      subject: s.subject,
      dueDate: targetDate,
      timeSlot: s.startTime < '12:00' ? 'Morning' : s.startTime < '17:00' ? 'Afternoon' : s.startTime < '21:00' ? 'Evening' : 'Night',
      priority: 'High',
      completed: false,
      status: 'Pending',
      estimatedMinutes: s.durationMinutes,
      startTime: s.startTime,
      endTime: s.endTime,
      examId: targetExamId,
    }));

    this.setTasks([...otherDateTasks, ...manualTasksOnDate, ...generatedTaskItems]);

    return {
      date: targetDate,
      examId: targetExamId,
      totalPlannedMinutes,
      slots,
      hasConflict,
      conflictReason,
      recommendations,
    };
  }

  // --- TASKS ---
  public getTasks(examId?: string): TaskItem[] {
    const accId = authService.getCurrentAccountId();
    const targetExamId = examId || this.getActiveExamId();
    const fullKey = `studyos_acc_${accId}_exam_${targetExamId}_${DB_KEYS.TASKS}`;
    let rawTasks: TaskItem[] = [];
    if (this.memoryCache.has(fullKey)) {
      rawTasks = (this.memoryCache.get(fullKey) as TaskItem[]) || [];
    } else if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(fullKey);
      if (data) {
        try {
          rawTasks = JSON.parse(data) as TaskItem[];
          this.memoryCache.set(fullKey, rawTasks);
        } catch {
          rawTasks = [];
        }
      }
    }
    if (rawTasks.length === 0) {
      const def = getExamDefinition(targetExamId);
      if (def && def.plannerDefaults && def.plannerDefaults.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        rawTasks = def.plannerDefaults.map((t, idx) => ({
          ...t,
          id: `${targetExamId.toLowerCase()}-task-init-${idx + 1}`,
          dueDate: today,
          examId: targetExamId,
        }));
        this.memoryCache.set(fullKey, rawTasks);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(fullKey, JSON.stringify(rawTasks));
        }
      }
    }
    if (!Array.isArray(rawTasks)) return [];
    return rawTasks.map((t) => ({
      ...t,
      examId: t.examId || targetExamId,
    }));
  }

  public setTasks(tasks: TaskItem[]): void {
    const activeExamId = this.getActiveExamId();
    const scopedTasks = (Array.isArray(tasks) ? tasks : []).map((t) => ({
      ...t,
      examId: t.examId || activeExamId,
    }));
    this.set(DB_KEYS.TASKS, scopedTasks);
    safeDispatch(new Event('studyos_tasks_updated'));
    safeDispatch(new Event('studyos_timetable_updated'));
    safeDispatch(new Event('storage'));
  }

  public addTask(task: TaskItem): void {
    const activeExamId = this.getActiveExamId();
    const scopedTask: TaskItem = { ...task, examId: task.examId || activeExamId };
    const tasks = this.getTasks();
    tasks.unshift(scopedTask);
    this.setTasks(tasks);
  }

  public updateTask(updatedTask: TaskItem): void {
    const activeExamId = this.getActiveExamId();
    const scopedTask: TaskItem = { ...updatedTask, examId: updatedTask.examId || activeExamId };
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === scopedTask.id);
    if (idx !== -1) {
      tasks[idx] = scopedTask;
      this.setTasks(tasks);
    }
  }

  public toggleTaskCompletion(taskId: string): void {
    const tasks = this.getTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      task.status = task.completed ? 'Completed' : 'Pending';
      task.completedAt = task.completed ? new Date().toISOString() : undefined;
      this.setTasks(tasks);
    }
  }

  public deleteTask(taskId: string): void {
    const tasks = this.getTasks().filter((t) => t.id !== taskId);
    this.setTasks(tasks);
  }

  // --- TASK HISTORY DATABASE ---
  public getTaskHistory(): TaskHistoryRecord[] {
    return this.get<TaskHistoryRecord[]>(DB_KEYS.TASK_HISTORY, []);
  }

  public setTaskHistory(history: TaskHistoryRecord[]): void {
    this.set(DB_KEYS.TASK_HISTORY, history);
    safeDispatch(new Event('studyos_task_history_updated'));
    safeDispatch(new Event('storage'));
  }

  public addTaskHistoryRecord(record: TaskHistoryRecord): void {
    const history = this.getTaskHistory();
    const idx = history.findIndex((h) => h.id === record.id);
    if (idx !== -1) {
      history[idx] = record;
    } else {
      history.unshift(record);
    }
    this.setTaskHistory(history);
  }

  // --- FLASHCARDS ---
  public getFlashcards(): Flashcard[] {
    return this.get<Flashcard[]>(DB_KEYS.FLASHCARDS, []);
  }

  public setFlashcards(cards: Flashcard[]): void {
    this.set(DB_KEYS.FLASHCARDS, cards);
  }

  public addFlashcard(card: Flashcard): void {
    const cards = this.getFlashcards();
    cards.unshift(card);
    this.setFlashcards(cards);
  }

  public updateFlashcard(updated: Flashcard): void {
    const cards = this.getFlashcards();
    const idx = cards.findIndex((c) => c.id === updated.id);
    if (idx !== -1) {
      cards[idx] = updated;
      this.setFlashcards(cards);
    }
  }

  // --- PDFS ---
  public getPDFs(): PDFDocumentItem[] {
    return this.get<PDFDocumentItem[]>(DB_KEYS.PDFS, []);
  }

  public setPDFs(pdfs: PDFDocumentItem[]): void {
    this.set(DB_KEYS.PDFS, pdfs);
  }

  public addPDF(pdf: PDFDocumentItem): void {
    const pdfs = this.getPDFs();
    pdfs.unshift(pdf);
    this.setPDFs(pdfs);
  }

  // --- PDF CAPTURES (SNIPPETS, HIGHLIGHTS, BOOKMARKS, ANNOTATIONS) ---
  public getPDFCaptures(): PDFCaptureItem[] {
    return this.get<PDFCaptureItem[]>(DB_KEYS.PDF_CAPTURES, []);
  }

  public setPDFCaptures(captures: PDFCaptureItem[]): void {
    this.set(DB_KEYS.PDF_CAPTURES, captures);
    safeDispatch(new Event('studyos_pdf_captures_updated'));
  }

  public addPDFCapture(capture: PDFCaptureItem): void {
    const captures = this.getPDFCaptures();
    captures.unshift(capture);
    this.setPDFCaptures(captures);
  }

  public deletePDFCapture(id: string): void {
    const captures = this.getPDFCaptures().filter((c) => c.id !== id);
    this.setPDFCaptures(captures);
  }

  // --- BROWSER VISITS ---
  public getBrowserLogs(): BrowserVisitLog[] {
    return this.get<BrowserVisitLog[]>(DB_KEYS.BROWSER_LOGS, []);
  }

  public addBrowserLog(log: BrowserVisitLog): void {
    const logs = this.getBrowserLogs();
    logs.unshift(log);
    // Keep max 200 logs
    if (logs.length > 200) logs.pop();
    this.set(DB_KEYS.BROWSER_LOGS, logs);
  }

  // --- BOOKMARKS ---
  public getBookmarks(): BookmarkItem[] {
    return this.get<BookmarkItem[]>(DB_KEYS.BOOKMARKS, []);
  }

  public setBookmarks(bookmarks: BookmarkItem[]): void {
    this.set(DB_KEYS.BOOKMARKS, bookmarks);
  }

  public addBookmark(item: BookmarkItem): void {
    const bookmarks = this.getBookmarks();
    if (!bookmarks.some((b) => b.url === item.url)) {
      bookmarks.unshift(item);
      this.setBookmarks(bookmarks);
    }
  }

  public deleteBookmark(idOrUrl: string): void {
    const bookmarks = this.getBookmarks().filter((b) => b.id !== idOrUrl && b.url !== idOrUrl);
    this.setBookmarks(bookmarks);
  }

  // --- MOCK TESTS ---
  public getMockTests(): MockTestRecord[] {
    const tests = this.get<MockTestRecord[]>(DB_KEYS.MOCK_TESTS, []);
    return Array.isArray(tests) ? tests : [];
  }

  public setMockTests(tests: MockTestRecord[]): void {
    this.set(DB_KEYS.MOCK_TESTS, tests);
  }

  public addMockTest(test: MockTestRecord): void {
    const tests = this.getMockTests();
    tests.unshift(test);
    this.setMockTests(tests);
  }

  // --- MCQS & PYQS ---
  public getMCQs(): QuestionMCQ[] {
    const mcqs = this.get<QuestionMCQ[]>(DB_KEYS.MCQS, []);
    return Array.isArray(mcqs) ? mcqs : [];
  }

  public setMCQs(mcqs: QuestionMCQ[]): void {
    this.set(DB_KEYS.MCQS, mcqs);
  }

  public addMCQ(mcq: QuestionMCQ): void {
    const mcqs = this.getMCQs();
    mcqs.unshift(mcq);
    this.setMCQs(mcqs);
  }

  public updateMCQ(updated: QuestionMCQ): void {
    const mcqs = this.getMCQs();
    const idx = mcqs.findIndex((m) => m.id === updated.id);
    if (idx !== -1) {
      mcqs[idx] = updated;
      this.setMCQs(mcqs);
    }
  }

  public deleteMCQ(id: string): void {
    const mcqs = this.getMCQs().filter((m) => m.id !== id);
    this.setMCQs(mcqs);
  }

  // --- MISTAKE NOTEBOOK ---
  public getMistakes(): MistakeEntry[] {
    const mistakes = this.get<MistakeEntry[]>(DB_KEYS.MISTAKES, []);
    return Array.isArray(mistakes) ? mistakes : [];
  }

  public setMistakes(mistakes: MistakeEntry[]): void {
    this.set(DB_KEYS.MISTAKES, mistakes);
  }

  public addMistake(mistake: MistakeEntry): void {
    const mistakes = this.getMistakes();
    mistakes.unshift(mistake);
    this.setMistakes(mistakes);
  }

  public updateMistake(updated: MistakeEntry): void {
    const mistakes = this.getMistakes();
    const idx = mistakes.findIndex((m) => m.id === updated.id);
    if (idx !== -1) {
      mistakes[idx] = updated;
      this.setMistakes(mistakes);
    }
  }

  public deleteMistake(id: string): void {
    const mistakes = this.getMistakes().filter((m) => m.id !== id);
    this.setMistakes(mistakes);
  }

  // --- CUSTOM TEST SERIES ---
  public getTestSeries(): GeneratedTestSeries[] {
    return this.get<GeneratedTestSeries[]>(DB_KEYS.TEST_SERIES, []);
  }

  public setTestSeries(series: GeneratedTestSeries[]): void {
    this.set(DB_KEYS.TEST_SERIES, series);
    safeDispatch(new Event('studyos_test_series_updated'));
    safeDispatch(new Event('studyos_db_updated'));
  }

  public addTestSeries(series: GeneratedTestSeries): void {
    const all = this.getTestSeries();
    all.unshift(series);
    this.setTestSeries(all);
  }

  public updateTestSeries(updated: GeneratedTestSeries): void {
    const all = this.getTestSeries();
    const idx = all.findIndex((s) => s.id === updated.id);
    if (idx !== -1) {
      all[idx] = updated;
      this.setTestSeries(all);
    }
  }

  public deleteTestSeries(id: string): void {
    const all = this.getTestSeries().filter((s) => s.id !== id);
    this.setTestSeries(all);
  }

  // --- TIME SLOT CONFLICT DETECTOR ---
  public checkSlotConflicts(
    date: string,
    startTime: string,
    endTime: string,
    excludeTaskId?: string
  ): { hasConflict: boolean; conflictingTasks: TaskItem[] } {
    if (!date || !startTime || !endTime) {
      return { hasConflict: false, conflictingTasks: [] };
    }

    const parseToMinutes = (timeStr: string): number => {
      const parts = timeStr.split(':');
      if (parts.length < 2) return 0;
      const h = parseInt(parts[0] || '0', 10);
      const m = parseInt(parts[1] || '0', 10);
      return h * 60 + m;
    };

    const targetStart = parseToMinutes(startTime);
    const targetEnd = parseToMinutes(endTime);

    if (targetEnd <= targetStart) {
      return { hasConflict: false, conflictingTasks: [] };
    }

    const tasksOnDate = this.getTasks().filter(
      (t) => t.dueDate === date && t.id !== excludeTaskId && t.startTime && t.endTime
    );

    const conflicts: TaskItem[] = [];

    for (const t of tasksOnDate) {
      const tStart = parseToMinutes(t.startTime!);
      const tEnd = parseToMinutes(t.endTime!);

      if (tEnd <= tStart) continue;

      // Overlap condition: max(start1, start2) < min(end1, end2)
      const maxStart = Math.max(targetStart, tStart);
      const minEnd = Math.min(targetEnd, tEnd);

      if (maxStart < minEnd) {
        conflicts.push(t);
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflictingTasks: conflicts,
    };
  }

  // --- ACTIVITY LOGS ---
  public getActivityLogs(): StudyActivityLog[] {
    return this.get<StudyActivityLog[]>(DB_KEYS.ACTIVITY_LOGS, []);
  }

  public setActivityLogs(logs: StudyActivityLog[]): void {
    this.set(DB_KEYS.ACTIVITY_LOGS, logs);
  }

  public logStudyMinutes(category: keyof StudyActivityLog, minutes: number): void {
    const logs = this.getActivityLogs();
    const todayStr = new Date().toISOString().split('T')[0] || '';
    let todayLog = logs.find((l) => l.date === todayStr);

    if (!todayLog) {
      todayLog = {
        date: todayStr,
        studyMinutes: 0,
        idleMinutes: 0,
        breakMinutes: 0,
        lectureMinutes: 0,
        questionSolvingMinutes: 0,
        revisionMinutes: 0,
        flashcardsMinutes: 0,
        pdfReadingMinutes: 0,
        browserMinutes: 0,
        productivityScore: 85,
      };
      logs.unshift(todayLog);
    }

    const logItem = todayLog;
    if (category in logItem && typeof logItem[category] === 'number') {
      (logItem[category] as number) += minutes;
    }
    logItem.studyMinutes =
      logItem.lectureMinutes +
      logItem.questionSolvingMinutes +
      logItem.revisionMinutes +
      logItem.flashcardsMinutes +
      logItem.pdfReadingMinutes;

    this.setActivityLogs(logs);
  }

  // --- BREAK GAME STATS ---
  public getBreakGameStats(): BreakGameStats {
    return this.get<BreakGameStats>(DB_KEYS.BREAK_GAME_STATS, {
      gamesPlayed: 0,
      gamesWon: 0,
      totalBreakGameTimeSecs: 0,
      highScores: {},
      fastestCompletionSecs: {},
      favoriteGame: '2048',
    });
  }

  public setBreakGameStats(stats: BreakGameStats): void {
    this.set(DB_KEYS.BREAK_GAME_STATS, stats);
  }

  public recordGameResult(
    gameId: string,
    score: number,
    won: boolean,
    timeTakenSecs: number
  ): { isHighScore: boolean; isFastest: boolean } {
    const stats = this.getBreakGameStats();
    stats.gamesPlayed += 1;
    if (won) stats.gamesWon += 1;
    stats.totalBreakGameTimeSecs += timeTakenSecs;

    let isHighScore = false;
    let isFastest = false;

    const currentHigh = stats.highScores[gameId] ?? 0;
    if (score > currentHigh) {
      stats.highScores[gameId] = score;
      isHighScore = true;
    }

    const currentFastest = stats.fastestCompletionSecs[gameId];
    if (won && (currentFastest === undefined || timeTakenSecs < currentFastest)) {
      stats.fastestCompletionSecs[gameId] = timeTakenSecs;
      isFastest = true;
    }

    stats.favoriteGame = gameId;
    this.setBreakGameStats(stats);
    return { isHighScore, isFastest };
  }

  // --- MULTI-EXAM & ACTIVE WORKSPACE MANAGEMENT ---
  public getActiveExamId(): string {
    if (typeof window === 'undefined') return 'GATE2027';
    let id = localStorage.getItem('studyos_active_exam_id');
    if (!id || id === 'exam-gate-2027') {
      id = 'GATE2027';
      localStorage.setItem('studyos_active_exam_id', 'GATE2027');
    }
    return id;
  }

  public setActiveExamId(id: string): void {
    const normId = id === 'exam-gate-2027' ? 'GATE2027' : id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('studyos_active_exam_id', normId);
      safeDispatch(new Event('studyos_active_exam_changed'));
      safeDispatch(new Event('studyos_exams_updated'));
      safeDispatch(new Event('studyos_tasks_updated'));
      safeDispatch(new Event('studyos_lectures_updated'));
      safeDispatch(new Event('studyos_lecture_plans_updated'));
      safeDispatch(new Event('studyos_syllabus_updated'));
      safeDispatch(new Event('studyos_timetable_updated'));
      safeDispatch(new Event('studyos_analytics_updated'));
      safeDispatch(new Event('studyos_activity_updated'));
      safeDispatch(new Event('studyos_db_updated'));
      safeDispatch(new Event('storage'));
    }
  }

  public getActiveExam(): ExamItem | null {
    const activeId = this.getActiveExamId();
    const exams = this.getExams();
    return exams.find((e) => e.id === activeId) || exams[0] || null;
  }

  public getExams(): ExamItem[] {
    const exams = this.get<ExamItem[] | null>(DB_KEYS.EXAMS, null as any);
    const seed = getSeedExams();
    // null = never initialized → seed once; [] = user cleared all exams
    if (exams === null || exams === undefined) {
      this.setSilent(DB_KEYS.EXAMS, seed);
      return [...seed];
    }
    if (!Array.isArray(exams)) return [];

    let modified = false;
    const enriched = exams.map((ex) => {
      const seedMatch = seed.find(
        (s) =>
          s.id.toUpperCase() === ex.id.toUpperCase() ||
          (ex.code && s.code.toUpperCase() === ex.code.toUpperCase()) ||
          s.title.toLowerCase() === ex.title.toLowerCase()
      );
      if (!ex.subjects || ex.subjects.length === 0) {
        if (seedMatch && seedMatch.subjects && seedMatch.subjects.length > 0) {
          modified = true;
          return {
            ...ex,
            subjects: seedMatch.subjects,
            readinessPercent: ex.readinessPercent || seedMatch.readinessPercent,
            targetDailyHours: ex.targetDailyHours || seedMatch.targetDailyHours,
          };
        }
      } else if (seedMatch && seedMatch.id !== 'GATE2027' && ex.id !== 'GATE2027') {
        // If non-GATE exam accidentally contains GATE subjects (e.g. Operating Systems), replace with its seed subjects
        const hasGateSubject = ex.subjects.some((s: any) => {
          const n = (typeof s === 'string' ? s : s?.name || '').toLowerCase();
          return (
            n === 'operating systems' ||
            n === 'discrete mathematics' ||
            n === 'compiler design' ||
            n === 'databases (dbms)'
          );
        });
        if (hasGateSubject && seedMatch.subjects && seedMatch.subjects.length > 0) {
          modified = true;
          return {
            ...ex,
            subjects: seedMatch.subjects,
          };
        }
      }
      return ex;
    });

    seed.forEach((s) => {
      if (!enriched.some((e) => e.id === s.id || e.code === s.code)) {
        enriched.push(s);
        modified = true;
      }
    });

    if (modified) {
      this.setSilent(DB_KEYS.EXAMS, enriched);
    }
    return enriched;
  }

  public setExams(exams: ExamItem[]): void {
    this.set(DB_KEYS.EXAMS, Array.isArray(exams) ? exams : []);
    safeDispatch(new Event('studyos_exams_updated'));
    safeDispatch(new Event('storage'));
    safeDispatch(new Event('studyos_db_updated'));
  }

  public addExam(exam: ExamItem): void {
    const exams = this.getExams();
    exams.unshift(exam);
    this.setExams(exams);
  }

  public updateExam(updated: ExamItem): void {
    const exams = this.getExams();
    const idx = exams.findIndex((e) => e.id === updated.id);
    if (idx !== -1) {
      exams[idx] = updated;
      this.setExams(exams);
    }
  }

  public archiveExam(id: string): void {
    const exams = this.getExams();
    const exam = exams.find((e) => e.id === id);
    if (exam) {
      exam.status = 'Archived';
      exam.updatedDate = new Date().toISOString().split('T')[0] || '';
      this.setExams(exams);
    }
  }

  public duplicateExam(id: string): ExamItem | null {
    const exams = this.getExams();
    const source = exams.find((e) => e.id === id);
    if (!source) return null;

    const newExamId = `exam-copy-${Date.now()}`;
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const copy: ExamItem = {
      ...JSON.parse(JSON.stringify(source)),
      id: newExamId,
      title: `${source.title} (Copy)`,
      code: `${source.code}-COPY`,
      createdDate: todayStr,
      updatedDate: todayStr,
    };

    exams.unshift(copy);
    this.setExams(exams);

    // Duplicate resources belonging to this exam
    const resources = this.getResources().filter((r) => r.examId === id);
    resources.forEach((r) => {
      this.addResource({
        ...r,
        id: `res-copy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        examId: newExamId,
        title: `${r.title} (Copy)`,
      });
    });

    safeDispatch(new Event('studyos_exams_updated'));

    return copy;
  }

  public restoreExam(id: string): void {
    const exams = this.getExams();
    const exam = exams.find((e) => e.id === id);
    if (exam) {
      exam.status = 'Active';
      exam.updatedDate = new Date().toISOString().split('T')[0] || '';
      this.setExams(exams);
    }
  }

  public deleteExam(id: string): void {
    try {
      const accId = authService.getCurrentAccountId();
      const prefix = `studyos_acc_${accId}_exam_${id}_`;

      // Snapshot remaining exams first
      const remaining = this.getExams().filter((e) => e.id !== id);

      // Switch active exam BEFORE any exam-scoped writes so we don't rewrite deleted keys
      const wasActive = this.getActiveExamId() === id;
      if (wasActive) {
        const nextExam = remaining.find((e) => e.status === 'Active') || remaining[0];
        if (nextExam) {
          this.setActiveExamId(nextExam.id);
        } else {
          const defaultExam: ExamItem = {
            id: 'exam-default-' + Date.now(),
            title: 'General Competitive Exam',
            code: 'GENERAL-EXAM',
            category: 'Custom',
            priority: 'High',
            targetScore: '80/100',
            examDate: '2027-02-15',
            color: 'purple',
            status: 'Active',
            subjects: [],
            readinessPercent: 0,
            targetDailyHours: 4.0,
            createdDate: new Date().toISOString().split('T')[0] || '',
            updatedDate: new Date().toISOString().split('T')[0] || '',
          };
          remaining.push(defaultExam);
          this.setActiveExamId(defaultExam.id);
        }
      }

      // Persist exam list without the deleted exam
      this.setExams(remaining);

      // Purge all keys for this exam only
      try {
        for (const fullKey of Array.from(this.memoryCache.keys())) {
          if (fullKey.startsWith(prefix)) {
            this.memoryCache.delete(fullKey);
            this.pendingWrites.delete(fullKey);
          }
        }
      } catch { /* ignore */ }

      if (typeof localStorage !== 'undefined') {
        try {
          const lsKeys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) lsKeys.push(k);
          }
          for (const k of lsKeys) {
            try { localStorage.removeItem(k); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }

      if (this.idb) {
        try {
          const tx = this.idb.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          const req = store.openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              const key = String(cursor.key);
              if (key.startsWith(prefix)) cursor.delete();
              cursor.continue();
            }
          };
        } catch { /* ignore */ }
      }

      // Best-effort strip of account-layer items tagged with examId
      // (active exam already switched, so scoped sets target the new workspace)
      try {
        const strip = <T extends { examId?: string }>(items: T[]) =>
          (Array.isArray(items) ? items : []).filter((x) => x.examId !== id);
        try { this.setTasks(strip(this.getTasks() as any) as any); } catch { /* ignore */ }
        try { this.setFlashcards(strip(this.getFlashcards() as any) as any); } catch { /* ignore */ }
        try { this.setPDFs(strip(this.getPDFs() as any) as any); } catch { /* ignore */ }
        try { this.setPDFCaptures(strip(this.getPDFCaptures() as any) as any); } catch { /* ignore */ }
        try { this.setMockTests(strip(this.getMockTests() as any) as any); } catch { /* ignore */ }
        try { this.setResources(strip(this.getResources() as any) as any); } catch { /* ignore */ }
        try { this.setLectures(strip(this.getLectures() as any) as any); } catch { /* ignore */ }
        try { this.set(DB_KEYS.MCQS, strip(this.getMCQs() as any)); } catch { /* ignore */ }
        try { this.set(DB_KEYS.MISTAKES, strip(this.getMistakes() as any)); } catch { /* ignore */ }
        try { this.setScratchpadNotes(strip(this.getScratchpadNotes() as any) as any); } catch { /* ignore */ }
      } catch { /* ignore */ }

      safeDispatch(new Event('studyos_exams_updated'));
      safeDispatch(new Event('studyos_active_exam_changed'));
      safeDispatch(new Event('studyos_db_updated'));

      void this.flushNow();
    } catch (err) {
      console.error('[StudyOS] deleteExam failed', err);
      throw err;
    }
  }


  // --- HIERARCHICAL RESOURCE LIBRARY ---
  public getResources(): ResourceItem[] {
    const resources = this.get<ResourceItem[]>(DB_KEYS.RESOURCES, []);
    if (!resources || resources.length === 0) {
      return SEED_RESOURCES;
    }
    return resources;
  }

  public setResources(resources: ResourceItem[]): void {
    this.set(DB_KEYS.RESOURCES, resources);
    safeDispatch(new Event('studyos_resources_updated'));
    safeDispatch(new Event('storage'));
  }

  public addResource(resource: ResourceItem): void {
    const resources = this.getResources();
    resources.unshift(resource);
    this.setResources(resources);
  }

  public updateResource(updated: ResourceItem): void {
    const resources = this.getResources();
    const idx = resources.findIndex((r) => r.id === updated.id);
    if (idx !== -1) {
      resources[idx] = updated;
      this.setResources(resources);
    }
  }

  public deleteResource(id: string): void {
    const filtered = this.getResources().filter((r) => r.id !== id);
    this.setResources(filtered);
  }

  public toggleFavoriteResource(id: string): void {
    const resources = this.getResources();
    const target = resources.find((r) => r.id === id);
    if (target) {
      target.isFavorite = !target.isFavorite;
      this.setResources(resources);
    }
  }

  // --- PROJECTS WORKSPACE METHODS ---
  public getProjects(): ProjectItem[] {
    const projects = this.get<ProjectItem[]>(DB_KEYS.PROJECTS, []);
    if (!projects || projects.length === 0) {
      return SEED_PROJECTS;
    }
    return projects;
  }

  public setProjects(projects: ProjectItem[]): void {
    this.set(DB_KEYS.PROJECTS, projects);
    safeDispatch(new Event('studyos_projects_updated'));
    safeDispatch(new Event('storage'));
  }

  public addProject(project: ProjectItem): void {
    const projects = this.getProjects();
    projects.unshift(project);
    this.setProjects(projects);
  }

  public updateProject(updated: ProjectItem): void {
    const projects = this.getProjects();
    const idx = projects.findIndex((p) => p.id === updated.id);
    if (idx !== -1) {
      projects[idx] = updated;
      this.setProjects(projects);
    }
  }

  public deleteProject(id: string): void {
    const filtered = this.getProjects().filter((p) => p.id !== id);
    this.setProjects(filtered);
  }

  // --- BACKUP & RESTORE ---

  /** Completely replace lecture tracker dataset with imported JSON records (no merge). */
  public importLecturesReplace(raw: unknown): { count: number } {
    let list: any[] = [];
    if (Array.isArray(raw)) list = raw;
    else if (raw && typeof raw === 'object' && Array.isArray((raw as any).lectures)) list = (raw as any).lectures;
    else if (raw && typeof raw === 'object' && Array.isArray((raw as any).data)) list = (raw as any).data;
    else throw new Error('Invalid lecture JSON: expected an array of lectures');

    // Wipe previous lecture records first so nothing from prior imports remains
    this.setLectures([]);

    const normalized: PWLectureRecord[] = list.map((item, i) => ({
      id: String(item.id || `lec-import-${Date.now()}-${i}`),
      subject: String(item.subject || item.Subject || 'General'),
      chapter: String(item.chapter || item.Chapter || item.title || `Lecture ${i + 1}`),
      lectureNumber: Number(item.lectureNumber || item.lecture_number || i + 1) || (i + 1),
      originalDate: String(item.originalDate || item.date || ''),
      reanchoredDate: String(item.reanchoredDate || item.originalDate || item.date || ''),
      durationMinutes: Number(item.durationMinutes || item.duration || 60) || 60,
      timeSpentMinutes: Number(item.timeSpentMinutes || item.timeSpent || 0) || 0,
      dppCompleted: Boolean(item.dppCompleted),
      dpp: String(item.dpp || ''),
      weeklyTest: String(item.weeklyTest || ''),
      status: (item.status as PWLectureRecord['status']) || 'Pending',
      watchSpeed: Number(item.watchSpeed || 1) || 1,
      notes: String(item.notes || ''),
      bookmarkTimestamp: String(item.bookmarkTimestamp || ''),
      revisionCount: Number(item.revisionCount || 0) || 0,
      confidence: Number(item.confidence || 3) || 3,
      mistakesLogged: String(item.mistakesLogged || ''),
      examId: (item as any).examId || this.getActiveExamId(),
    }));

    this.setLectures(normalized);
    // Rebuild syllabus progress exclusively from this import (reset then apply)
    this.syncSyllabusFromLectures(true);
    safeDispatch(new Event('studyos_lectures_updated'));
    safeDispatch(new Event('studyos_lecture_plans_updated'));
    safeDispatch(new Event('studyos_db_updated'));
    return { count: normalized.length };
  }

  /**
   * Full replacement of the Lecture Planner (subject/chapter plans) dataset.
   * Deletes old planner storage, clears related lecture progress, and syncs syllabus
   * exclusively from the imported JSON (no leftover progress from prior imports).
   */
  public importLecturePlansReplace(raw: unknown): {
    subjectCount: number;
    chapterCount: number;
    plans: Array<{
      id: string;
      name: string;
      targetCompletionDate?: string;
      chapters: Array<{
        id: string;
        name: string;
        lecturesCount: number;
        dppCount: number;
        dppType: 'DPP' | 'CPP' | 'PYQ';
        lecturesCompleted: number;
        dppsCompleted: number;
      }>;
    }>;
  } {
    // Unwrap wrappers if caller passed a root object
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as any;
      if (Array.isArray(obj.subjects)) raw = obj.subjects;
      else if (Array.isArray(obj.plans)) raw = obj.plans;
      else if (Array.isArray(obj.data)) raw = obj.data;
      else if (Array.isArray(obj.lecturePlans)) raw = obj.lecturePlans;
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('Invalid lecture plan JSON: expected a non-empty array of subjects');
    }

    const normalized = (raw as any[]).map((subj: any, si: number) => {
      const chapters = Array.isArray(subj?.chapters) ? subj.chapters : [];
      return {
        id: String(subj?.id || `sub-import-${Date.now()}-${si}`),
        name: String(subj?.name || `Subject ${si + 1}`),
        targetCompletionDate: subj?.targetCompletionDate
          ? String(subj.targetCompletionDate)
          : undefined,
        chapters: chapters.map((ch: any, ci: number) => {
          const lecturesCount = Math.max(0, Number(ch?.lecturesCount) || 0);
          const dppCount = Math.max(0, Number(ch?.dppCount) || 0);
          const lecturesCompleted = Math.min(
            lecturesCount,
            Math.max(0, Number(ch?.lecturesCompleted) || 0)
          );
          const dppsCompleted = Math.min(
            dppCount,
            Math.max(0, Number(ch?.dppsCompleted) || 0)
          );
          return {
            id: String(ch?.id || `ch-import-${Date.now()}-${si}-${ci}`),
            name: String(ch?.name || `Chapter ${ci + 1}`),
            lecturesCount,
            dppCount,
            dppType: (ch?.dppType as 'DPP' | 'CPP' | 'PYQ') || 'DPP',
            lecturesCompleted,
            dppsCompleted,
          };
        }),
      };
    });

    const targetExamId = this.getActiveExamId();
    this.setLecturePlans(normalized, targetExamId);

    this.setLectures([]);
    this.syncSyllabusFromLecturePlans(normalized);

    // Notify every dependent module: Syllabus, Dashboard, Progress, Analytics, Revision, Exams
    for (const ev of [
      'studyos_lecture_plans_updated',
      'studyos_lectures_updated',
      'studyos_syllabus_updated',
      'studyos_db_updated',
      'studyos_tasks_updated',
      'studyos_exams_updated',
      'studyos_activity_updated',
      'storage',
    ]) {
      safeDispatch(new Event(ev));
    }

    const chapterCount = normalized.reduce((n, s) => n + s.chapters.length, 0);
    return { subjectCount: normalized.length, chapterCount, plans: normalized };
  }

  public syncSyllabusFromLecturePlans(plans: Array<{ name: string; chapters: Array<{ name: string; lecturesCount: number; lecturesCompleted: number }> }>): void {
    try {
      const syllabus = this.getSyllabus();
      if (!Array.isArray(syllabus) || syllabus.length === 0) return;

      const planBySubject = new Map<string, typeof plans[0]>();
      for (const p of plans) {
        planBySubject.set((p.name || '').toLowerCase().trim(), p);
      }

      const next = syllabus.map((subj: any) => {
        const plan = planBySubject.get((subj.name || '').toLowerCase().trim());
        if (!plan) return subj;

        const chapterByName = new Map(
          plan.chapters.map((c) => [(c.name || '').toLowerCase().trim(), c])
        );

        const topics = (subj.topics || []).map((topic: any) => {
          const ch =
            chapterByName.get((topic.name || '').toLowerCase().trim()) ||
            plan.chapters.find(
              (c) =>
                (c.name || '').toLowerCase().includes((topic.name || '').toLowerCase()) ||
                (topic.name || '').toLowerCase().includes((c.name || '').toLowerCase())
            );

          if (!ch) {
            return {
              ...topic,
              status: 'Not Started',
              completedHours: 0,
              questionsSolved: 0,
            };
          }

          const total = ch.lecturesCount || 0;
          const done = ch.lecturesCompleted || 0;
          let status: string = 'Not Started';
          if (total > 0 && done >= total) status = 'Completed';
          else if (done > 0) status = 'In Progress';

          return {
            ...topic,
            status,
            completedHours: status === 'Completed' ? 12 : status === 'In Progress' ? 6 : 0,
            questionsSolved: status === 'Completed' ? 20 : 0,
          };
        });
        return { ...subj, topics };
      });

      this.setSyllabus(next);
      safeDispatch(new Event('studyos_syllabus_updated'));
    } catch {
      /* best-effort */
    }
  }

  /**
   * Map lecture completion → syllabus topic progress for matching subjects/chapters.
   * When resetUnmatched is true, topics with no matching lecture are forced to Not Started
   * so prior import progress cannot linger.
   */
  public syncSyllabusFromLectures(resetUnmatched: boolean = false): void {
    try {
      const lectures = this.getLectures();
      const syllabus = this.getSyllabus();
      if (!Array.isArray(syllabus) || syllabus.length === 0) return;

      const bySubjectChapter = new Map<string, string>();
      for (const lec of lectures) {
        const key = `${(lec.subject || '').toLowerCase()}::${(lec.chapter || '').toLowerCase()}`;
        const prev = bySubjectChapter.get(key);
        if (prev === 'Completed' || prev === 'Rewatched') continue;
        bySubjectChapter.set(key, lec.status);
      }

      let changed = false;
      const next = syllabus.map((subj: any) => {
        const topics = (subj.topics || []).map((topic: any) => {
          const key = `${(subj.name || '').toLowerCase()}::${(topic.name || '').toLowerCase()}`;
          const lecStatus = bySubjectChapter.get(key);
          if (!lecStatus) {
            if (resetUnmatched && topic.status !== 'Not Started') {
              changed = true;
              return {
                ...topic,
                status: 'Not Started',
                completedHours: 0,
                questionsSolved: 0,
              };
            }
            return topic;
          }
          let status = topic.status;
          if (lecStatus === 'Completed' || lecStatus === 'Rewatched') status = 'Completed';
          else if (lecStatus === 'In Progress') status = 'In Progress';
          else if (resetUnmatched) status = 'Not Started';

          if (status !== topic.status) {
            changed = true;
            return {
              ...topic,
              status,
              completedHours: status === 'Completed' ? 12 : status === 'In Progress' ? 6 : 0,
              questionsSolved: status === 'Completed' ? 20 : 0,
            };
          }
          return topic;
        });
        return { ...subj, topics };
      });
      if (changed) {
        this.setSyllabus(next);
        safeDispatch(new Event('studyos_syllabus_updated'));
      }
    } catch {
      /* best-effort */
    }
  }

  public exportDatabaseJSON(): string {
    const dump = {
      settings: this.getSettings(),
      exams: this.getExams(),
      resources: this.getResources(),
      lectures: this.getLectures(),
      syllabus: this.getSyllabus(),
      tasks: this.getTasks(),
      flashcards: this.getFlashcards(),
      pdfs: this.getPDFs(),
      browserLogs: this.getBrowserLogs(),
      mockTests: this.getMockTests(),
      activityLogs: this.getActivityLogs(),
      scratchpadNotes: this.getScratchpadNotes(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(dump, null, 2);
  }

  public importDatabaseJSON(jsonStr: string): boolean {
    try {
      const result = validateBackupJSON(jsonStr);
      if (!result.ok || !result.data) {
        console.error('Backup validation failed:', result.error);
        return false;
      }
      const dump = result.data;
      if (dump.settings && typeof dump.settings === 'object') this.setSettings(dump.settings as DesktopSettings);
      if (Array.isArray(dump.exams)) this.setExams(dump.exams as ExamItem[]);
      if (Array.isArray(dump.resources)) this.setResources(dump.resources as ResourceItem[]);
      if (Array.isArray(dump.lectures)) this.setLectures(dump.lectures as PWLectureRecord[]);
      if (Array.isArray(dump.syllabus)) this.setSyllabus(dump.syllabus as SyllabusSubject[]);
      if (Array.isArray(dump.tasks)) this.setTasks(dump.tasks as TaskItem[]);
      if (Array.isArray(dump.flashcards)) this.setFlashcards(dump.flashcards as Flashcard[]);
      if (Array.isArray(dump.pdfs)) this.setPDFs(dump.pdfs as PDFDocumentItem[]);
      if (Array.isArray(dump.browserLogs)) this.set(DB_KEYS.BROWSER_LOGS, dump.browserLogs);
      if (Array.isArray(dump.mockTests)) this.setMockTests(dump.mockTests as MockTestRecord[]);
      if (Array.isArray(dump.activityLogs)) this.setActivityLogs(dump.activityLogs as StudyActivityLog[]);
      if (Array.isArray(dump.scratchpadNotes)) this.setScratchpadNotes(dump.scratchpadNotes as ScratchpadNote[]);
      return true;
    } catch (e) {
      console.error('Failed to import database JSON', e);
      return false;
    }
  }
}

export const db = new LocalDatabaseManager();
export const dbService = db;

if (typeof window !== 'undefined') {
  (window as any).__studyos_db = db;
}

// Persist pending IndexedDB writes on page unload / visibility change
if (typeof window !== 'undefined') {
  const safeFlush = () => {
    try {
      void db.flushNow();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('beforeunload', safeFlush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') safeFlush();
  });
}
