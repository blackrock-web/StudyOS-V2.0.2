export type {
  ExamDatesDefinition,
  ExamRevisionSettings,
  ExamStudyGoals,
  ExamDefinition,
} from '../data/examDefinitions';

export type CourseType = 'CS' | 'DA';

export interface ScratchpadNote {
  id: string;
  title: string;
  content: string;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
  examId?: string;
  accountId?: string;
  tags?: string[];
}

export type TensorixTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';
export type DepthBreadthApproach = 'DEPTH' | 'BREADTH';

export interface SyllabusTopic {
  id: string;
  subjectId: string;
  name: string;
  course: CourseType;
  tier: TensorixTier;
  approach: DepthBreadthApproach;
  weightagePercent: number; // e.g. 12-14
  idealHours: number;
  completedHours: number;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Revision Phase';
  confidence: number; // 1 to 5
  difficulty: 'Easy' | 'Medium' | 'Hard';
  notesCount: number;
  questionsSolved: number;
  revisionCount: number;
  subtopics: string[];
}

export interface SyllabusSubject {
  id: string;
  name: string;
  course: CourseType;
  tier: TensorixTier;
  weightage: string;
  coreHours7Month: number;
  idealHours: number;
  priorityRank: number;
  prerequisites: string;
  topics: SyllabusTopic[];
}

export interface ChapterPlan {
  id: string;
  name: string;
  lecturesCount: number;
  dppCount: number;
  dppType: 'DPP' | 'CPP' | 'PYQ';
  lecturesCompleted: number;
  dppsCompleted: number;
}

export interface SubjectPlan {
  id: string;
  name: string;
  targetCompletionDate?: string;
  chapters: ChapterPlan[];
}

export interface PWLectureRecord {
  id: string;
  subject: string;
  chapter: string;
  title?: string;
  priority?: 'High' | 'Medium' | 'Low';
  scheduledTime?: string;
  lectureNumber: number;
  originalDate: string; // YYYY-MM-DD
  reanchoredDate: string; // YYYY-MM-DD
  dpp: string; // e.g. "DPP 01" or ""
  weeklyTest: string; // e.g. "Weekly Test 01 (14 June 2026)" or ""
  status: 'Pending' | 'Completed' | 'Skipped' | 'Paused' | 'Rewatched';
  watchSpeed: number; // 1, 1.25, 1.5, 2
  durationMinutes: number;
  timeSpentMinutes: number;
  dppCompleted: boolean;
  notes: string;
  bookmarkTimestamp: string;
  revisionCount: number;
  confidence: number; // 1-5
  mistakesLogged: string;
}

export interface TaskItem {
  id: string;
  title: string;
  type: 'Lecture' | 'Revision' | 'Practice' | 'Mock' | 'DPP' | 'Assignment' | 'Notes' | 'Flashcards' | 'Formula Revision' | 'PYQs' | 'Study Session' | 'Pomodoro' | 'Custom';
  subject: string;
  chapter?: string;
  topic?: string;
  description?: string;
  dueDate: string;
  timeSlot: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  priority: 'High' | 'Medium' | 'Low';
  estimatedMinutes: number;
  timeSpentMinutes?: number;
  completed: boolean;
  completedAt?: string;
  srsIntervalDays?: number;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Incomplete';
  reminder?: boolean;
  reminderTime?: string;
  recurring?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Day-wise';
  notes?: string;
  order?: number;
  startTime?: string;
  endTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes?: number;
  isPomodoroSession?: boolean;
  isRevisionTask?: boolean;
  revisionInterval?: '1-Day' | '3-Day' | '7-Day' | '30-Day';
  /** Links focus sessions back to planner / analytics */
  focusSessionIds?: string[];
  dayOfWeek?: number; // 0-6 for day-wise plans
  /** Quick Focus / Todo Manager extensions */
  category?: string;
  colorTag?: string;
  pinned?: boolean;
  archived?: boolean;
  orderIndex?: number;
  linkedSessionId?: string;
  examId?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface TaskTemplateItem {
  title: string;
  type: TaskItem['type'];
  subjectPlaceholder?: string;
  timeSlot: TaskItem['timeSlot'];
  priority: TaskItem['priority'];
  estimatedMinutes: number;
  startTime?: string;
  endTime?: string;
  dayOffset: number;
  recurring?: TaskItem['recurring'];
  description?: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  category: 'Sprint' | 'Daily Routine' | 'Revision' | 'Practice' | 'Exam Prep' | 'Custom';
  description: string;
  durationDays: number;
  iconName?: string;
  badge?: string;
  examId?: string;
  defaultTasks: TaskTemplateItem[];
  isCustom?: boolean;
}

export interface Flashcard {
  id: string;
  subject: string;
  chapter: string;
  front: string;
  back: string;
  formula?: string;
  category: 'Flashcard' | 'Formula' | 'Short Note' | 'Concept';
  lastReviewedDate?: string;
  nextReviewDate: string;
  intervalDays: number; // 1, 3, 7, 15, 30, 60, 90
  easeFactor: number;
  repetitions: number;
  confidence: number; // 1-5
}

export interface PDFDocumentItem {
  id: string;
  title: string;
  subject: string;
  chapter?: string;
  fileSize: string;
  pageCount: number;
  readProgressPages: number;
  readingTimeMinutes: number;
  indexedChapters: string[];
  notesExtractedCount: number;
  flashcardsExtractedCount: number;
  uploadedAt: string;
  contentSnippet?: string;
}

export interface BrowserVisitLog {
  id: string;
  timestamp: string;
  url: string;
  title: string;
  category: 'PW Lecture' | 'YouTube Study' | 'LeetCode/Practice' | 'PDF Reading' | 'Notes/Docs' | 'StudyOS Module';
  durationSeconds: number;
  lectureCompletionPercent?: number;
  pdfReadingPercent?: number;
  videoWatchTimeSeconds?: number;
  notesCreatedCount?: number;
  questionsSolvedCount?: number;
  favicon?: string;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  category: string;
  folder?: string;
  addedAt?: string;
}

export interface MockTestRecord {
  id: string;
  testName: string;
  title?: string;
  testDate: string;
  date?: string;
  phase?: 'First Contact (Weeks 1-24)' | 'Early Competitive (Weeks 25-28)' | 'Late Competitive (Weeks 29-33)' | 'Full Syllabus' | string;
  score: number; // e.g. 115
  totalMarks: number; // 160 or 100
  percentage?: number;
  accuracyPercent?: number;
  negativeMarks?: number;
  attempted?: number;
  skipped?: number;
  wrong?: number;
  totalQuestions?: number;
  durationMinutes?: number;
  completed?: boolean;
  subjectScores?: Record<string, { attempted: number; correct: number; wrong: number; marks: number }>;
  predictedGatescore?: number;
  predictedPercentile?: number;
  weakTopicsIdentified?: string[];
}

export interface QuestionMCQ {
  id: string;
  subject: string;
  topic?: string;
  type?: 'MCQ' | 'MSQ' | 'NAT' | string;
  question?: string;
  questionText: string;
  codeSnippet?: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  year?: string;
  marks: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  userStatus?: 'Unsolved' | 'Correct' | 'Incorrect';
  userSelectedAnswer?: string;
  isBookmarked?: boolean;
}

export interface MistakeEntry {
  id: string;
  questionId?: string;
  subject: string;
  topic?: string;
  questionTitle?: string;
  question?: string;
  questionStatement?: string;
  wrongAnswerGiven?: string;
  userChoice?: string;
  correctAnswer?: string;
  correctChoice?: string;
  reason?: string;
  errorReason?: 'Conceptual Error' | 'Calculation Error' | 'Misread Question' | 'Time Pressure' | 'Formula Forgotten' | 'Option Trap' | 'Other' | string;
  solutionExplanation?: string;
  goldenRule?: string;
  status?: 'Unresolved' | 'Under Review' | 'Mastered';
  dateAdded?: string;
  date?: string;
  revisionCount?: number;
}

export interface StudyActivityLog {
  date: string; // YYYY-MM-DD
  studyMinutes: number;
  idleMinutes: number;
  breakMinutes: number;
  lectureMinutes: number;
  questionSolvingMinutes: number;
  revisionMinutes: number;
  flashcardsMinutes: number;
  pdfReadingMinutes: number;
  browserMinutes: number;
  productivityScore: number; // 0 - 100%
}

export interface BreakGameStats {
  gamesPlayed: number;
  gamesWon: number;
  totalBreakGameTimeSecs: number;
  highScores: Record<string, number>;
  fastestCompletionSecs: Record<string, number>;
  favoriteGame: string;
}

export interface PomodoroBreakConfig {
  autoLaunchGames: boolean;
  defaultGame: string;
  randomizeGames: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  autoResumeStudy: boolean;
  allowSkipBreak: boolean;
  muteSounds: boolean;
  breakTheme: 'dark' | 'light';
}

export interface StudyCoachConfig {
  enabled: boolean;
  volume: number; // 0-100
  muted: boolean;
  repeatIntervalMinutes: number; // e.g. 5
  welcomeOnStart: boolean;
  encourageOnFinish: boolean;
}

export interface SubGoalItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface DailyObjective {
  goalText: string;
  subgoals: SubGoalItem[];
  completionPercent: number;
  date: string;
}

export interface ConnectedLANDevice {
  id: string;
  ip: string;
  hostname: string;
  approved: boolean;
  lastActive: string;
  role: 'Administrator' | 'User' | 'LAN Viewer';
}

export interface ThemeScheduleConfig {
  mode: 'system' | 'auto' | 'light' | 'dark';
  nightStartHour: number; // e.g. 19 (7 PM)
  dayStartHour: number; // e.g. 7 (7 AM)
}

export interface DesktopSettings {
  theme: 'dark' | 'light' | 'ocean';
  reanchorStartDate: string; // YYYY-MM-DD
  targetExamDate: string; // 2027-02-07
  dailyGoalHours: number; // e.g. 7
  weeklyGoalHours: number; // e.g. 48
  autoSaveIntervalMs: number;
  inactivityAutoLockMins?: number; // 0, 5, 10, 15, 30
  offlineMode: boolean;
  allowBackgroundFocusTimer?: boolean; // When false (default), focus timer pauses if window is minimized/hidden
  soundNotifications: boolean;
  activeProfile: string;
  lastRolloverDate?: string;
  showStudyBrowser?: boolean; // Controls whether Study Browser is visible in navigation
  plannerDefaultDuration?: number; // Default duration in mins (e.g. 60)
  plannerDefaultSlotTime?: string; // Default start time
  practiceNegativeMarking?: boolean; // Default negative marking in custom tests
  practiceDefaultDurationMins?: number; // Default duration for generated tests
  timetableSlots?: any[];
  dailySchedule?: { timeSlots?: any[] };
  pomodoroBreakConfig?: PomodoroBreakConfig;
  studyCoachConfig?: StudyCoachConfig;
  themeScheduleConfig?: ThemeScheduleConfig;
  connectedDevices?: ConnectedLANDevice[];
}

export interface QuestionImportItem {
  id: string;
  subject: string;
  topic: string;
  type: 'MCQ' | 'MSQ' | 'NAT';
  questionText: string;
  codeSnippet?: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  marks: 1 | 2;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  year?: string;
  source?: string;
  isDuplicate?: boolean;
  validationStatus?: 'Valid' | 'Warning' | 'Error';
  validationMessage?: string;
  selectedForImport?: boolean;
}

export interface GeneratedTestSeries {
  id: string;
  title: string;
  type?: 'Subject' | 'Topic' | 'Full-Length' | 'Mixed' | string;
  examId?: string;
  subject?: string;
  topic?: string;
  topics?: string[];
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed' | 'All' | string;
  totalQuestions?: number;
  totalMarks: number;
  durationMinutes: number;
  negativeMarking: boolean;
  questionIds?: string[];
  questions: QuestionMCQ[];
  createdAt: string;
  completed?: boolean;
  score?: number;
  lastAttemptScore?: number;
  lastAttemptDate?: string;
}

export interface TestAttemptSession {
  testId: string;
  testTitle: string;
  startTime: string;
  durationMinutes: number;
  remainingSeconds: number;
  userAnswers: Record<string, string>;
  markedForReview: Record<string, boolean>;
  isSubmitted: boolean;
  submittedAt?: string;
}

export type UserRole = 'Student' | 'Parent';

export interface ParentLinkingCodeRecord {
  code: string;
  studentAccountId: string;
  studentUsername: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedByUsername?: string;
  usedAt?: string;
}

export interface UserProfile {
  accountId: string; // UUID v4
  fullName: string;
  username: string; // unique handle
  email?: string;
  phone?: string;
  bio?: string;
  passwordHash: string;
  pinHash?: string; // 4-digit PIN hash
  role?: UserRole;
  linkedStudentAccountId?: string;
  isDefaultAdmin?: boolean;
  mustChangePassword?: boolean;
  securityQuestion: string;
  securityAnswerHash: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  theme: 'light' | 'dark' | 'ocean';
  studyTarget: string; // e.g. "GATE 2027 CS & DA" or "Custom Exam"
  targetExamType?: 'GATE' | 'CUSTOM';
  targetExamDate?: string;
  // Academic Information
  institution?: string; // University / Institution Name
  semesterOrClass?: string; // e.g. "7th Semester CSE" or "Final Year B.Tech"
  preferredStudyHours?: string; // e.g. "Morning 6:00 AM - 12:00 PM & Evening 5:00 PM - 10:00 PM"
  dailyGoalHours?: number;
  weeklyGoalHours?: number;
  dailyGoalDPPs?: number;
  weeklyGoalRevisions?: number;
  isOnboarded?: boolean;
  streakDays: number;
  lastSyncTime: string;
  storageBytes: number;
  rememberMe?: boolean;
}

// --- PDF KNOWLEDGE ENGINE & CAPTURE TYPES ---
export type PDFCaptureType =
  | 'highlight'
  | 'annotation'
  | 'bookmark'
  | 'flashcard'
  | 'revision_note'
  | 'formula_note'
  | 'screenshot'
  | 'linked_note';

export interface PDFCaptureItem {
  id: string;
  pdfId: string;
  pdfTitle: string;
  pageNumber: number;
  type: PDFCaptureType;
  rectBounds?: { x: number; y: number; width: number; height: number }; // Percentage (0-100) or px coordinates
  capturedImageDataUrl?: string; // Base64 screenshot crop
  capturedText?: string;
  color?: string; // e.g., 'yellow', 'emerald', 'cyan', 'rose', 'purple'
  annotationText?: string;
  // Linked Hierarchy: Exam -> Subject -> Chapter -> Topic
  examId?: string;
  examTitle?: string;
  subjectName?: string;
  chapterName?: string;
  topicName?: string;
  createdAt: string;
}

// --- MULTI-EXAM PLATFORM TYPES ---
export type ExamCategory = 'Engineering' | 'Civil Services' | 'Higher Ed' | 'IT & Cloud' | 'Medical' | 'Management' | 'Custom';
export type ExamPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type ExamStatus = 'Active' | 'Upcoming' | 'Archived' | 'Completed';
export type PreparationLevel = 'Not Started' | 'Basic' | 'Intermediate' | 'Advanced' | 'Exam Ready';

export interface ExamTopicNode {
  id: string;
  name: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Revision';
  confidence: number; // 1 to 5
  idealHours?: number;
}

export interface ExamChapterNode {
  id: string;
  name: string;
  completed: boolean;
  topics: ExamTopicNode[];
}

export interface ExamSubjectNode {
  id: string;
  name: string;
  weightagePercent: number;
  chapters: ExamChapterNode[];
}

export interface ExamLinkedAsset {
  id: string;
  title: string;
  type: 'Resource' | 'PYQ' | 'Mock' | 'Note';
  details?: string;
  url?: string;
}

export interface ExamItem {
  id: string;
  title: string;
  code: string;
  category: ExamCategory;
  priority: ExamPriority;
  targetScore: string;
  examDate: string; // YYYY-MM-DD
  registrationStartDate?: string;
  registrationEndDate?: string;
  registrationDeadline?: string; // YYYY-MM-DD
  admitCardDate?: string; // YYYY-MM-DD
  resultDate?: string; // YYYY-MM-DD
  preparationLevel?: PreparationLevel;
  officialWebsiteUrl?: string;
  color: string; // e.g., 'purple', 'emerald', 'amber', 'rose', 'indigo', 'cyan'
  status: ExamStatus;
  subjects: ExamSubjectNode[];
  readinessPercent: number; // 0 - 100
  targetDailyHours: number; // e.g. 3.5
  notes?: string;
  attachmentsCount?: number;
  attachments?: { id: string; name: string; size: string; type: string }[];
  linkedResourcesCount?: number;
  linkedPYQsCount?: number;
  linkedMockTestsCount?: number;
  linkedNotesCount?: number;
  linkedAssets?: ExamLinkedAsset[];
  createdDate: string;
  updatedDate: string;
}

// --- HIERARCHICAL RESOURCE LIBRARY TYPES ---
export type ResourceType = 'Notes' | 'PDF' | 'Image' | 'Audio' | 'Video' | 'Flashcards' | 'PYQs' | 'Practice' | 'Formula' | 'Other';

export interface ResourceItem {
  id: string;
  title: string;
  type: ResourceType;
  examId: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  content: string; // text body, markdown, formula, base64 snippet or snippet
  fileSize?: string;
  tags: string[];
  isFavorite: boolean;
  createdDate: string;
  updatedDate: string;
  linkedModule?: 'Syllabus' | 'Planner' | 'Flashcards' | 'PDF' | 'MCQs';
}

// --- PROJECTS WORKSPACE TYPES ---
export interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ProjectItem {
  id: string;
  title: string;
  category: 'Full-Stack' | 'AI / Machine Learning' | 'Systems / OS' | 'Mobile App' | 'Research Paper' | 'Hardware / IoT' | 'Custom';
  status: 'Planning' | 'In Progress' | 'In Review' | 'Completed';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  techStack: string[];
  repoUrl?: string;
  demoUrl?: string;
  targetCompletionDate: string;
  progressPercent: number;
  tasks: ProjectTask[];
  createdDate: string;
  updatedDate: string;
}

// --- CANONICAL COMPONENTS / STUDY HUB TYPES ---
export interface Chapter {
  id: string;
  name: string;
  status: "Not Started" | "In Progress" | "Completed";
  revisionCount?: number;
  confidence?: number;
  lastReviewedDate?: string;
  nextReviewDate?: string;
  estimatedHours?: number;
  completedHours?: number;
  difficulty?: "Easy" | "Medium" | "Hard";
  notes?: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  chapters: Chapter[];
  targetCompletionDate?: string;
  progressPercent?: number;
}

export interface Note {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  content: string;
  tags?: string[];
  topic?: string;
  isBookmarked?: boolean;
  lastModified?: string;
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
}

export interface FormulaItem {
  id: string;
  subjectId: string;
  subjectName: string;
  category: "Formula" | "Definition" | "Algorithm" | "Time Complexity" | "Shortcut" | "Theorem";
  title: string;
  content: string;
  example?: string;
  tags?: string[];
}

export interface StudyResource {
  id: string;
  title: string;
  category: "Video" | "Article" | "PDF" | "Link" | "Textbook" | "Other";
  url: string;
  notes?: string;
  bookmarked?: boolean;
  subjectId?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  subjectId?: string;
  chapterId?: string;
  type: string;
  priority?: "High" | "Medium" | "Low";
  completed: boolean;
  rescheduledCount?: number;
  createdAt?: string;
  isArchived?: boolean;
  notes?: string;
  category?: string;
  recurring?: string;
  parentId?: string;
  subtasks?: any[];
  dependencies?: string[];
  auditHistory?: any[];
  labels?: string[];
  scheduledTime?: string;
  durationHours?: number;
  pdfMockName?: string;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  category?: string;
  dueDate?: string;
  priority?: "High" | "Medium" | "Low";
  scheduledTime?: string;
  duration?: number;
}

export interface FocusSession {
  id: string;
  durationMinutes: number;
  timestamp: string;
  subjectId?: string;
  mode?: string;
  lectureId?: string;
  plannedDuration?: number;
  actualDuration?: number;
  startTime?: string;
  endTime?: string;
  pauseDuration?: number;
  status?: string;
}

export interface FocusSessionRecord {
  id: string;
  lectureId?: string;
  taskId?: string;
  subjectId?: string;
  subject: string;
  lectureTitle: string;
  chapter?: string;
  plannedDurationMinutes: number;
  actualDurationMinutes: number;
  startTime: string;
  endTime: string;
  pauseCount: number;
  completionStatus: 'Completed' | 'In Progress' | 'Paused' | 'Cancelled';
  date: string;
  focusPercentage: number;
  examId?: string;
  notes?: string;
}

export interface AutoScheduleSlot {
  id: string;
  taskId?: string;
  lectureId?: string;
  title: string;
  type: 'Lecture' | 'Revision' | 'Practice' | 'DPP' | 'Test' | 'Break' | 'College' | 'Commitment' | 'Custom';
  subject: string;
  chapter?: string;
  topic?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  isProtected?: boolean; // sleep, meals, leisure, college
  priority?: 'High' | 'Medium' | 'Low';
  completed?: boolean;
  isCarryOver?: boolean;
}

export interface JourneyTask {
  id: string;
  title: string;
  completed: boolean;
  category?: string;
  type?: string;
  slot?: string;
  duration?: number;
}

export interface JourneyDaySchedule {
  dayNumber?: number;
  dayIndex?: number;
  date: string;
  title?: string;
  tasks: JourneyTask[];
}

export interface AcademicContent {
  revisionNotes?: string[];
  shortNotes?: string;
  detailedNotes?: string;
  formulaSheet?: Array<{ name: string; formula: string; explanation: string }>;
  importantDefinitions?: Array<{ term: string; definition: string }>;
  flashcards?: Array<{ front: string; back: string }>;
  mnemonics?: Array<{ title: string; rule: string; explanation: string }>;
  practiceQuestions?: Array<{ question: string; options: string[]; answer: string; explanation: string }>;
  pyqs?: Array<{ year: string; question: string; answer: string }>;
}

export interface SyllabusNode {
  id: string;
  parentId?: string | null;
  title: string;
  type: "subject" | "unit" | "chapter" | "topic" | "subtopic";
  completionStatus: "Not Started" | "In Progress" | "Completed";
  difficulty?: "Easy" | "Medium" | "Hard";
  revisionCount?: number;
  notes?: string;
  academicContent?: AcademicContent;
}

export interface SyllabusReport {
  pages: number;
  subjects: number;
  units: number;
  chapters: number;
  topics: number;
  subtopics: number;
  duplicatesMerged: number;
  issues: string[];
}

export interface StudyScheduleItem {
  date: string;
  subject: string;
  topic: string;
  durationHours: number;
}

export interface SchedulerSlot {
  id?: string;
  day?: string;
  time?: string;
  subject?: string;
  topic?: string;
  completed?: boolean;
  [key: string]: any;
}

export interface TaskHistoryRecord {
  id: string;
  taskId: string;
  taskName: string;
  date: string;
  subject: string;
  category: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  completionStatus: 'Pending' | 'In Progress' | 'Completed' | 'Incomplete' | 'Missed';
  completionPercentage: number;
  activeStudyTimeMinutes: number;
  breakTimeMinutes: number;
  pauseCount: number;
  productivityScore: number;
  focusScore: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppState {
  subjects: Subject[];
  notes: Note[];
  flashcards: any[];
  formulas: FormulaItem[];
  resources: StudyResource[];
  tasks: Task[];
  profileXP?: number;
  examTargetDate?: string;
  syllabusNodes?: SyllabusNode[];
  syllabusReport?: SyllabusReport;
}

// --- FOCUS MODE & STUDY PLANNING TYPES ---
export type StudyPlanningMode = 'focus' | 'balanced' | 'custom';

export interface FocusModePlan {
  examId: string;
  mode: StudyPlanningMode; // 'focus' (single subject priority) | 'balanced' | 'custom'
  subjectId: string;
  subjectName: string;
  requiredHours: number; // e.g. 40
  completedStudyHours: number; // actual recorded study time
  targetDate?: string; // YYYY-MM-DD
  priority: 'Critical' | 'High' | 'Medium';
  autoAdvanceNextSubject?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
  customDistribution?: Record<string, number>; // For custom mode (e.g. { "Physics": 50, "Chemistry": 30, "Math": 20 })
  preferredSessionLengthMinutes?: number; // 25, 45, 60, 90
  maxDailyStudyHours?: number; // e.g. 6 or 8
  notes?: string;
  updatedAt: string;
}

export type CollegeOption =
  | 'no_college'
  | 'morning_college' // 10 AM - 1 PM
  | 'afternoon_college' // 2 PM - 6 PM
  | 'full_college' // 9 AM - 5 PM
  | 'custom_college'
  | 'multi_slot_college';

export interface CollegeSlot {
  id: string;
  title: string; // e.g. "Theory Lecture", "Lab Session", "Morning Block"
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface DailyCommitment {
  id: string;
  title: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface DailyAvailabilityRecord {
  date: string; // YYYY-MM-DD
  examId: string;
  collegeOption: CollegeOption;
  customCollegeStart?: string;
  customCollegeEnd?: string;
  collegeSlots?: CollegeSlot[];
  morningSlot: '6-9' | '7-9' | 'custom';
  customMorningStart?: string;
  customMorningEnd?: string;
  commitments: DailyCommitment[];
  eveningMode: 'standard' | 'custom'; // Standard: 7-9 PM & 10-12 PM
  customEveningSlots?: { title: string; startTime: string; endTime: string }[];
  specialPriority: 'focus_subject' | 'other_subject' | 'revision' | 'practice_test' | 'balanced';
  specialSubjectName?: string;
  answersSubmitted: boolean;
  updatedAt: string;
}

export interface AutoScheduleResult {
  date: string;
  examId: string;
  totalPlannedMinutes: number;
  slots: AutoScheduleSlot[];
  hasConflict: boolean;
  conflictReason?: string;
  unallocatedMinutes?: number;
  recommendations: string[];
}

export interface LiveStudySessionState {
  isActive: boolean;
  isPaused: boolean;
  taskId?: string;
  examId: string;
  subject: string;
  chapter?: string;
  topic?: string;
  taskTitle: string;
  plannedMinutes: number;
  elapsedSeconds: number;
  startTime: string; // ISO string
  type: 'Lecture' | 'Revision' | 'Practice' | 'Flashcards' | 'PDF' | 'Custom';
}

// --- RAG & KNOWLEDGE BASE TYPES ---
export interface RAGDocumentChunk {
  id: string;
  docId: string;
  docTitle: string;
  examId: string;
  subjectName: string;
  chapterName?: string;
  topicName?: string;
  content: string;
  pageNumber?: number;
  relevanceScore?: number;
  keywords: string[];
}

export interface RAGSearchQuery {
  query: string;
  examId: string;
  subjectFilter?: string;
  typeFilter?: 'all' | 'notes' | 'syllabus' | 'questions' | 'pdfs';
  topK?: number;
}

export interface RAGSearchCitation {
  id: string;
  sourceType: 'PDF' | 'Note' | 'Syllabus' | 'Question' | 'Formula';
  title: string;
  snippet: string;
  location?: string; // Page / Subject / Topic
  confidencePercent: number;
}

export interface RAGQueryAnswer {
  query: string;
  answerText: string;
  citations: RAGSearchCitation[];
  conceptTags: string[];
  suggestedFlashcards?: Array<{ front: string; back: string; topic: string }>;
  suggestedQuestions?: Array<{ question: string; options: string[]; answer: string }>;
  timestamp: string;
}

// --- NETWORK ACCESS GATEWAY TYPES ---
export type NetworkAccessStatus = 'LOCKED' | 'UNLOCKED' | 'OPERATION_IN_PROGRESS';
export type AuthorizedOperation = 'update' | 'model-download' | 'none';

export interface NetworkGatewayState {
  status: NetworkAccessStatus;
  authorizedOperation: AuthorizedOperation;
  unlockedAt: string | null;
  expiresAt: string | null;
  reason: string | null;
  hasConfiguredPin: boolean;
  activeSessionDurationSecs: number;
}

export interface NetworkAllowlistRule {
  operation: AuthorizedOperation;
  allowedDomains: string[];
  description: string;
}

// --- LOCAL LLM & AI MODEL TYPES ---
export type ModelStatus = 'not-downloaded' | 'downloading' | 'verifying' | 'installed' | 'active' | 'error';

export interface LocalModelDescriptor {
  id: string;
  name: string;
  tagline: string;
  parameterSize: string; // e.g. '135M', '0.5B', '1.1B'
  diskSizeFormatted: string; // e.g. '80 MB', '350 MB'
  diskSizeBytes: number;
  sha256: string;
  downloadUrl: string;
  license: string;
  format: 'GGUF' | 'ONNX' | 'WebLLM' | 'Ollama';
  quantization: string; // e.g. 'Q4_K_M', 'q4f16_1', 'int8'
  recommendedRam: string;
  inferenceSpeed: string; // e.g. '~45 tokens/sec'
  strengths: string[];
  offlineReady: boolean;
  installedAt?: string;
  filePath?: string;
  status: ModelStatus;
  downloadProgress?: number;
  downloadSpeed?: string;
  bytesDownloaded?: number;
  error?: string;
}

// --- APP DESTRUCTION TYPES ---
export interface DestructionManifest {
  installedFiles: string[];
  installedDirectories: string[];
  userDataPaths: string[];
  cachePaths: string[];
  logPaths: string[];
  modelsDirectory: string;
  databaseFiles: string[];
  desktopShortcuts: string[];
  startMenuEntries: string[];
  dotDesktopFiles: string[];
}

export interface DestructionProgressState {
  phase: 'idle' | 'warning' | 'pin_auth' | 'confirm_text' | 'executing' | 'completed' | 'failed';
  currentStep: string;
  percent: number;
  deletedItems: string[];
  error?: string;
}



