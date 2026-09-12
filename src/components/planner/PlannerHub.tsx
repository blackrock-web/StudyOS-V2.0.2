import React, { useState, useEffect, useMemo } from 'react';
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
  Zap,
  BookOpen,
  Edit3,
  ArrowUp,
  ArrowDown,
  Layers,
  RotateCcw,
  AlertCircle,
  FileText,
  GripVertical,
  Bell,
  Repeat,
  X,
  Filter,
  Check,
  Search,
  CheckSquare,
  ListTodo,
  TrendingUp,
  Target,
  Bookmark,
  Sliders,
  Play,
} from 'lucide-react';
import { db } from '../../services/db';
import { syncService } from '../../services/syncService';
import { TaskItem } from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { UnifiedSyllabusCoverage } from './UnifiedSyllabusCoverage';
import { getAllSubjectOptions, getChaptersForSubject } from '../../data/subjectRegistry';
import { DailyScheduleSetupModal } from './DailyScheduleSetupModal';
import { LiveStudyTimerModal } from '../study/LiveStudyTimerModal';
import { useExam, RoutineSlotConfig, DEFAULT_ROUTINE_SLOTS } from '../../context/ExamContext';
import { RoutineSlotEditorModal } from './RoutineSlotEditorModal';

interface PlannerHubProps {
  onShowNotification: (msg: string, title?: string) => void;
  selectedDateStr?: string;
}

export const PlannerHub: React.FC<PlannerHubProps> = ({ onShowNotification }) => {
  // Current active date (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0] || '';
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // View Mode: 'month' | 'week' | 'day'
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  // Day Planner Modal Overlay state (opened when clicking a date in month/week view)
  const [showDayModal, setShowDayModal] = useState<boolean>(false);

  // All Tasks State from db
  const [tasks, setTasks] = useState<TaskItem[]>(() => db.getTasks());

  // Dynamic Exam Subjects
  const [examSubjects, setExamSubjects] = useState<string[]>(() => db.getCurrentExamSubjects());

  // Daily Schedule Setup Modal & Live Study Timer
  const [showDailySetupModal, setShowDailySetupModal] = useState<boolean>(false);
  const [liveStudyTask, setLiveStudyTask] = useState<TaskItem | null>(null);

  // Exam Context & Time Slots
  const {
    routineSlots = DEFAULT_ROUTINE_SLOTS,
    activeExam,
    activeExamId,
    isGate,
  } = useExam();

  const [showRoutineSlotEditor, setShowRoutineSlotEditor] = useState<boolean>(false);
  const [quickFocusSubject, setQuickFocusSubject] = useState<string>(() => db.getCurrentExamSubjects()[0] || 'General Studies');

  // Keep quickFocusSubject in sync whenever active exam or examSubjects change
  useEffect(() => {
    const currentSubs = db.getCurrentExamSubjects(activeExamId);
    setExamSubjects(currentSubs);
    if (currentSubs.length > 0 && !currentSubs.includes(quickFocusSubject)) {
      setQuickFocusSubject(currentSubs[0] || 'Core Subject');
    }
  }, [activeExamId, activeExam]);

  // Automatic pause & analytics sync on minimize/close
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && liveStudyTask) {
        // Automatically save analytics checkpoint
        db.saveDailyAvailability({
          date: todayStr,
          collegeOption: 'no_college',
          morningSlot: '6-9',
          specialPriority: 'focus_subject',
          commitments: [],
        });
      }
    };

    const handleBeforeUnload = () => {
      // Sync analytics before close
      try {
        db.setTasks(db.getTasks());
      } catch (e) {
        console.error(e);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [liveStudyTask, todayStr]);

  // Day Offset calculations for Today, Tomorrow, Day After Tomorrow, etc.
  const getDayOffsetDateStr = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0] || '';
  };

  const getDayOffsetLabel = (offsetDays: number): { label: string; dateFormatted: string; dateStr: string; dayName: string } => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toISOString().split('T')[0] || '';
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

    let label = `${dayName}, ${dateFormatted}`;
    if (offsetDays === 0) label = 'Today';
    else if (offsetDays === 1) label = 'Tomorrow';
    else if (offsetDays === 2) label = 'Day After Tomorrow';

    return { label, dateFormatted, dateStr, dayName };
  };

  const dayStripItems = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
      const item = getDayOffsetLabel(offset);
      const dayTasks = tasks.filter((t) => t.dueDate === item.dateStr);
      const doneCount = dayTasks.filter((t) => t.completed || t.status === 'Completed').length;
      return {
        ...item,
        offset,
        taskCount: dayTasks.length,
        doneCount,
        isCompleted: dayTasks.length > 0 && doneCount === dayTasks.length,
      };
    });
  }, [tasks]);

  const handleStartSingleSubjectFocus = (
    subject?: string,
    minutes?: number,
    slot?: string,
    customTopic?: string,
    priority?: TaskItem['priority']
  ) => {
    const chosenSub = subject || quickFocusSubject || (examSubjects[0] || 'Core Subject');
    const chosenMins = minutes || 60;
    const chosenSlot = slot || (routineSlots[0]?.name || 'Morning');
    const topicText = customTopic !== undefined ? customTopic : '';
    const sessionTitle = topicText.trim()
      ? `${chosenSub}: ${topicText.trim()}`
      : `${chosenSub} Single-Subject Focus Session`;
    const chosenPriority = priority || 'High';

    const focusTask: TaskItem = {
      id: 'focus-' + Date.now(),
      title: sessionTitle,
      type: 'Study Session',
      subject: chosenSub,
      dueDate: selectedDate || todayStr,
      timeSlot: chosenSlot as any,
      priority: chosenPriority,
      status: 'In Progress',
      estimatedMinutes: chosenMins,
      completed: false,
      notes: `Single-subject concentration sprint for ${chosenSub} scheduled in ${chosenSlot} slot.`,
    };

    // 1. Sync & Add to persistent storage
    syncService.addTask(focusTask);

    // 2. Sync to Focus Mode Plan so that the whole Single Subject Focus Tracker reflects this active subject
    try {
      db.saveFocusModePlan({
        subjectName: chosenSub,
      });
    } catch (e) {
      console.error(e);
    }

    // 3. Immediately refresh local tasks state so it appears in the timetable slot card and day planner summary
    setTasks(db.getTasks());

    // 4. Start the live study timer modal immediately with running timer
    setLiveStudyTask(focusTask);

    if (onShowNotification) {
      onShowNotification(
        `Added to ${chosenSlot} slot and started ${chosenMins}m focus timer on ${chosenSub}!`,
        'Single-Subject Focus Started'
      );
    }
  };

  const getSlotThemeStyles = (color?: string) => {
    switch (color) {
      case 'amber':
        return {
          cardBg: 'bg-amber-50/70 border-amber-200/90 hover:border-amber-400',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
          headerIconBg: 'bg-amber-100 text-amber-700',
          accentText: 'text-amber-900',
        };
      case 'orange':
        return {
          cardBg: 'bg-orange-50/70 border-orange-200/90 hover:border-orange-400',
          badgeBg: 'bg-orange-100 text-orange-900 border-orange-200',
          headerIconBg: 'bg-orange-100 text-orange-700',
          accentText: 'text-orange-900',
        };
      case 'sky':
        return {
          cardBg: 'bg-sky-50/70 border-sky-200/90 hover:border-sky-400',
          badgeBg: 'bg-sky-100 text-sky-900 border-sky-200',
          headerIconBg: 'bg-sky-100 text-sky-700',
          accentText: 'text-sky-900',
        };
      case 'purple':
        return {
          cardBg: 'bg-purple-50/70 border-purple-200/90 hover:border-purple-400',
          badgeBg: 'bg-purple-100 text-purple-900 border-purple-200',
          headerIconBg: 'bg-purple-100 text-purple-700',
          accentText: 'text-purple-900',
        };
      case 'emerald':
        return {
          cardBg: 'bg-emerald-50/70 border-emerald-200/90 hover:border-emerald-400',
          badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
          headerIconBg: 'bg-emerald-100 text-emerald-700',
          accentText: 'text-emerald-900',
        };
      case 'rose':
        return {
          cardBg: 'bg-rose-50/70 border-rose-200/90 hover:border-rose-400',
          badgeBg: 'bg-rose-100 text-rose-900 border-rose-200',
          headerIconBg: 'bg-rose-100 text-rose-700',
          accentText: 'text-rose-900',
        };
      case 'indigo':
      default:
        return {
          cardBg: 'bg-indigo-50/70 border-indigo-200/90 hover:border-indigo-400',
          badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-200',
          headerIconBg: 'bg-indigo-100 text-indigo-700',
          accentText: 'text-indigo-900',
        };
    }
  };

  // Listen to DB task updates and exam updates
  useEffect(() => {
    const syncTasks = () => {
      setTasks(db.getTasks());
      setExamSubjects(db.getCurrentExamSubjects());
    };
    window.addEventListener('studyos_tasks_updated', syncTasks);
    window.addEventListener('studyos_active_exam_changed', syncTasks);
    window.addEventListener('studyos_exams_updated', syncTasks);
    window.addEventListener('studyos_syllabus_updated', syncTasks);
    window.addEventListener('studyos_db_updated', syncTasks);
    window.addEventListener('storage', syncTasks);
    return () => {
      window.removeEventListener('studyos_tasks_updated', syncTasks);
      window.removeEventListener('studyos_active_exam_changed', syncTasks);
      window.removeEventListener('studyos_exams_updated', syncTasks);
      window.removeEventListener('studyos_syllabus_updated', syncTasks);
      window.removeEventListener('studyos_db_updated', syncTasks);
      window.removeEventListener('storage', syncTasks);
    };
  }, []);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Task Form Modal State (Create or Edit)
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<TaskItem['type']>('Lecture');
  const [formSubject, setFormSubject] = useState(() => db.getCurrentExamSubjects()[0] || 'General Studies');
  const [formDate, setFormDate] = useState(todayStr);
  const [formTimeSlot, setFormTimeSlot] = useState<TaskItem['timeSlot']>('Morning');
  const [formPriority, setFormPriority] = useState<TaskItem['priority']>('High');
  const [formStatus, setFormStatus] = useState<'Pending' | 'In Progress' | 'Completed' | 'Incomplete'>('Pending');
  const [formEstimatedMinutes, setFormEstimatedMinutes] = useState(60);
  const [formReminder, setFormReminder] = useState(false);
  const [formReminderTime, setFormReminderTime] = useState('09:00');
  const [formRecurring, setFormRecurring] = useState<'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Day-wise'>('None');
  const [formNotes, setFormNotes] = useState('');

  // Drag and drop state for task reordering
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Month navigation state (year, month: 0-indexed)
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth());

  // Week navigation state (start date of current week)
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    return new Date(d.setDate(diff));
  });

  // Open modal for new task creation
  const handleOpenNewTaskModal = (defaultDate?: string, defaultSlot?: TaskItem['timeSlot']) => {
    setEditingTask(null);
    setFormTitle('');
    setFormType('Lecture');
    setFormSubject(quickFocusSubject || db.getCurrentExamSubjects()[0] || 'General Studies');
    setFormDate(defaultDate || selectedDate);
    setFormTimeSlot(defaultSlot || 'Morning');
    setFormPriority('High');
    setFormStatus('Pending');
    setFormEstimatedMinutes(60);
    setFormReminder(false);
    setFormReminderTime('09:00');
    setFormRecurring('None');
    setFormNotes('');
    setShowTaskModal(true);
  };

  // Open modal to edit existing task
  const handleOpenEditTaskModal = (task: TaskItem) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormType(task.type || 'Custom');
    setFormSubject(task.subject || db.getCurrentExamSubjects()[0] || 'General Studies');
    setFormDate(task.dueDate || selectedDate);
    setFormTimeSlot(task.timeSlot || 'Morning');
    setFormPriority(task.priority || 'Medium');
    setFormStatus(task.status || (task.completed ? 'Completed' : 'Pending'));
    setFormEstimatedMinutes(task.estimatedMinutes || 60);
    setFormReminder(!!task.reminder);
    setFormReminderTime(task.reminderTime || '09:00');
    setFormRecurring(task.recurring || 'None');
    setFormNotes(task.notes || '');
    setShowTaskModal(true);
  };

  // Save Task (Create or Update)
  const handleSaveTask = () => {
    if (!formTitle.trim()) return;

    const isDone = formStatus === 'Completed';

    if (editingTask) {
      const updated: TaskItem = {
        ...editingTask,
        title: formTitle.trim(),
        type: formType,
        subject: formSubject,
        dueDate: formDate,
        timeSlot: formTimeSlot,
        priority: formPriority,
        status: formStatus,
        completed: isDone,
        completedAt: isDone ? editingTask.completedAt || new Date().toISOString() : undefined,
        estimatedMinutes: formEstimatedMinutes,
        reminder: formReminder,
        reminderTime: formReminderTime,
        recurring: formRecurring,
        notes: formNotes,
      };
      syncService.updateTask(updated);
      onShowNotification(`Updated task "${updated.title}"`, 'Planner Hub');
    } else {
      const newTask: TaskItem = {
        id: 'task-' + Date.now(),
        title: formTitle.trim(),
        type: formType,
        subject: formSubject,
        dueDate: formDate,
        timeSlot: formTimeSlot,
        priority: formPriority,
        status: formStatus,
        completed: isDone,
        completedAt: isDone ? new Date().toISOString() : undefined,
        estimatedMinutes: formEstimatedMinutes,
        reminder: formReminder,
        reminderTime: formReminderTime,
        recurring: formRecurring,
        notes: formNotes,
        order: Date.now(),
      };
      syncService.addTask(newTask);
      onShowNotification(`Added new item "${newTask.title}"`, 'Planner Hub');
    }

    setTasks(syncService.getTasks());
    setShowTaskModal(false);
  };

  // Delete Task
  const handleDeleteTask = (id: string, title: string) => {
    syncService.deleteTask(id);
    setTasks(syncService.getTasks());
    onShowNotification(`Deleted item "${title}"`, 'Planner Hub');
  };

  // Toggle Status directly (Pending -> In Progress -> Completed -> Pending)
  const handleCycleStatus = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    let nextStatus: 'Pending' | 'In Progress' | 'Completed' = 'In Progress';
    const currentStatus = task.status || (task.completed ? 'Completed' : 'Pending');

    if (currentStatus === 'Pending') nextStatus = 'In Progress';
    else if (currentStatus === 'In Progress') nextStatus = 'Completed';
    else nextStatus = 'Pending';

    const isDone = nextStatus === 'Completed';
    const updated: TaskItem = {
      ...task,
      status: nextStatus,
      completed: isDone,
      completedAt: isDone ? new Date().toISOString() : undefined,
    };

    db.updateTask(updated);
    setTasks(db.getTasks());
    onShowNotification(`Task status changed to "${nextStatus}"`, 'Planner Hub');
  };

  // Move task up/down in list
  const handleMoveTaskOrder = (task: TaskItem, direction: 'up' | 'down') => {
    const dateTasks = tasks.filter((t) => t.dueDate === task.dueDate);
    const index = dateTasks.findIndex((t) => t.id === task.id);
    if (index === -1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= dateTasks.length || !dateTasks[targetIdx]) return;

    const swappedTasks = [...tasks];
    const idx1 = swappedTasks.findIndex((t) => t.id === task.id);
    const idx2 = swappedTasks.findIndex((t) => t.id === dateTasks[targetIdx]!.id);

    if (idx1 !== -1 && idx2 !== -1 && swappedTasks[idx1] && swappedTasks[idx2]) {
      const temp = swappedTasks[idx1]!;
      swappedTasks[idx1] = swappedTasks[idx2]!;
      swappedTasks[idx2] = temp;
      db.setTasks(swappedTasks);
      setTasks(swappedTasks);
      onShowNotification('Task reordered', 'Planner Hub');
    }
  };

  // Drag and Drop reordering handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnTask = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) return;

    const all = [...tasks];
    const dragIdx = all.findIndex((t) => t.id === draggedTaskId);
    const dropIdx = all.findIndex((t) => t.id === targetTaskId);

    if (dragIdx !== -1 && dropIdx !== -1) {
      const [removed] = all.splice(dragIdx, 1);
      if (removed) {
        all.splice(dropIdx, 0, removed);
        db.setTasks(all);
        setTasks(all);
        onShowNotification('Task reordered via drag-and-drop', 'Planner Hub');
      }
    }
    setDraggedTaskId(null);
  };

  // Date selection helper
  const handleSelectDate = (dateStr: string, openModal = true) => {
    setSelectedDate(dateStr);
    if (openModal && (viewMode === 'month' || viewMode === 'week')) {
      setShowDayModal(true);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleMonthToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(todayStr);
  };

  // Week navigation helpers
  const handlePrevWeek = () => {
    setWeekStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setWeekStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleWeekToday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    setWeekStartDate(new Date(d.setDate(diff)));
    setSelectedDate(todayStr);
  };

  // Get days in month grid (includes padding days from prev/next months)
  const getMonthGridDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // Monday is index 0 in our grid
    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx === -1) startDayIdx = 6; // Sunday -> 6

    const totalDays = lastDay.getDate();
    const daysArr = [];

    // Prev month padding
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayIdx - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      daysArr.push({ dayNum, dateStr, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysArr.push({ dayNum: d, dateStr, isCurrentMonth: true });
    }

    // Next month padding to fill grid (up to 35 or 42 cells)
    const remaining = (7 - (daysArr.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      daysArr.push({ dayNum: i, dateStr, isCurrentMonth: false });
    }

    return daysArr;
  };

  // Get days in week array
  const getWeekDays = () => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      arr.push({ dateStr, dayName, dayNum });
    }
    return arr;
  };

  // Tasks filtered by global search / subject / priority / status (memoized for high performance)
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchSub = t.subject.toLowerCase().includes(q);
        const matchNotes = t.notes?.toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchNotes) return false;
      }

      if (subjectFilter !== 'All' && t.subject !== subjectFilter) return false;

      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;

      if (statusFilter !== 'All') {
        const st = t.status || (t.completed ? 'Completed' : 'Pending');
        if (st !== statusFilter) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, subjectFilter, priorityFilter, statusFilter]);

  // Calculate statistics for selected date
  const selectedDateTasks = filteredTasks.filter((t) => t.dueDate === selectedDate);
  const dateCompletedTasks = selectedDateTasks.filter((t) => t.completed || t.status === 'Completed');
  const datePendingTasks = selectedDateTasks.filter((t) => !t.completed && t.status !== 'Completed');
  const dateHighPriorityCount = selectedDateTasks.filter((t) => t.priority === 'High').length;
  const dateCompletionPct = selectedDateTasks.length > 0 ? Math.round((dateCompletedTasks.length / selectedDateTasks.length) * 100) : 0;
  const dateTotalMinutes = selectedDateTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

  // Month Statistics
  const monthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const monthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;
  const monthTasks = tasks.filter((t) => t.dueDate >= monthStartStr && t.dueDate <= monthEndStr);
  const monthCompletedTasks = monthTasks.filter((t) => t.completed || t.status === 'Completed');
  const monthCompletionPct = monthTasks.length > 0 ? Math.round((monthCompletedTasks.length / monthTasks.length) * 100) : 0;

  // Month Name string
  const monthNameStr = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  // Priority Badge Color Helper
  const getPriorityBadgeClass = (priority: TaskItem['priority']) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-100 text-rose-800 border-rose-200 font-extrabold';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border-amber-200 font-bold';
      case 'Low':
        return 'bg-slate-100 text-slate-700 border-slate-200 font-semibold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Status Badge Color Helper
  const getStatusBadgeClass = (status?: string, completed?: boolean) => {
    const st = status || (completed ? 'Completed' : 'Pending');
    switch (st) {
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 font-extrabold';
      case 'In Progress':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 font-extrabold';
      case 'Pending':
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200 font-bold';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & CALENDAR CONTROLS BAR */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-purple-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-md">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Planner Hub</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 border border-purple-200">
                    Merged Calendar & Schedule
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Unified calendar with Daily, Weekly, Timetable, Tasks, and Revision Schedule integration.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher: Month / Week / Day Planner / AI Planner */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'month' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'week' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'day' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Day Planner
              </button>
              <button
            </div>
          </div>
        </div>

        {/* Filters Bar & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, subjects, topics, or notes..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white/80"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Filter className="w-3.5 h-3.5 text-purple-600" />
              <span>Filters:</span>
            </div>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 max-w-[180px]"
            >
              <option value="All">All Subjects</option>
              {(examSubjects.length > 0 ? examSubjects : getAllSubjectOptions()).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* 2. CALENDAR MONTH VIEW */}
      {viewMode === 'month' && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-purple-100 pb-3">
            <div className="flex items-center space-x-3">
              <h3 className="text-base font-black text-slate-900 tracking-tight">{monthNameStr}</h3>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleMonthToday}
                  className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 block">Month Progress</span>
                <span className="text-xs font-mono font-black text-purple-700">
                  {monthCompletedTasks.length}/{monthTasks.length} Done ({monthCompletionPct}%)
                </span>
              </div>
              <div className="w-24 bg-slate-200 rounded-full h-2.5 overflow-hidden border border-purple-200 p-0.5">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-full rounded-full transition-all duration-500" style={{ width: `${monthCompletionPct}%` }} />
              </div>
            </div>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="text-center text-[11px] font-black uppercase text-slate-400 py-1.5">
                {day}
              </div>
            ))}

            {getMonthGridDays().map((cell, idx) => {
              const dateTasks = filteredTasks.filter((t) => t.dueDate === cell.dateStr);
              const doneCount = dateTasks.filter((t) => t.completed || t.status === 'Completed').length;
              const hasHighPriority = dateTasks.some((t) => t.priority === 'High' && !t.completed);
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;
              const datePct = dateTasks.length > 0 ? Math.round((doneCount / dateTasks.length) * 100) : 0;

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectDate(cell.dateStr, true)}
                  className={`min-h-[105px] p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between hover:scale-[1.02] hover:z-10 ${
                    cell.isCurrentMonth ? 'bg-white border-slate-200/90 shadow-2xs hover:border-purple-300' : 'bg-slate-50/60 border-slate-200/50 text-slate-400'
                  } ${isToday ? 'ring-2 ring-purple-600 bg-purple-50/50 border-purple-300 shadow-xs' : ''} ${
                    isSelected ? 'shadow-md border-purple-500 ring-1 ring-purple-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black ${isToday ? 'text-purple-700 font-mono text-sm' : cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                      {cell.dayNum}
                    </span>
                    {isToday && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-purple-600 text-white">
                        Today
                      </span>
                    )}
                    {hasHighPriority && !isToday && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="High priority task pending" />
                    )}
                  </div>

                  {/* Tasks Preview Badges inside Cell */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {dateTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded truncate border ${
                          t.completed || t.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through'
                            : t.priority === 'High'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dateTasks.length > 2 && (
                      <div className="text-[9px] font-bold text-slate-400 pl-1">
                        +{dateTasks.length - 2} more items
                      </div>
                    )}
                  </div>

                  {/* Cell Bottom Progress Indicator */}
                  {dateTasks.length > 0 && (
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono text-slate-500 font-bold">
                      <span>{doneCount}/{dateTasks.length}</span>
                      <span className="text-purple-600">{datePct}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* 3. CALENDAR WEEK VIEW */}
      {viewMode === 'week' && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-purple-100 pb-3">
            <div className="flex items-center space-x-3">
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Weekly Schedule ({getWeekDays()[0]?.dateStr} to {getWeekDays()[6]?.dateStr})
              </h3>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrevWeek}
                  className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleWeekToday}
                  className="px-3 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold cursor-pointer"
                >
                  Current Week
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {getWeekDays().map((day) => {
              const dayTasks = filteredTasks.filter((t) => t.dueDate === day.dateStr);
              const doneCount = dayTasks.filter((t) => t.completed || t.status === 'Completed').length;
              const isToday = day.dateStr === todayStr;
              const pct = dayTasks.length > 0 ? Math.round((doneCount / dayTasks.length) * 100) : 0;

              return (
                <div
                  key={day.dateStr}
                  className={`p-3 rounded-2xl border flex flex-col justify-between space-y-2 min-h-[320px] transition-all ${
                    isToday ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-400/50' : 'bg-white/90 border-slate-200'
                  }`}
                >
                  {/* Day Column Header */}
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1">
                        <span>{day.dayName}</span>
                        <span className="font-mono text-purple-700">{day.dayNum}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">{day.dateStr}</div>
                    </div>
                    <button
                      onClick={() => handleOpenNewTaskModal(day.dateStr)}
                      className="p-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors cursor-pointer"
                      title="Add task to this date"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tasks List inside Day Column */}
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] custom-scrollbar pr-0.5">
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => handleOpenEditTaskModal(t)}
                        className={`p-2 rounded-xl border text-xs space-y-1 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-sm ${
                          t.completed || t.status === 'Completed'
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className={`font-bold leading-tight ${t.completed ? 'line-through text-slate-400' : ''}`}>
                            {t.title}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCycleStatus(t.id);
                            }}
                            className="shrink-0 cursor-pointer"
                          >
                            <CheckCircle2 className={`w-4 h-4 ${t.completed ? 'text-emerald-600' : 'text-slate-300 hover:text-purple-600'}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-500 pt-1">
                          <span className="text-purple-700">{t.subject}</span>
                          <span className={`px-1.5 py-0.2 rounded border ${getPriorityBadgeClass(t.priority)}`}>
                            {t.priority}
                          </span>
                        </div>
                      </div>
                    ))}

                    {dayTasks.length === 0 && (
                      <div className="p-4 text-center text-[11px] font-bold text-slate-300 border border-dashed border-slate-200 rounded-xl">
                        No tasks
                      </div>
                    )}
                  </div>

                  {/* Progress Bar Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-500">{doneCount}/{dayTasks.length} Done</span>
                    <button
                      onClick={() => handleSelectDate(day.dateStr || '', true)}
                      className="text-purple-600 hover:underline cursor-pointer"
                    >
                      Open Day →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* 4. DAY PLANNER VIEW (Primary Date Detailed Overview) */}
      {(viewMode === 'day' || showDayModal) && (
        <div className={showDayModal ? 'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4' : 'space-y-6'}>
          <GlassCard className={`p-6 space-y-6 shadow-xl bg-white text-slate-900 ${showDayModal ? 'max-w-5xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar' : ''}`}>
            {/* Day Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-sm shadow-md">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Day Planner: {selectedDate}</span>
                    {selectedDate === todayStr && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-600 text-white">
                        Today
                      </span>
                    )}
                    {selectedDate === getDayOffsetDateStr(1) && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-600 text-white">
                        Tomorrow
                      </span>
                    )}
                    {selectedDate === getDayOffsetDateStr(2) && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-pink-600 text-white">
                        Day After Tomorrow
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Breakdown of customizable timetable routine slots, single-subject focus sprints, and task progress.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowDailySetupModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Configure Daily Routine & Constraints"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Daily Setup</span>
                </button>

                <button
                  onClick={() => setShowRoutineSlotEditor(true)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Configure Routine Time Slots"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Edit Time Slots</span>
                </button>

                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().split('T')[0] || '');
                  }}
                  className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().split('T')[0] || '');
                  }}
                  className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {showDayModal && (
                  <button
                    onClick={() => setShowDayModal(false)}
                    className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 ml-2 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* UPGRADED DAY NAVIGATOR STRIP (Today, Tomorrow, Day After Tomorrow, etc.) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-600 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-purple-600" /> Fast Day Switcher & Schedule Overview
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs font-bold text-slate-700 px-2 py-1 rounded-lg border border-purple-200 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {dayStripItems.map((day) => {
                  const isSelected = selectedDate === day.dateStr;
                  const isToday = day.offset === 0;

                  return (
                    <button
                      key={day.dateStr}
                      onClick={() => setSelectedDate(day.dateStr)}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-400/40'
                          : 'bg-white hover:bg-purple-50/60 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-black uppercase tracking-tight ${isSelected ? 'text-purple-100' : 'text-slate-500'}`}>
                          {day.label}
                        </span>
                        {isToday && (
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-purple-600'}`} />
                        )}
                      </div>

                      <div className="mt-1 flex items-baseline justify-between">
                        <span className={`text-sm font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {day.dateFormatted}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                          isSelected
                            ? 'bg-purple-700/80 text-purple-100'
                            : day.taskCount > 0
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {day.taskCount > 0 ? `${day.doneCount}/${day.taskCount} done` : 'No tasks'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day Stat Summary Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 border border-purple-200/80">
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Total Scheduled</span>
                <span className="text-base font-black text-slate-900 font-mono">{selectedDateTasks.length} Items ({dateTotalMinutes} mins)</span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Completed Tasks</span>
                <span className="text-base font-black text-emerald-600 font-mono">{dateCompletedTasks.length} / {selectedDateTasks.length}</span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase block">High Priority Pending</span>
                <span className="text-base font-black text-rose-600 font-mono">{dateHighPriorityCount} High Priority</span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Daily Completion</span>
                <span className="text-base font-black text-purple-700 font-mono">{dateCompletionPct}% Completed</span>
              </div>
            </div>

            {/* Timetable Slots Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" /> Timetable Routine Slots
                  </h4>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                    {routineSlots.length} Active Slots
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowRoutineSlotEditor(true)}
                    className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" /> Edit Slots
                  </button>
                  <button
                    onClick={() => handleOpenNewTaskModal(selectedDate)}
                    className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Task
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Dynamically configured routine slots */}
                {routineSlots.map((slot) => {
                  // Filter tasks matching this slot (by slot name or slot id or default name)
                  const slotTasks = selectedDateTasks.filter((t) => {
                    if (t.timeSlot === slot.name || t.timeSlot === slot.id) return true;
                    if (slot.name.toLowerCase().includes('morning') && t.timeSlot === 'Morning') return true;
                    if (slot.name.toLowerCase().includes('afternoon') && t.timeSlot === 'Afternoon') return true;
                    if (slot.name.toLowerCase().includes('evening') && t.timeSlot === 'Evening') return true;
                    if (slot.name.toLowerCase().includes('night') && t.timeSlot === 'Night') return true;
                    return false;
                  });

                  const theme = getSlotThemeStyles(slot.color);

                  return (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-2xl border space-y-3 transition-all ${theme.cardBg}`}
                    >
                      <div className="flex items-center justify-between border-b pb-2 border-slate-200/80">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg ${theme.headerIconBg}`}>
                            {slot.name.toLowerCase().includes('morning') ? (
                              <Sunrise className="w-4 h-4" />
                            ) : slot.name.toLowerCase().includes('afternoon') ? (
                              <Sun className="w-4 h-4" />
                            ) : slot.name.toLowerCase().includes('evening') ? (
                              <Zap className="w-4 h-4" />
                            ) : (
                              <Moon className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block">{slot.name}</span>
                            <span className="text-[10px] font-mono text-slate-600 font-bold">
                              {slot.startTime} - {slot.endTime}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenNewTaskModal(selectedDate, slot.name as any)}
                            className="p-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                            title={`Add task to ${slot.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Focus Tag & Single Subject Launch */}
                      <div className="flex items-center justify-between pt-0.5">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${theme.badgeBg}`}>
                          {slot.focusType || 'Study Slot'}
                        </span>
                        <button
                          onClick={() => handleStartSingleSubjectFocus(quickFocusSubject, 60, slot.name)}
                          className="text-[10px] font-black text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-md border border-purple-200 hover:bg-purple-50"
                          title={`Start Single-Subject Focus in ${slot.name} slot`}
                        >
                          <Target className="w-3 h-3" /> Focus Slot
                        </button>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2">
                        {slotTasks.map((t) => {
                          const isBeingDragged = draggedTaskId === t.id;
                          return (
                            <div
                              key={t.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, t.id)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDropOnTask(e, t.id)}
                              className={`p-3 rounded-xl border space-y-1.5 transition-all duration-200 hover:shadow-md ${
                                isBeingDragged
                                  ? 'opacity-40 scale-[0.98] ring-2 ring-purple-400 border-dashed border-purple-400 bg-purple-50/50 shadow-xl'
                                  : t.completed
                                  ? 'bg-white opacity-85 border-emerald-300'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              {/* Drop indicator line when dragging over another task */}
                              {draggedTaskId && draggedTaskId !== t.id && (
                                <div className="hidden group-hover:block h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full my-0.5 animate-pulse" />
                              )}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center space-x-2 min-w-0">
                                  <span className="text-slate-300 cursor-grab hover:text-slate-500" title="Drag to reorder">
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </span>
                                  <button
                                    onClick={() => handleCycleStatus(t.id)}
                                    className="cursor-pointer"
                                    title="Click to cycle status: Pending -> In Progress -> Completed"
                                  >
                                    <CheckCircle2 className={`w-4 h-4 ${t.completed ? 'text-emerald-600' : 'text-slate-300 hover:text-purple-600'}`} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditTaskModal(t)}
                                    className="text-left font-extrabold hover:text-purple-700 transition-colors cursor-pointer truncate"
                                    title="Click to edit task"
                                  >
                                    <span className={`text-xs ${t.completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                      {t.title}
                                    </span>
                                  </button>
                                </div>

                                <div className="flex items-center space-x-1 shrink-0">
                                  <button
                                    onClick={() => handleStartSingleSubjectFocus(t.subject, t.estimatedMinutes || 60, t.timeSlot, t.title, t.priority)}
                                    className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors cursor-pointer"
                                    title={`Start Single Subject Focus on ${t.title}`}
                                  >
                                    <Target className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setLiveStudyTask(t)}
                                    className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                    title="Start Live Study Session"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditTaskModal(t)}
                                    className="p-1 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                                    title="Edit Task"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(t.id, t.title)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Tags & Badges */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                                <span className="font-extrabold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  {t.subject}
                                </span>
                                <span className={`px-2 py-0.5 rounded border ${getPriorityBadgeClass(t.priority)}`}>
                                  {t.priority}
                                </span>
                                <span className={`px-2 py-0.5 rounded border ${getStatusBadgeClass(t.status, t.completed)}`}>
                                  {t.status || (t.completed ? 'Completed' : 'Pending')}
                                </span>
                                {t.recurring && t.recurring !== 'None' && (
                                  <span className="flex items-center gap-1 font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                                    <Repeat className="w-3 h-3" /> {t.recurring}
                                  </span>
                                )}
                                {t.reminder && (
                                  <span className="flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    <Bell className="w-3 h-3" /> {t.reminderTime || 'Alert'}
                                  </span>
                                )}
                                <span className="font-mono text-slate-600 font-bold ml-auto">{t.estimatedMinutes} mins</span>
                              </div>

                              {t.notes && (
                                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg italic border border-slate-100 mt-1">
                                  {t.notes}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {slotTasks.length === 0 && (
                          <div className="p-4 text-center text-xs font-bold text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/60">
                            No items scheduled for {slot.name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        </div>
      )}



      {/* 4. UNIFIED SYLLABUS, LECTURE PLANNER & STUDY PROGRESS COVERAGE ENGINE */}
      <UnifiedSyllabusCoverage
        onShowNotification={onShowNotification}
        externalSubjectFilter={subjectFilter}
      />

      {/* 5. MODAL FOR CREATE / EDIT TASK */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-lg w-full p-6 space-y-4 shadow-2xl bg-white">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-purple-600" />
                <span>{editingTask ? 'Edit Schedule Item' : 'Create New Planner Item'}</span>
              </h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Item Title / Task Description *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Solve 15 PYQs on Dynamic Programming"
                  required
                  className="w-full p-2.5 rounded-xl border border-purple-200 font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 bg-white"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Revision">Revision</option>
                    <option value="DPP">DPP / CPP</option>
                    <option value="Mock">Mock Test</option>
                    <option value="Assignment">Assignment</option>
                    <option value="Notes">Notes Writing</option>
                    <option value="Flashcards">Flashcards</option>
                    <option value="PYQs">PYQs Practice</option>
                    <option value="Study Session">Study Session</option>
                    <option value="Pomodoro">Pomodoro Session</option>
                    <option value="Custom">Custom Task</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 bg-white"
                  >
                    {(examSubjects.length > 0 ? examSubjects : getAllSubjectOptions()).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Routine Slot</label>
                  <select
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-slate-200 font-bold text-slate-800 bg-white"
                  >
                    <option value="Morning">Morning (06:00-09:00)</option>
                    <option value="Afternoon">Afternoon (13:30-17:30)</option>
                    <option value="Evening">Evening (19:00-21:00)</option>
                    <option value="Night">Night (22:00-00:00)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Est. Minutes</label>
                  <input
                    type="number"
                    value={formEstimatedMinutes}
                    onChange={(e) => setFormEstimatedMinutes(parseInt(e.target.value) || 30)}
                    className="w-full p-2 rounded-xl border border-slate-200 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-slate-200 font-bold text-slate-800 bg-white"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-slate-200 font-bold text-slate-800 bg-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-purple-50/50 border border-purple-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Recurring Task</label>
                  <select
                    value={formRecurring}
                    onChange={(e) => setFormRecurring(e.target.value as any)}
                    className="w-full p-2 rounded-xl border border-purple-200 text-xs font-bold text-purple-900 bg-white"
                  >
                    <option value="None">Does not repeat</option>
                    <option value="Daily">Repeat Daily</option>
                    <option value="Weekly">Repeat Weekly</option>
                    <option value="Monthly">Repeat Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center space-x-2 font-bold text-slate-700 mb-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formReminder}
                      onChange={(e) => setFormReminder(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded border-slate-300"
                    />
                    <span>Set Reminder Alarm</span>
                  </label>
                  {formReminder && (
                    <input
                      type="time"
                      value={formReminderTime}
                      onChange={(e) => setFormReminderTime(e.target.value)}
                      className="w-full p-1.5 rounded-xl border border-purple-200 text-xs font-mono font-bold"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Details (Optional)</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Key goals, textbook page numbers, or formulas to remember..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-purple-100">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTask}
                className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 shadow-md cursor-pointer"
              >
                {editingTask ? 'Save Changes' : 'Add to Schedule'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Daily College & Availability Auto-Scheduler Modal */}
      <DailyScheduleSetupModal
        isOpen={showDailySetupModal}
        onClose={() => setShowDailySetupModal(false)}
        targetDate={selectedDate}
        onScheduleGenerated={() => {
          setTasks(db.getTasks());
          onShowNotification('Generated conflict-free daily study schedule', 'Auto-Scheduler');
        }}
      />
{/* Live Study Session Timer */}
      {liveStudyTask && (
        <LiveStudyTimerModal
          isOpen={!!liveStudyTask}
          onClose={() => setLiveStudyTask(null)}
          initialSubject={liveStudyTask.subject}
          initialTaskTitle={liveStudyTask.title}
          initialTaskId={liveStudyTask.id}
          initialPlannedMinutes={liveStudyTask.estimatedMinutes || 60}
          initialType={liveStudyTask.type}
          onSessionCompleted={() => {
            setTasks(db.getTasks());
            onShowNotification(`Recorded verified study time for ${liveStudyTask.title}`, 'Study Logger');
          }}
        />
      )}
      {/* Routine Slots Configuration Modal */}
      <RoutineSlotEditorModal
        isOpen={showRoutineSlotEditor}
        onClose={() => setShowRoutineSlotEditor(false)}
        onShowNotification={onShowNotification}
      />
    </div>
  );
};
