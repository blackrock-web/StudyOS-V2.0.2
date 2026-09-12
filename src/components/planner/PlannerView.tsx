import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Zap,
  BookOpen,
  Edit3,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
  Upload,
  Layers,
  Check,
  RotateCcw,
  AlertCircle,
  FileText,
  Target,
} from 'lucide-react';
import { db } from '../../services/db';
import { TaskItem, SubjectPlan, ChapterPlan } from '../../types';
import { INITIAL_GATE_PW_SUBJECT_PLANS } from '../../data/canonicalData';
import { GlassCard } from '../shared/GlassCard';
import { PlannerHub } from './PlannerHub';
import { getAllSubjectOptions } from '../../data/subjectRegistry';

interface PlannerViewProps {
  onShowNotification: (msg: string, title?: string) => void;
  activeTab?: string;
}

interface RevisionSchedule {
  id: string;
  subject: string;
  topic: string;
  interval: '1-Day' | '3-Day' | '7-Day' | '30-Day';
  dueDate: string;
  completed: boolean;
}

const INITIAL_REVISION_SCHEDULES: RevisionSchedule[] = [
  { id: 'rev-1', subject: 'Algorithms', topic: 'Dynamic Programming Memoization vs Tabulation', interval: '1-Day', dueDate: '2026-07-24', completed: false },
  { id: 'rev-2', subject: 'Operating Systems', topic: 'Page Replacement Algorithms (LRU, FIFO, Optimal)', interval: '3-Day', dueDate: '2026-07-26', completed: false },
  { id: 'rev-3', subject: 'Discrete Mathematics', topic: 'Graph Isomorphism & Euler Paths', interval: '7-Day', dueDate: '2026-07-29', completed: true },
  { id: 'rev-4', subject: 'Computer Networks', topic: 'TCP Sliding Window & Congestion Control', interval: '30-Day', dueDate: '2026-08-15', completed: false },
  { id: 'rev-5', subject: 'DBMS', topic: 'Strict 2PL vs Rigorous 2PL Serializability', interval: '3-Day', dueDate: '2026-07-27', completed: false },
];

export const PlannerView: React.FC<PlannerViewProps> = ({ onShowNotification, activeTab }) => {
  const [activeExamId, setActiveExamId] = useState<string>(() => db.getActiveExamId());
  const [activeExam, setActiveExam] = useState(() => db.getActiveExam());
  const isGate = useMemo(() => db.isGateActive(activeExamId), [activeExamId]);

  const [tasks, setTasks] = useState<TaskItem[]>(db.getTasks());
  const [activeSubTab, setActiveSubTab] = useState<'PlannerHub' | 'LecturePlanner'>(() => {
    if (activeTab === 'lectures' || activeTab === 'syllabus') {
      return 'LecturePlanner';
    }
    return 'PlannerHub';
  });

  useEffect(() => {
    if (activeTab === 'lectures' || activeTab === 'syllabus') {
      setActiveSubTab('LecturePlanner');
    } else {
      setActiveSubTab('PlannerHub');
    }
  }, [activeTab]);

  // Exam Workspace Listener
  useEffect(() => {
    const handleExamChange = () => {
      const currentExamId = db.getActiveExamId();
      setActiveExamId(currentExamId);
      setActiveExam(db.getActiveExam());
      setSubjectPlans(db.getLecturePlans(currentExamId));
      setTasks(db.getTasks(currentExamId));
      const subs = db.getCurrentExamSubjects(currentExamId);
      if (subs && subs.length > 0) {
        setNewTaskSubject(subs[0]);
      }
    };

    const handleTasksUpdate = () => {
      setTasks(db.getTasks());
    };

    window.addEventListener('studyos_active_exam_changed', handleExamChange);
    window.addEventListener('studyos_exams_updated', handleExamChange);
    window.addEventListener('studyos_tasks_updated', handleTasksUpdate);
    return () => {
      window.removeEventListener('studyos_active_exam_changed', handleExamChange);
      window.removeEventListener('studyos_exams_updated', handleExamChange);
      window.removeEventListener('studyos_tasks_updated', handleTasksUpdate);
    };
  }, []);

  // Lecture Planner State (Exam-scoped)
  const [subjectPlans, setSubjectPlans] = useState<SubjectPlan[]>(() => db.getLecturePlans());

  // Collapse / Expand All State
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());
  const [subjectFilter, setSubjectFilter] = useState<string>('All');

  const availableSubjectOptions = useMemo(() => {
    const currentSubs = db.getCurrentExamSubjects(activeExamId);
    if (currentSubs && currentSubs.length > 0) return currentSubs;
    if (isGate) {
      return getAllSubjectOptions(activeExamId);
    }
    return Array.from(new Set(subjectPlans.map((s) => s.name)));
  }, [activeExamId, isGate, subjectPlans]);

  const filteredSubjectPlans = useMemo(() => {
    if (!subjectFilter || subjectFilter === 'All') return subjectPlans;
    const q = subjectFilter.toLowerCase();
    return subjectPlans.filter((s: SubjectPlan) => s.name.toLowerCase().includes(q));
  }, [subjectPlans, subjectFilter]);

  const toggleCollapseSubject = (id: string) => {
    setCollapsedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedSubjects(new Set());
    onShowNotification('Expanded all subjects in syllabus planner', 'Lecture Planner');
  };

  const handleCollapseAll = () => {
    setCollapsedSubjects(new Set(subjectPlans.map((s) => s.id)));
    onShowNotification('Collapsed all subjects in syllabus planner', 'Lecture Planner');
  };

  const handleResetToSeed = () => {
    if (isGate) {
      setSubjectPlans(INITIAL_GATE_PW_SUBJECT_PLANS);
      setCollapsedSubjects(new Set());
      db.setLecturePlans(INITIAL_GATE_PW_SUBJECT_PLANS, activeExamId);
      onShowNotification('Syllabus planner reset to official PW seed data!', 'PW Lecture Planner');
    } else {
      setSubjectPlans([]);
      setCollapsedSubjects(new Set());
      db.setLecturePlans([], activeExamId);
      onShowNotification(`Lecture planner cleared for ${activeExam?.title || 'current exam'}.`, 'Lecture Planner');
    }
  };

  const isSelfUpdate = useRef(false);

  useEffect(() => {
    // Persist current planner state to the active exam in db
    isSelfUpdate.current = true;
    db.setLecturePlans(subjectPlans, activeExamId);

    // Progress updates sync immediately to syllabus / related modules
    try {
      db.syncSyllabusFromLecturePlans(subjectPlans);
    } catch {
      /* best-effort */
    }
  }, [subjectPlans, activeExamId]);

  useEffect(() => {
    const handleSync = () => {
      if (isSelfUpdate.current) {
        isSelfUpdate.current = false;
        return;
      }
      const plans = db.getLecturePlans(activeExamId);
      setSubjectPlans((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(plans)) return prev;
        return plans;
      });
    };
    window.addEventListener('studyos_lecture_plans_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('studyos_lecture_plans_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [activeExamId]);

  // Modals state for tasks & subject plans
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState(() => db.getCurrentExamSubjects()[0] || 'General Studies');
  const [newTaskType, setNewTaskType] = useState<TaskItem['type']>('Lecture');
  const [newTaskSlot, setNewTaskSlot] = useState<TaskItem['timeSlot']>('Morning');
  const [newTaskMinutes, setNewTaskMinutes] = useState(60);

  // Subject / Chapter Modals
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [newChapterName, setNewChapterName] = useState('');
  const [newLecturesCount, setNewLecturesCount] = useState(8);
  const [newDppCount, setNewDppCount] = useState(2);
  const [newDppType, setNewDppType] = useState<'DPP' | 'CPP' | 'PYQ'>('DPP');

  // Edit Chapter Modal
  const [editingChapter, setEditingChapter] = useState<{ subjectId: string; chapter: ChapterPlan } | null>(null);

  // Revision schedules state
  const [revisions, setRevisions] = useState<RevisionSchedule[]>(() => {
    const subs = db.getCurrentExamSubjects();
    const today = new Date();
    return (subs.length > 0 ? subs : ['General Studies']).slice(0, 5).map((sub, idx) => {
      const intervals: ('1-Day' | '3-Day' | '7-Day' | '30-Day')[] = ['1-Day', '3-Day', '7-Day', '30-Day', '3-Day'];
      const due = new Date(today.getTime() + (idx + 1) * 2 * 86400000).toISOString().split('T')[0] || '';
      return {
        id: `rev-${idx + 1}`,
        subject: sub,
        topic: `${sub} High-Yield Concept Revision & Flashcards`,
        interval: intervals[idx % intervals.length] || '3-Day',
        dueDate: due,
        completed: idx === 2,
      };
    });
  });

  const handleToggleTask = (id: string) => {
    db.toggleTaskCompletion(id);
    setTasks(db.getTasks());
    onShowNotification('Task updated', 'Planner');
  };

  const handleDeleteTask = (id: string) => {
    db.deleteTask(id);
    setTasks(db.getTasks());
    onShowNotification('Task deleted from schedule', 'Planner');
  };

  const handleCreateTask = () => {
    if (!newTaskTitle) return;
    const newTask: TaskItem = {
      id: 'task-' + Date.now(),
      title: newTaskTitle,
      type: newTaskType,
      subject: newTaskSubject,
      dueDate: new Date().toISOString().split('T')[0] || '',
      timeSlot: newTaskSlot,
      priority: 'High',
      estimatedMinutes: newTaskMinutes,
      completed: false,
    };

    db.addTask(newTask);
    setTasks(db.getTasks());
    setShowNewTaskModal(false);
    setNewTaskTitle('');
    onShowNotification('New study task added to local schedule', 'Planner');
  };

  // --- Lecture Planner CRUD Handlers ---
  const handleAddSubject = () => {
    if (!newSubjectName.trim()) return;
    const newSub: SubjectPlan = {
      id: 'sub-' + Date.now(),
      name: newSubjectName.trim(),
      chapters: [],
    };
    setSubjectPlans([...subjectPlans, newSub]);
    setNewSubjectName('');
    setShowAddSubjectModal(false);
    onShowNotification(`Added new subject plan: ${newSub.name}`, 'Lecture Planner');
  };

  const handleAddChapter = () => {
    if (!newChapterName.trim() || !selectedSubjectId) return;
    const newCh: ChapterPlan = {
      id: 'ch-' + Date.now(),
      name: newChapterName.trim(),
      lecturesCount: newLecturesCount,
      dppCount: newDppCount,
      dppType: newDppType,
      lecturesCompleted: 0,
      dppsCompleted: 0,
    };

    setSubjectPlans(
      subjectPlans.map((s) => (s.id === selectedSubjectId ? { ...s, chapters: [...s.chapters, newCh] } : s))
    );

    setNewChapterName('');
    setShowAddChapterModal(false);
    onShowNotification(`Added chapter "${newCh.name}" to syllabus plan`, 'Lecture Planner');
  };

  const handleUpdateSubjectTargetDate = (subjectId: string, newDate: string) => {
    setSubjectPlans(
      subjectPlans.map((s) => (s.id === subjectId ? { ...s, targetCompletionDate: newDate } : s))
    );
    onShowNotification('Subject completion target date updated', 'Lecture Planner');
  };

  const handleUpdateChapterCounts = (subjectId: string, chapterId: string, field: keyof ChapterPlan, delta: number) => {
    setSubjectPlans(
      subjectPlans.map((s) => {
        if (s.id !== subjectId) return s;
        return {
          ...s,
          chapters: s.chapters.map((ch) => {
            if (ch.id !== chapterId) return ch;
            const currentVal = (ch[field] as number) || 0;
            const newVal = Math.max(0, currentVal + delta);
            return { ...ch, [field]: newVal };
          }),
        };
      })
    );
  };

  const handleDirectSetChapterCount = (
    subjectId: string,
    chapterId: string,
    field: 'lecturesCompleted' | 'lecturesCount' | 'dppsCompleted' | 'dppCount',
    val: number
  ) => {
    setSubjectPlans((prev) =>
      prev.map((sub) => {
        if (sub.id !== subjectId) return sub;
        return {
          ...sub,
          chapters: sub.chapters.map((ch) => {
            if (ch.id !== chapterId) return ch;
            let newCompleted = ch.lecturesCompleted;
            let newTotal = ch.lecturesCount;
            let newDppCompleted = ch.dppsCompleted;
            let newDppTotal = ch.dppCount;

            if (field === 'lecturesCompleted') {
              newCompleted = Math.max(0, val);
            } else if (field === 'lecturesCount') {
              newTotal = Math.max(1, val);
            } else if (field === 'dppsCompleted') {
              newDppCompleted = Math.max(0, val);
            } else if (field === 'dppCount') {
              newDppTotal = Math.max(0, val);
            }

            return {
              ...ch,
              lecturesCompleted: newCompleted,
              lecturesCount: newTotal,
              dppsCompleted: newDppCompleted,
              dppCount: newDppTotal,
            };
          }),
        };
      })
    );
  };

  const handleMoveChapter = (subjectId: string, index: number, direction: 'up' | 'down') => {
    setSubjectPlans(
      subjectPlans.map((s) => {
        if (s.id !== subjectId) return s;
        const chapters = [...s.chapters];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= chapters.length) return s;
        const temp = chapters[index];
        const target = chapters[targetIndex];
        if (temp && target) {
          chapters[index] = target;
          chapters[targetIndex] = temp;
        }
        return { ...s, chapters };
      })
    );
  };

  const handleDuplicateChapter = (subjectId: string, chapter: ChapterPlan) => {
    const dup: ChapterPlan = {
      ...chapter,
      id: 'ch-' + Date.now(),
      name: chapter.name + ' (Copy)',
    };
    setSubjectPlans(
      subjectPlans.map((s) => (s.id === subjectId ? { ...s, chapters: [...s.chapters, dup] } : s))
    );
    onShowNotification(`Duplicated chapter: ${chapter.name}`, 'Lecture Planner');
  };

  const handleDeleteChapter = (subjectId: string, chapterId: string) => {
    setSubjectPlans(
      subjectPlans.map((s) => (s.id === subjectId ? { ...s, chapters: s.chapters.filter((c) => c.id !== chapterId) } : s))
    );
    onShowNotification('Chapter deleted from plan', 'Lecture Planner');
  };

  const handleExportPlanJSON = () => {
    const blob = new Blob([JSON.stringify(subjectPlans, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StudyOS_Lecture_Plans_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    onShowNotification('Exported custom lecture plan JSON file', 'Lecture Planner');
  };

  const handleImportPlanJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let imported: unknown = JSON.parse(String(evt.target?.result || ''));
        // Unwrap common export wrappers: { subjects: [...] }, { plans: [...] }, { data: [...] }
        if (imported && typeof imported === 'object' && !Array.isArray(imported)) {
          const obj = imported as Record<string, unknown>;
          if (Array.isArray(obj.subjects)) imported = obj.subjects;
          else if (Array.isArray(obj.plans)) imported = obj.plans;
          else if (Array.isArray(obj.data)) imported = obj.data;
          else if (Array.isArray(obj.lecturePlans)) imported = obj.lecturePlans;
        }
        if (!Array.isArray(imported) || imported.length === 0) {
          onShowNotification(
            'Invalid lecture plan JSON: expected a non-empty array of subjects (with chapters).',
            'Lecture Planner Error'
          );
          return;
        }
        // Full replacement: wipe previous planner data, rebuild from THIS JSON only
        const result = db.importLecturePlansReplace(imported);
        isSelfUpdate.current = true;
        // Use normalized plans returned from DB — guaranteed latest import, not seed
        setSubjectPlans(result.plans as SubjectPlan[]);
        setCollapsedSubjects(new Set());
        onShowNotification(
          `Synced to latest import: ${result.subjectCount} subjects / ${result.chapterCount} chapters (old planner data cleared).`,
          'Lecture Planner'
        );
      } catch (err: any) {
        onShowNotification(
          err?.message || 'Failed to parse imported JSON file',
          'Lecture Planner Error'
        );
      }
      // Allow re-importing the same file
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Calculations for global completion %
  let totalGlobalLectures = 0;
  let totalCompletedLectures = 0;
  let totalGlobalDPPs = 0;
  let totalCompletedDPPs = 0;

  subjectPlans.forEach((s) => {
    s.chapters.forEach((c) => {
      totalGlobalLectures += c.lecturesCount;
      totalCompletedLectures += c.lecturesCompleted;
      totalGlobalDPPs += c.dppCount;
      totalCompletedDPPs += c.dppsCompleted;
    });
  });

  const globalCompletionPct = totalGlobalLectures > 0 ? Math.round((totalCompletedLectures / totalGlobalLectures) * 100) : 0;

  const morningTasks = tasks.filter((t) => t.timeSlot === 'Morning');
  const afternoonTasks = tasks.filter((t) => t.timeSlot === 'Afternoon');
  const nightTasks = tasks.filter((t) => t.timeSlot === 'Night');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-[#1e1b4b] font-sans select-none">
      {/* Top Planner Subtab Navigation */}
      <div className="flex flex-wrap items-center gap-2 bg-purple-100/60 p-1.5 rounded-2xl border border-purple-200/80 w-fit">
        <button
          onClick={() => setActiveSubTab('PlannerHub')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'PlannerHub'
              ? 'bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white shadow-md shadow-pink-500/20'
              : 'bg-white/80 text-slate-700 hover:bg-white hover:text-purple-700 border border-slate-200/60'
          }`}
        >
          <CalendarIcon className={`w-4 h-4 ${activeSubTab === 'PlannerHub' ? 'text-white' : 'text-purple-600'}`} />
          <span>Planner Hub & Timetables</span>
          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
            activeSubTab === 'PlannerHub' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
          }`}>
            Tasks & Calendar
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('LecturePlanner')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'LecturePlanner'
              ? 'bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white shadow-md shadow-pink-500/20'
              : 'bg-white/80 text-slate-700 hover:bg-white hover:text-purple-700 border border-slate-200/60'
          }`}
        >
          <BookOpen className={`w-4 h-4 ${activeSubTab === 'LecturePlanner' ? 'text-white' : 'text-purple-600'}`} />
          <span>{isGate ? 'PW Lecture Planner & DPP Tracker' : 'Lecture Planner & DPP Tracker'}</span>
          {isGate ? (
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
              activeSubTab === 'LecturePlanner' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
            }`}>
              PW CS & DA
            </span>
          ) : (
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
              activeSubTab === 'LecturePlanner' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
            }`}>
              {activeExam?.code || 'Syllabus'}
            </span>
          )}
        </button>
      </div>

      {/* 1. PLANNER HUB VIEW (Merged Daily, Weekly, Timetable, Tasks, Revision) */}
      {activeSubTab === 'PlannerHub' && (
        <PlannerHub onShowNotification={onShowNotification} />
      )}

      {/* 4. LECTURE PLANNER VIEW */}
      {activeSubTab === 'LecturePlanner' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Bar for Lecture Planner */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  {isGate
                    ? 'PW Canonical Lecture & DPP/CPP Syllabus Planner'
                    : `${activeExam?.title || 'Exam'} Lecture & Syllabus Planner`}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isGate
                    ? '15 Core PW CS & DA Subjects → Chapters → Lectures (L) & DPP/CPP counts with custom editing, reordering, duplicate, import & export.'
                    : `Manage subjects, chapters, lecture counts, and DPP tracking for ${activeExam?.title || 'this exam'}. Import JSON or create custom subjects.`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-purple-200 text-slate-700 text-xs font-bold shadow-2xs focus:outline-hidden focus:border-purple-500 cursor-pointer max-w-[180px]"
                >
                  <option value="All">{isGate ? 'All CS/DA Subjects' : 'All Subjects'}</option>
                  {availableSubjectOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <button
                  onClick={collapsedSubjects.size === subjectPlans.length ? handleExpandAll : handleCollapseAll}
                  className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-black flex items-center gap-1.5 border border-purple-200/80 transition-all shadow-2xs cursor-pointer"
                  title={collapsedSubjects.size === subjectPlans.length ? 'Expand All Subjects' : 'Collapse All Subjects'}
                >
                  {collapsedSubjects.size === subjectPlans.length ? (
                    <>
                      <ChevronsDown className="w-4 h-4 text-purple-600" /> Expand All
                    </>
                  ) : (
                    <>
                      <ChevronsUp className="w-4 h-4 text-purple-600" /> Collapse All
                    </>
                  )}
                </button>

                {isGate ? (
                  <button
                    onClick={handleResetToSeed}
                    className="px-3 py-2 rounded-xl bg-white border border-purple-200 hover:bg-purple-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    title="Reset syllabus plan to PW CS & DA seed data"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-purple-600" /> Reset PW Seed
                  </button>
                ) : (
                  <button
                    onClick={handleResetToSeed}
                    className="px-3 py-2 rounded-xl bg-white border border-purple-200 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    title="Clear lecture planner for this exam"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Clear Planner
                  </button>
                )}

                <button
                  onClick={() => setShowAddSubjectModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-pink-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Subject
                </button>
                <button
                  onClick={handleExportPlanJSON}
                  className="px-3 py-2 rounded-xl bg-white border border-purple-200 hover:bg-purple-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-purple-600" /> Export
                </button>
                <label className="cursor-pointer px-3 py-2 rounded-xl bg-white border border-purple-200 hover:bg-purple-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all">
                  <Upload className="w-3.5 h-3.5 text-purple-600" /> Import
                  <input type="file" accept=".json" onChange={handleImportPlanJSON} className="hidden" />
                </label>
              </div>
            </div>

            {/* Overall Progress Tracker Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 border border-purple-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  {isGate ? 'Overall Canonical Syllabus Completion' : 'Overall Syllabus & Lecture Completion'}
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  {totalCompletedLectures} / {totalGlobalLectures} Lectures Completed • {totalCompletedDPPs} / {totalGlobalDPPs} DPPs/CPPs Solved
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <div className="w-48 bg-white/80 rounded-full h-3 overflow-hidden border border-purple-200 p-0.5">
                  <div
                    className="bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] h-full rounded-full transition-all duration-500"
                    style={{ width: `${globalCompletionPct}%` }}
                  />
                </div>
                <span className="text-sm font-black font-mono text-purple-700">{globalCompletionPct}%</span>
              </div>
            </div>
          </GlassCard>

          {/* Subject Plans Accordion Grid */}
          <div className="space-y-6">
            {filteredSubjectPlans.length === 0 && (
              <GlassCard className="p-12 text-center space-y-4 border-dashed border-2 border-purple-200">
                <div className="w-16 h-16 rounded-3xl bg-purple-100/80 text-purple-600 flex items-center justify-center mx-auto shadow-inner">
                  <BookOpen className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h4 className="text-base font-black text-slate-900">
                    {subjectFilter !== 'All'
                      ? `No subjects match "${subjectFilter}"`
                      : isGate
                      ? 'No Lecture Plans Loaded'
                      : `No Lecture Planner for ${activeExam?.title || 'this Exam'}`}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {subjectFilter !== 'All'
                      ? 'Try clearing the subject filter or select "All Subjects".'
                      : isGate
                      ? 'Reset to official PW canonical seed data or import your lecture plans JSON.'
                      : 'This exam workspace is blank until you upload a syllabus PDF, import a lecture planner JSON, or add your first subject.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {isGate ? (
                    <button
                      onClick={handleResetToSeed}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-purple-500/20 cursor-pointer transition-all"
                    >
                      <RotateCcw className="w-4 h-4" /> Load Official PW Seed Data
                    </button>
                  ) : null}
                  <button
                    onClick={() => setShowAddSubjectModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] hover:opacity-95 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-pink-500/20 cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add First Subject
                  </button>
                  <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-white border border-purple-200 hover:bg-purple-50 text-slate-700 text-xs font-black flex items-center gap-2 shadow-xs transition-all">
                    <Upload className="w-4 h-4 text-purple-600" /> Import JSON
                    <input type="file" accept=".json" onChange={handleImportPlanJSON} className="hidden" />
                  </label>
                </div>
              </GlassCard>
            )}
            {filteredSubjectPlans.map((sub: SubjectPlan) => {
              const subTotalL = sub.chapters.reduce((acc: number, c: ChapterPlan) => acc + c.lecturesCount, 0);
              const subDoneL = sub.chapters.reduce((acc: number, c: ChapterPlan) => acc + c.lecturesCompleted, 0);
              const subTotalD = sub.chapters.reduce((acc: number, c: ChapterPlan) => acc + c.dppCount, 0);
              const subDoneD = sub.chapters.reduce((acc: number, c: ChapterPlan) => acc + c.dppsCompleted, 0);
              const subPct = subTotalL > 0 ? Math.round((subDoneL / subTotalL) * 100) : 0;
              const isCollapsed = collapsedSubjects.has(sub.id);

              return (
                <GlassCard key={sub.id} className="p-6 space-y-4 hover:border-purple-300 transition-all">
                  {/* Subject Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleCollapseSubject(sub.id)}
                        className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors border border-purple-200/60"
                        title={isCollapsed ? 'Expand Subject' : 'Collapse Subject'}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4 text-purple-600" />
                        ) : (
                          <ChevronUp className="w-4 h-4 text-purple-600" />
                        )}
                      </button>

                      <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#8b5cf6] to-[#ec4899] text-white font-black text-xs shadow-md">
                        {sub.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3
                          onClick={() => toggleCollapseSubject(sub.id)}
                          className="text-sm font-black text-slate-900 tracking-tight cursor-pointer hover:text-purple-700 transition-colors"
                        >
                          {sub.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {sub.chapters.length} Chapters • {subDoneL}/{subTotalL} Lectures • {subDoneD}/{subTotalD} DPPs
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Target Completion Timeline Date within Jan 1st Week 2027 */}
                      <div className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 px-3 py-1 rounded-xl border border-purple-200 text-xs font-bold text-purple-800 shadow-2xs">
                        <CalendarIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase">Target Completion:</span>
                        <input
                          type="date"
                          value={sub.targetCompletionDate || '2027-01-05'}
                          onChange={(e) => handleUpdateSubjectTargetDate(sub.id, e.target.value)}
                          className="bg-transparent font-mono font-black text-purple-900 text-xs focus:outline-none cursor-pointer"
                        />
                        <span className="text-[9px] bg-purple-600 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                          Jan 1st Wk 2027
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                        <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-purple-600 h-full rounded-full" style={{ width: `${subPct}%` }} />
                        </div>
                        <span className="text-xs font-black font-mono text-purple-700">{subPct}%</span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedSubjectId(sub.id);
                          setShowAddChapterModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold text-xs flex items-center gap-1 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Chapter
                      </button>

                      <button
                        onClick={() => {
                          setSubjectPlans((prev) => prev.filter((s) => s.id !== sub.id));
                          onShowNotification(`Deleted subject plan: ${sub.name}`, 'Lecture Planner');
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors"
                        title="Delete Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <>
                      {/* Visual Timeline to Strict Completion Deadline January 1st Week 2027 */}
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/60 to-pink-50/90 border border-purple-200/70 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-xl bg-gradient-to-tr from-[#8b5cf6] to-[#ec4899] text-white shrink-0 shadow-xs">
                            <CalendarIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-black text-slate-900">Timeline Target:</span>
                              <span className="text-xs font-mono font-black text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded-md border border-purple-200">
                                Jan 1st Week 2027 ({sub.targetCompletionDate || '2027-01-05'})
                              </span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                  subPct >= 30
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}
                              >
                                {subPct >= 30 ? 'On Track for Jan 2027' : 'Target Window Active'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                              Strict Target Completion: January 1st Week 2027 • Progress Relative to Target: {subPct}% Completed
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Syllabus Completion</span>
                            <span className="text-xs font-mono font-black text-purple-700">{subPct}% vs Target</span>
                          </div>
                          <div className="w-36 bg-white/90 rounded-full h-3 overflow-hidden border border-purple-200/90 relative p-0.5 shadow-2xs">
                            <div
                              className="bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] h-full rounded-full transition-all duration-500"
                              style={{ width: `${subPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Chapters List Table / Cards */}
                      <div className="space-y-2.5">
                        {sub.chapters.map((ch: ChapterPlan, idx: number) => (
                          <div
                            key={`${sub.id}-${ch.id}-${idx}`}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-300 transition-all shadow-2xs"
                          >
                            {/* Left: Chapter Name & Badge */}
                            <div className="flex items-center space-x-3 min-w-0">
                              <span className="text-[10px] font-mono font-black text-slate-400 shrink-0">
                                #{idx + 1}
                              </span>
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-900 truncate" title={ch.name}>
                                  {ch.name}
                                </h4>
                                <div className="flex items-center space-x-2 text-[10px] font-semibold text-slate-500 mt-0.5">
                                  <span className="text-purple-700 font-bold">{ch.lecturesCount} Lectures (L)</span>
                                  <span>•</span>
                                  <span className="text-pink-600 font-bold">
                                    {ch.dppCount} {ch.dppType}s
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Center: Controls & Editable Completion Inputs */}
                            <div className="flex items-center space-x-4 shrink-0">
                              {/* Lectures Controls with Editable Input */}
                              <div className="flex items-center space-x-1.5 bg-purple-50 p-1.5 rounded-xl border border-purple-100">
                                <span className="text-[10px] font-bold text-purple-700">L:</span>
                                <button
                                  onClick={() => handleUpdateChapterCounts(sub.id, ch.id, 'lecturesCompleted', -1)}
                                  className="w-5 h-5 rounded-md bg-white text-purple-700 hover:bg-purple-200 font-black text-xs flex items-center justify-center border border-purple-200"
                                  title="Decrease Completed Lectures"
                                >
                                  -
                                </button>
                                <div className="flex items-center space-x-1 font-mono font-black text-xs">
                                  <input
                                    type="number"
                                    min={0}
                                    value={ch.lecturesCompleted}
                                    onChange={(e) => handleDirectSetChapterCount(sub.id, ch.id, 'lecturesCompleted', parseInt(e.target.value) || 0)}
                                    className="w-10 bg-white border border-purple-200 rounded-md py-0.5 text-center text-purple-900 font-black text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                    title="Click or type to edit completed lectures count"
                                  />
                                  <span className="text-slate-400 font-bold">/</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={ch.lecturesCount}
                                    onChange={(e) => handleDirectSetChapterCount(sub.id, ch.id, 'lecturesCount', parseInt(e.target.value) || 1)}
                                    className="w-10 bg-white border border-purple-200 rounded-md py-0.5 text-center text-slate-700 font-bold text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                    title="Click or type to edit total lectures count"
                                  />
                                </div>
                                <button
                                  onClick={() => handleUpdateChapterCounts(sub.id, ch.id, 'lecturesCompleted', 1)}
                                  className="w-5 h-5 rounded-md bg-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs"
                                  title="Increase Completed Lectures"
                                >
                                  +
                                </button>
                              </div>

                              {/* DPP Controls with Editable Input */}
                              <div className="flex items-center space-x-1.5 bg-pink-50 p-1.5 rounded-xl border border-pink-100">
                                <span className="text-[10px] font-bold text-pink-700">{ch.dppType}:</span>
                                <button
                                  onClick={() => handleUpdateChapterCounts(sub.id, ch.id, 'dppsCompleted', -1)}
                                  className="w-5 h-5 rounded-md bg-white text-pink-700 hover:bg-pink-200 font-black text-xs flex items-center justify-center border border-pink-200"
                                  title="Decrease Completed DPPs"
                                >
                                  -
                                </button>
                                <div className="flex items-center space-x-1 font-mono font-black text-xs">
                                  <input
                                    type="number"
                                    min={0}
                                    value={ch.dppsCompleted}
                                    onChange={(e) => handleDirectSetChapterCount(sub.id, ch.id, 'dppsCompleted', parseInt(e.target.value) || 0)}
                                    className="w-10 bg-white border border-pink-200 rounded-md py-0.5 text-center text-pink-900 font-black text-xs focus:ring-1 focus:ring-pink-500 focus:outline-none"
                                    title="Click or type to edit completed DPPs count"
                                  />
                                  <span className="text-slate-400 font-bold">/</span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={ch.dppCount}
                                    onChange={(e) => handleDirectSetChapterCount(sub.id, ch.id, 'dppCount', parseInt(e.target.value) || 0)}
                                    className="w-10 bg-white border border-pink-200 rounded-md py-0.5 text-center text-slate-700 font-bold text-xs focus:ring-1 focus:ring-pink-500 focus:outline-none"
                                    title="Click or type to edit total DPPs count"
                                  />
                                </div>
                                <button
                                  onClick={() => handleUpdateChapterCounts(sub.id, ch.id, 'dppsCompleted', 1)}
                                  className="w-5 h-5 rounded-md bg-pink-600 text-white font-black text-xs flex items-center justify-center shadow-xs"
                                  title="Increase Completed DPPs"
                                >
                                  +
                                </button>
                              </div>

                              {/* Action Tools: Reorder, Duplicate, Delete */}
                              <div className="flex items-center space-x-1 border-l border-slate-200 pl-2">
                                <button
                                  onClick={() => handleMoveChapter(sub.id, idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-purple-600 disabled:opacity-30 transition-colors"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMoveChapter(sub.id, idx, 'down')}
                                  disabled={idx === sub.chapters.length - 1}
                                  className="p-1 text-slate-400 hover:text-purple-600 disabled:opacity-30 transition-colors"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDuplicateChapter(sub.id, ch)}
                                  className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                                  title="Duplicate Chapter"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteChapter(sub.id, ch.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Delete Chapter"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {sub.chapters.length === 0 && (
                          <div className="p-4 text-center text-xs font-bold text-slate-400 border border-dashed border-purple-200 rounded-2xl">
                            No chapters added to this subject yet. Click "Add Chapter" to build the canonical plan.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: ADD SUBJECT */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-600" /> Create Custom Subject Plan
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Subject Name:</label>
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="e.g. Artificial Intelligence & Machine Learning"
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-purple-100">
              <button
                onClick={() => setShowAddSubjectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubject}
                className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 shadow-md"
              >
                Create Subject
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* MODAL: ADD CHAPTER */}
      {showAddChapterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-600" /> Add Chapter to Syllabus
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Chapter Name:</label>
                <input
                  type="text"
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  placeholder="e.g. Pipelining Hazards & Data Forwarding"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-200 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Lectures (L):</label>
                  <input
                    type="number"
                    value={newLecturesCount}
                    onChange={(e) => setNewLecturesCount(parseInt(e.target.value) || 1)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-200 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">DPP/CPP Count:</label>
                  <input
                    type="number"
                    value={newDppCount}
                    onChange={(e) => setNewDppCount(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-200 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Type:</label>
                  <select
                    value={newDppType}
                    onChange={(e) => setNewDppType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-200 font-bold text-slate-800"
                  >
                    <option value="DPP">DPP</option>
                    <option value="CPP">CPP</option>
                    <option value="PYQ">PYQ</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-purple-100">
              <button
                onClick={() => setShowAddChapterModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddChapter}
                className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 shadow-md"
              >
                Add Chapter
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* MODAL: ADD TASK */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <Plus className="w-4 h-4 text-purple-600" /> Create Custom Study Task
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Task Title / Activity:</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Solve 20 GATE PYQs on Pipelining"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-100 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Subject:</label>
                  <select
                    value={newTaskSubject}
                    onChange={(e) => setNewTaskSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-100 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {availableSubjectOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Session Slot:</label>
                  <select
                    value={newTaskSlot}
                    onChange={(e) => setNewTaskSlot(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-100 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Estimated Duration (minutes):</label>
                <input
                  type="number"
                  value={newTaskMinutes}
                  onChange={(e) => setNewTaskMinutes(parseInt(e.target.value) || 30)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-100 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-purple-100">
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white shadow-md hover:opacity-95 transition-all"
              >
                Create Task
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
