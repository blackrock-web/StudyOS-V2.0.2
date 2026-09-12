import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { db, safeDispatch } from '../services/db';
import { syncService } from '../services/syncService';
import {
  ExamItem,
  TaskItem,
  MockTestRecord,
  GeneratedTestSeries,
  MistakeEntry,
  QuestionMCQ,
  Flashcard,
  PDFDocumentItem,
  ResourceItem,
  SubjectPlan,
  DailyAvailabilityRecord,
  FocusModePlan,
} from '../types';

export interface RoutineSlotConfig {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: 'amber' | 'orange' | 'sky' | 'purple' | 'emerald' | 'rose' | 'indigo';
  focusType: 'Lecture' | 'Practice' | 'Revision' | 'Mock' | 'General';
  description?: string;
}

export const DEFAULT_ROUTINE_SLOTS: RoutineSlotConfig[] = [
  {
    id: 'slot-morning',
    name: 'Morning Slot',
    startTime: '06:00',
    endTime: '09:00',
    color: 'amber',
    focusType: 'Lecture',
    description: 'High cognitive energy — Core Theory & Heavy Lectures',
  },
  {
    id: 'slot-afternoon',
    name: 'Afternoon Slot',
    startTime: '13:30',
    endTime: '17:30',
    color: 'orange',
    focusType: 'Practice',
    description: 'Active problem solving — DPPs, CPPs & Numerical Problems',
  },
  {
    id: 'slot-evening',
    name: 'Evening Slot',
    startTime: '19:00',
    endTime: '21:00',
    color: 'sky',
    focusType: 'Revision',
    description: 'Spaced repetition — Flashcards, Cheat Sheets & Formula Drills',
  },
  {
    id: 'slot-night',
    name: 'Night Slot',
    startTime: '22:00',
    endTime: '00:00',
    color: 'purple',
    focusType: 'Mock',
    description: 'Deep synthesis — Mock Tests, Mistake Analysis & Next-Day Planning',
  },
];

interface ExamContextType {
  activeExamId: string;
  activeExam: ExamItem | null;
  exams: ExamItem[];
  subjects: string[];
  isGate: boolean;
  routineSlots: RoutineSlotConfig[];
  switchExam: (examId: string) => void;
  reloadExams: () => void;
  updateRoutineSlots: (slots: RoutineSlotConfig[]) => void;
  resetRoutineSlots: () => void;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

const ROUTINE_SLOTS_STORAGE_PREFIX = 'studyos_routine_slots_';

export const ExamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeExamId, setActiveExamId] = useState<string>(() => db.getActiveExamId());
  const [exams, setExams] = useState<ExamItem[]>(() => db.getExams());
  const [subjects, setSubjects] = useState<string[]>(() => db.getCurrentExamSubjects());

  // Editable Routine Slots per exam
  const [routineSlots, setRoutineSlots] = useState<RoutineSlotConfig[]>(() => {
    try {
      const saved = localStorage.getItem(`${ROUTINE_SLOTS_STORAGE_PREFIX}${db.getActiveExamId()}`);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return DEFAULT_ROUTINE_SLOTS;
  });

  const activeExam = useMemo(() => {
    return exams.find((e) => e.id === activeExamId || e.code === activeExamId) || exams[0] || null;
  }, [exams, activeExamId]);

  const isGate = useMemo(() => {
    return (
      activeExamId === 'GATE2027' ||
      activeExamId === 'exam-gate-2027' ||
      (activeExam?.code?.toUpperCase().includes('GATE') ?? false)
    );
  }, [activeExamId, activeExam]);

  // Synchronize state on exam change or storage events
  const handleExamSync = useCallback(() => {
    const currentId = db.getActiveExamId();
    setActiveExamId(currentId);
    setExams(db.getExams());
    setSubjects(db.getCurrentExamSubjects());

    try {
      const saved = localStorage.getItem(`${ROUTINE_SLOTS_STORAGE_PREFIX}${currentId}`);
      if (saved) {
        setRoutineSlots(JSON.parse(saved));
      } else {
        setRoutineSlots(DEFAULT_ROUTINE_SLOTS);
      }
    } catch {
      setRoutineSlots(DEFAULT_ROUTINE_SLOTS);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('studyos_active_exam_changed', handleExamSync);
    window.addEventListener('studyos_exams_updated', handleExamSync);
    window.addEventListener('studyos_db_updated', handleExamSync);
    window.addEventListener('storage', handleExamSync);

    return () => {
      window.removeEventListener('studyos_active_exam_changed', handleExamSync);
      window.removeEventListener('studyos_exams_updated', handleExamSync);
      window.removeEventListener('studyos_db_updated', handleExamSync);
      window.removeEventListener('storage', handleExamSync);
    };
  }, [handleExamSync]);

  const switchExam = useCallback((newExamId: string) => {
    db.setActiveExamId(newExamId);
    setActiveExamId(newExamId);
    setExams(db.getExams());
    setSubjects(db.getCurrentExamSubjects());

    try {
      const saved = localStorage.getItem(`${ROUTINE_SLOTS_STORAGE_PREFIX}${newExamId}`);
      if (saved) {
        setRoutineSlots(JSON.parse(saved));
      } else {
        setRoutineSlots(DEFAULT_ROUTINE_SLOTS);
      }
    } catch {
      setRoutineSlots(DEFAULT_ROUTINE_SLOTS);
    }

    safeDispatch(new CustomEvent('studyos_active_exam_changed', { detail: { examId: newExamId } }));
    safeDispatch(new Event('studyos_db_updated'));
  }, []);

  const updateRoutineSlots = useCallback((newSlots: RoutineSlotConfig[]) => {
    setRoutineSlots(newSlots);
    try {
      const currId = db.getActiveExamId();
      localStorage.setItem(`${ROUTINE_SLOTS_STORAGE_PREFIX}${currId}`, JSON.stringify(newSlots));
    } catch {
      /* ignore */
    }
    safeDispatch(new CustomEvent('studyos_routine_slots_updated', { detail: newSlots }));
    safeDispatch(new Event('studyos_db_updated'));
  }, []);

  const resetRoutineSlots = useCallback(() => {
    setRoutineSlots(DEFAULT_ROUTINE_SLOTS);
    try {
      const currId = db.getActiveExamId();
      localStorage.removeItem(`${ROUTINE_SLOTS_STORAGE_PREFIX}${currId}`);
    } catch {
      /* ignore */
    }
    safeDispatch(new CustomEvent('studyos_routine_slots_updated', { detail: DEFAULT_ROUTINE_SLOTS }));
    safeDispatch(new Event('studyos_db_updated'));
  }, []);

  const value = useMemo(
    () => ({
      activeExamId,
      activeExam,
      exams,
      subjects,
      isGate,
      routineSlots,
      switchExam,
      reloadExams: handleExamSync,
      updateRoutineSlots,
      resetRoutineSlots,
    }),
    [
      activeExamId,
      activeExam,
      exams,
      subjects,
      isGate,
      routineSlots,
      switchExam,
      handleExamSync,
      updateRoutineSlots,
      resetRoutineSlots,
    ]
  );

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
};

export const useExam = (): ExamContextType => {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExam must be used within an ExamProvider');
  }
  return context;
};

/**
 * Strict Exam-Level Isolated Data Hook
 * Every query and mutation is strictly partitioned and scoped to the active exam.
 */
export const useExamData = () => {
  const examContext = useExam();
  const { activeExamId, isGate, subjects, routineSlots, updateRoutineSlots, resetRoutineSlots } = examContext;

  const [tasks, setTasksState] = useState<TaskItem[]>(() => db.getTasks());
  const [flashcards, setFlashcardsState] = useState<Flashcard[]>(() => db.getFlashcards());
  const [mockTests, setMockTestsState] = useState<MockTestRecord[]>(() => db.getMockTests());
  const [testSeries, setTestSeriesState] = useState<GeneratedTestSeries[]>(() => db.getTestSeries());
  const [mistakes, setMistakesState] = useState<MistakeEntry[]>(() => db.getMistakes());
  const [questions, setQuestionsState] = useState<QuestionMCQ[]>(() => db.getMCQs());
  const [pdfs, setPDFsState] = useState<PDFDocumentItem[]>(() => db.getPDFs());
  const [resources, setResourcesState] = useState<ResourceItem[]>(() => db.getResources());
  const [subjectPlans, setSubjectPlansState] = useState<SubjectPlan[]>(() => db.getLecturePlans());
  const [dailyAvailability, setDailyAvailabilityState] = useState<DailyAvailabilityRecord>(() =>
    db.getDailyAvailability()
  );
  const [focusConfig, setFocusConfigState] = useState<FocusModePlan>(() => db.getFocusModePlan());

  const refreshAllExamData = useCallback(() => {
    setTasksState(db.getTasks());
    setFlashcardsState(db.getFlashcards());
    setMockTestsState(db.getMockTests());
    setTestSeriesState(db.getTestSeries());
    setMistakesState(db.getMistakes());
    setQuestionsState(db.getMCQs());
    setPDFsState(db.getPDFs());
    setResourcesState(db.getResources());
    setSubjectPlansState(db.getLecturePlans());
    setDailyAvailabilityState(db.getDailyAvailability());
    setFocusConfigState(db.getFocusModePlan());
  }, []);

  useEffect(() => {
    refreshAllExamData();
    const handleSync = () => refreshAllExamData();

    window.addEventListener('studyos_tasks_updated', handleSync);
    window.addEventListener('studyos_active_exam_changed', handleSync);
    window.addEventListener('studyos_exams_updated', handleSync);
    window.addEventListener('studyos_syllabus_updated', handleSync);
    window.addEventListener('studyos_db_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('studyos_tasks_updated', handleSync);
      window.removeEventListener('studyos_active_exam_changed', handleSync);
      window.removeEventListener('studyos_exams_updated', handleSync);
      window.removeEventListener('studyos_syllabus_updated', handleSync);
      window.removeEventListener('studyos_db_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [refreshAllExamData]);

  // Exam-scoped Task Actions
  const addTask = useCallback((task: TaskItem) => {
    syncService.addTask(task);
    setTasksState(syncService.getTasks());
  }, []);

  const updateTask = useCallback((task: TaskItem) => {
    syncService.updateTask(task);
    setTasksState(syncService.getTasks());
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    syncService.deleteTask(taskId);
    setTasksState(syncService.getTasks());
  }, []);

  const setTasks = useCallback((newTasks: TaskItem[]) => {
    db.setTasks(newTasks);
    setTasksState(newTasks);
  }, []);

  // Exam-scoped Mock / Test Series Actions
  const addMockTest = useCallback((mock: MockTestRecord) => {
    db.addMockTest(mock);
    setMockTestsState(db.getMockTests());
  }, []);

  const addMistake = useCallback((mistake: MistakeEntry) => {
    db.addMistake(mistake);
    setMistakesState(db.getMistakes());
  }, []);

  const addQuestion = useCallback((q: QuestionMCQ) => {
    db.addMCQ(q);
    setQuestionsState(db.getMCQs());
  }, []);

  // Filter Tasks by Date
  const getTasksForDate = useCallback(
    (dateStr: string) => {
      return tasks.filter((t) => t.dueDate === dateStr);
    },
    [tasks]
  );

  return {
    ...examContext,
    activeExamId,
    isGate,
    subjects,
    tasks,
    flashcards,
    mockTests,
    testSeries,
    mistakes,
    questions,
    pdfs,
    resources,
    subjectPlans,
    dailyAvailability,
    focusConfig,
    routineSlots,
    updateRoutineSlots,
    resetRoutineSlots,
    addTask,
    updateTask,
    deleteTask,
    setTasks,
    addMockTest,
    addMistake,
    addQuestion,
    getTasksForDate,
    refreshAllExamData,
  };
};
