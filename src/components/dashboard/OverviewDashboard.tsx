import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  ArrowRight,
  Layers,
  Sparkles,
  ChevronRight,
  Target,
  Quote,
  Check,
  FileText,
  LayoutDashboard,
  Play,
  Pause,
  Square,
  Plus,
  Pencil,
  Trash2,
  Copy,
  MoreVertical,
  Timer,
  X,
  RotateCcw,
  CheckCircle2,
  Circle,
  AlertCircle,
  CalendarDays,
  Flame,
  Zap,
} from 'lucide-react';
import { db } from '../../services/db';
import { authService } from '../../services/auth';
import { syncService } from '../../services/syncService';
import { TaskItem, UserProfile, DailyObjective } from '../../types';
import { PomodoroTimerWidget } from '../pomodoro/PomodoroTimerWidget';
import { GlassCard } from '../shared/GlassCard';
import { getAllSubjectOptions, getChaptersForSubject, addCustomSubject } from '../../data/subjectRegistry';
import { pomodoroTimerService } from '../../services/pomodoroTimerService';
import { QuickFocusPanel } from './QuickFocusPanel';
import { LiveStudyTimerModal } from '../study/LiveStudyTimerModal';

interface RoutineSlotItem {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

const DEFAULT_ROUTINE_SLOTS: RoutineSlotItem[] = [
  { id: 'morning', name: 'Morning Focus', startTime: '06:00', endTime: '09:00' },
  { id: 'afternoon', name: 'Afternoon Sprint', startTime: '14:00', endTime: '17:00' },
  { id: 'evening', name: 'Evening Deep Work', startTime: '19:00', endTime: '22:00' },
  { id: 'night', name: 'Night Mastery & Revision', startTime: '22:00', endTime: '00:00' },
];

interface OverviewDashboardProps {
  onNavigate: (tab: string) => void;
  onShowNotification: (msg: string, title?: string) => void;
}

const emptyForm = () => {
  const subs = db.getCurrentExamSubjects();
  return {
    title: '',
    subject: subs[0] || 'General Studies',
    chapter: '',
    topic: '',
    description: '',
    priority: 'Medium' as TaskItem['priority'],
    startTime: '09:00',
    endTime: '10:00',
    estimatedMinutes: 60,
    reminder: false,
    reminderTime: '08:55',
    notes: '',
    status: 'Pending' as NonNullable<TaskItem['status']>,
    type: 'Study Session' as TaskItem['type'],
    recurring: 'None' as NonNullable<TaskItem['recurring']>,
  };
};

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onNavigate,
  onShowNotification,
}) => {
  const [user, setUser] = useState<UserProfile>(authService.getCurrentUser());
  const [settings, setSettings] = useState(db.getSettings());
  const [dailyObjective, setDailyObjective] = useState<DailyObjective>(() => db.getDailyObjective());
  const [newSubgoalText, setNewSubgoalText] = useState('');
  const [quote, setQuote] = useState(() => syncService.getNextQuote());
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [progress, setProgress] = useState(() => syncService.getTodayProgressSnapshot());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [customSubject, setCustomSubject] = useState('');
  const [chapters, setChapters] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  // Inline controls state for Daily Objective view
  const [inlineEditTaskId, setInlineEditTaskId] = useState<string | null>(null);
  const [inlineEditForm, setInlineEditForm] = useState({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    status: 'Pending' as 'Pending' | 'In Progress' | 'Completed',
    subject: '',
    priority: 'Medium' as TaskItem['priority'],
  });
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [rescheduleDateInput, setRescheduleDateInput] = useState('');

  // Form for adding new objective directly inside Daily Objective card
  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjStart, setNewObjStart] = useState('09:00');
  const [newObjEnd, setNewObjEnd] = useState('10:00');
  const [newObjSubject, setNewObjSubject] = useState(() => db.getCurrentExamSubjects()[0] || 'General');

  // Modal dialog state for creating new tasks in Daily Objective
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);
  const [modalTaskForm, setModalTaskForm] = useState({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    priority: 'Medium' as TaskItem['priority'],
    subject: db.getCurrentExamSubjects()[0] || 'General',
  });

  // Pomodoro timer state for live stopwatch sync
  const [pomodoroState, setPomodoroState] = useState(() => pomodoroTimerService.getState());

  // Single-Subject Focus Launcher states
  const [routineSlots, setRoutineSlots] = useState<RoutineSlotItem[]>(() => {
    const s = db.getSettings();
    if (s?.dailySchedule?.timeSlots && s.dailySchedule.timeSlots.length > 0) {
      return s.dailySchedule.timeSlots.map((ts: any, i: number) => ({
        id: ts.id || `slot-${i}`,
        name: ts.label || ts.name || `Slot ${i + 1}`,
        startTime: ts.startTime || '09:00',
        endTime: ts.endTime || '10:00',
      }));
    }
    return DEFAULT_ROUTINE_SLOTS;
  });
  const [examSubjects, setExamSubjects] = useState<string[]>(() => db.getCurrentExamSubjects());
  const [quickFocusSubject, setQuickFocusSubject] = useState<string>(() => {
    const subs = db.getCurrentExamSubjects();
    return subs[0] || 'General Studies';
  });
  const [quickFocusSlot, setQuickFocusSlot] = useState<string>(() => {
    const s = db.getSettings();
    const slots = s?.dailySchedule?.timeSlots;
    return (slots && slots[0]?.label) || (slots && slots[0]?.name) || DEFAULT_ROUTINE_SLOTS[0].name;
  });
  const [quickFocusTopic, setQuickFocusTopic] = useState<string>('');
  const [quickFocusMinutes, setQuickFocusMinutes] = useState<number>(60);
  const [quickFocusPriority, setQuickFocusPriority] = useState<TaskItem['priority']>('High');
  const [liveStudyTask, setLiveStudyTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    const unsubPomo = pomodoroTimerService.subscribe((s) => setPomodoroState(s));
    return () => unsubPomo();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  const refresh = useCallback(() => {
    setUser(authService.getCurrentUser());
    const currentSettings = db.getSettings();
    setSettings(currentSettings);
    setDailyObjective(db.getDailyObjective());
    setProgress(syncService.getTodayProgressSnapshot());
    
    if (currentSettings?.dailySchedule?.timeSlots && currentSettings.dailySchedule.timeSlots.length > 0) {
      setRoutineSlots(
        currentSettings.dailySchedule.timeSlots.map((ts: any, i: number) => ({
          id: ts.id || `slot-${i}`,
          name: ts.label || ts.name || `Slot ${i + 1}`,
          startTime: ts.startTime || '09:00',
          endTime: ts.endTime || '10:00',
        }))
      );
    } else {
      setRoutineSlots(DEFAULT_ROUTINE_SLOTS);
    }

    const currentSubs = db.getCurrentExamSubjects();
    setExamSubjects(currentSubs);
    if (currentSubs.length > 0 && !currentSubs.includes(quickFocusSubject)) {
      setQuickFocusSubject(currentSubs[0] || 'Core Subject');
    }
  }, [quickFocusSubject]);

  useEffect(() => {
    refresh();
    const unsub = syncService.subscribe('*', () => refresh());
    const onUpdate = () => refresh();
    window.addEventListener('studyos_db_updated', onUpdate);
    window.addEventListener('studyos_user_updated', onUpdate);
    window.addEventListener('studyos_tasks_updated', onUpdate);
    window.addEventListener('studyos_profile_updated', onUpdate);
    window.addEventListener('studyos_active_exam_changed', onUpdate);
    return () => {
      unsub();
      window.removeEventListener('studyos_db_updated', onUpdate);
      window.removeEventListener('studyos_user_updated', onUpdate);
      window.removeEventListener('studyos_tasks_updated', onUpdate);
      window.removeEventListener('studyos_profile_updated', onUpdate);
      window.removeEventListener('studyos_active_exam_changed', onUpdate);
    };
  }, [refresh]);

  // Quote rotates every 60s without repetition until full cycle
  useEffect(() => {
    const id = setInterval(() => setQuote(syncService.getNextQuote()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const tick = () => {
      const activeExam = db.getActiveExam();
      const target = activeExam?.examDate || settings.targetExamDate || '2027-02-07';
      const end = new Date(target + 'T09:00:00').getTime();
      const diff = Math.max(0, end - Date.now());
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [settings.targetExamDate]);

  useEffect(() => {
    setChapters(getChaptersForSubject(form.subject));
  }, [form.subject]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleUpdateGoalText = (text: string) => {
    const next = { ...dailyObjective, goalText: text };
    setDailyObjective(next);
    db.setDailyObjective(next);
  };

  const handleToggleSubgoal = (id: string) => {
    const subgoals = dailyObjective.subgoals.map((s) =>
      s.id === id ? { ...s, completed: !s.completed } : s
    );
    const done = subgoals.filter((s) => s.completed).length;
    const completionPercent = subgoals.length ? Math.round((done / subgoals.length) * 100) : 0;
    const next = { ...dailyObjective, subgoals, completionPercent };
    setDailyObjective(next);
    db.setDailyObjective(next);
  };

  const handleAddSubgoal = () => {
    const text = newSubgoalText.trim();
    if (!text) return;
    const subgoals = [...dailyObjective.subgoals, { id: 'sg-' + Date.now(), text, completed: false }];
    const next = { ...dailyObjective, subgoals, completionPercent: 0 };
    setDailyObjective(next);
    db.setDailyObjective(next);
    setNewSubgoalText('');
  };

  const openAddModal = () => {
    setEditingTask(null);
    setForm(emptyForm());
    setShowTaskModal(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      subject: task.subject || getAllSubjectOptions()[0] || 'General',
      chapter: task.chapter || '',
      topic: task.topic || '',
      description: task.description || '',
      priority: task.priority || 'Medium',
      startTime: task.startTime || '09:00',
      endTime: task.endTime || '10:00',
      estimatedMinutes: task.estimatedMinutes || 60,
      reminder: Boolean(task.reminder),
      reminderTime: task.reminderTime || '08:55',
      notes: task.notes || '',
      status: (task.status as any) || (task.completed ? 'Completed' : 'Pending'),
      type: task.type || 'Study Session',
      recurring: (task.recurring as any) || 'None',
    });
    setShowTaskModal(true);
    setActionMenuId(null);
  };

  const handleSaveTask = () => {
    if (!form.title.trim()) {
      onShowNotification('Title is required', 'Task');
      return;
    }
    if (customSubject.trim()) {
      addCustomSubject(customSubject.trim());
      form.subject = customSubject.trim();
    }
    const isDone = form.status === 'Completed';
    if (editingTask) {
      const updated: TaskItem = {
        ...editingTask,
        title: form.title.trim(),
        subject: form.subject,
        chapter: form.chapter || undefined,
        topic: form.topic || undefined,
        description: form.description || undefined,
        priority: form.priority,
        startTime: form.startTime,
        endTime: form.endTime,
        estimatedMinutes: form.estimatedMinutes,
        reminder: form.reminder,
        reminderTime: form.reminderTime,
        notes: form.notes || undefined,
        status: form.status,
        completed: isDone,
        completedAt: isDone ? editingTask.completedAt || new Date().toISOString() : undefined,
        type: form.type,
        recurring: form.recurring,
        dueDate: editingTask.dueDate || todayStr,
        timeSlot:
          parseInt(form.startTime) < 12 ? 'Morning' : parseInt(form.startTime) < 17 ? 'Afternoon' : 'Night',
      };
      syncService.updateTask(updated);
      onShowNotification(`Updated “${updated.title}”`, 'Today’s Focus');
    } else {
      const newTask: TaskItem = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: form.title.trim(),
        subject: form.subject,
        chapter: form.chapter || undefined,
        topic: form.topic || undefined,
        description: form.description || undefined,
        priority: form.priority,
        startTime: form.startTime,
        endTime: form.endTime,
        estimatedMinutes: form.estimatedMinutes,
        reminder: form.reminder,
        reminderTime: form.reminderTime,
        notes: form.notes || undefined,
        status: form.status,
        completed: isDone,
        completedAt: isDone ? new Date().toISOString() : undefined,
        type: form.type,
        recurring: form.recurring,
        dueDate: todayStr,
        timeSlot:
          parseInt(form.startTime) < 12 ? 'Morning' : parseInt(form.startTime) < 17 ? 'Afternoon' : 'Night',
      };
      syncService.addTask(newTask);
      onShowNotification(`Added “${newTask.title}”`, 'Today’s Focus');
    }
    setShowTaskModal(false);
    setEditingTask(null);
    setCustomSubject('');
    refresh();
  };

  const handleDelete = (id: string) => {
    syncService.deleteTask(id);
    onShowNotification('Task deleted', 'Today’s Focus');
    setActionMenuId(null);
    refresh();
  };

  const handleDuplicate = (id: string) => {
    const copy = syncService.duplicateTask(id);
    if (copy) onShowNotification(`Duplicated “${copy.title}”`, 'Today’s Focus');
    setActionMenuId(null);
    refresh();
  };

  const handleToggleComplete = (task: TaskItem) => {
    const done = !(task.completed || task.status === 'Completed');
    syncService.markComplete(task.id, done);
    onShowNotification(done ? 'Marked complete' : 'Marked incomplete', 'Today’s Focus');
    setActionMenuId(null);
    refresh();
  };

  const handleStartFocus = (task: TaskItem) => {
    syncService.startFocusSession(task.id);
    pomodoroTimerService.linkTask(task.id);
    onShowNotification(`Focus started: ${task.title}`, 'Focus Timer');
    setActionMenuId(null);
    refresh();
  };

  const handleStartTimer = (task: TaskItem) => {
    syncService.startFocusSession(task.id);
    pomodoroTimerService.linkTask(task.id);
    pomodoroTimerService.start();
    onShowNotification(`Timer started for “${task.title}”`, 'Focus Timer');
    setActionMenuId(null);
    refresh();
  };

  // Daily Objective & Today's Focus handlers
  const todaysFocusTasks = syncService.getTodaysTasks(todayStr);
  const completedFocusCount = todaysFocusTasks.filter((t) => t.completed || t.status === 'Completed').length;
  const inProgressFocusCount = todaysFocusTasks.filter((t) => t.status === 'In Progress').length;
  const totalFocusCount = todaysFocusTasks.length;
  const computedFocusPct = totalFocusCount > 0 ? Math.round((completedFocusCount / totalFocusCount) * 100) : 0;

  const handleAddObjectiveTask = () => {
    if (!newObjTitle.trim()) {
      onShowNotification('Please enter a title for the objective', 'Daily Objective');
      return;
    }
    const newTask: TaskItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: newObjTitle.trim(),
      subject: newObjSubject,
      dueDate: todayStr,
      startTime: newObjStart || '09:00',
      endTime: newObjEnd || '10:00',
      timeSlot: parseInt(newObjStart) < 12 ? 'Morning' : parseInt(newObjStart) < 17 ? 'Afternoon' : 'Night',
      priority: 'Medium',
      estimatedMinutes: 60,
      completed: false,
      status: 'Pending',
      type: 'Study Session',
      category: 'Study',
    };
    syncService.addTask(newTask);
    onShowNotification(`Added "${newTask.title}" to Daily Objective & Focus`, 'Daily Objective');
    setNewObjTitle('');
    refresh();
  };

  const handleStartInlineEdit = (task: TaskItem) => {
    setInlineEditTaskId(task.id);
    setInlineEditForm({
      title: task.title,
      startTime: task.startTime || '09:00',
      endTime: task.endTime || '10:00',
      status: (task.status as any) || (task.completed ? 'Completed' : 'Pending'),
      subject: task.subject || getAllSubjectOptions()[0] || 'General',
      priority: task.priority || 'Medium',
    });
    setRescheduleTaskId(null);
  };

  const handleSaveInlineEdit = (task: TaskItem) => {
    if (!inlineEditForm.title.trim()) return;
    const isDone = inlineEditForm.status === 'Completed';
    syncService.updateTask({
      ...task,
      title: inlineEditForm.title.trim(),
      startTime: inlineEditForm.startTime,
      endTime: inlineEditForm.endTime,
      status: inlineEditForm.status,
      subject: inlineEditForm.subject,
      priority: inlineEditForm.priority,
      completed: isDone,
      completedAt: isDone ? task.completedAt || new Date().toISOString() : undefined,
    });
    setInlineEditTaskId(null);
    onShowNotification(`Updated "${inlineEditForm.title}"`, 'Daily Objective');
    refresh();
  };

  const handleQuickStatusChange = (task: TaskItem, newStatus: 'Pending' | 'In Progress' | 'Completed') => {
    const isDone = newStatus === 'Completed';
    syncService.updateTask({
      ...task,
      status: newStatus,
      completed: isDone,
      completedAt: isDone ? task.completedAt || new Date().toISOString() : undefined,
    });
    onShowNotification(`Status updated to ${newStatus}`, 'Daily Objective');
    refresh();
  };

  const handleRescheduleTomorrow = (task: TaskItem) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    syncService.rescheduleTask(task.id, tomorrowStr, task.startTime, task.endTime);
    onShowNotification(`Rescheduled "${task.title}" to Tomorrow (${tomorrowStr})`, 'Daily Objective');
    setRescheduleTaskId(null);
    refresh();
  };

  const handleRescheduleCustom = (task: TaskItem, newDate: string) => {
    if (!newDate) return;
    syncService.rescheduleTask(task.id, newDate, task.startTime, task.endTime);
    onShowNotification(`Rescheduled "${task.title}" to ${newDate}`, 'Daily Objective');
    setRescheduleTaskId(null);
    refresh();
  };

  const handleCreateObjectiveTaskFromModal = () => {
    if (!modalTaskForm.title.trim()) {
      onShowNotification('Task title is required', 'Daily Objective Modal');
      return;
    }
    const startHour = parseInt(modalTaskForm.startTime) || 9;
    const endHour = parseInt(modalTaskForm.endTime) || 10;
    const estimated = Math.max(15, (endHour - startHour) * 60);

    const newTask: TaskItem = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: modalTaskForm.title.trim(),
      subject: modalTaskForm.subject,
      dueDate: todayStr,
      startTime: modalTaskForm.startTime || '09:00',
      endTime: modalTaskForm.endTime || '10:00',
      timeSlot: startHour < 12 ? 'Morning' : startHour < 17 ? 'Afternoon' : 'Night',
      priority: modalTaskForm.priority || 'Medium',
      estimatedMinutes: estimated > 0 ? estimated : 60,
      completed: false,
      status: 'Pending',
      type: 'Study Session',
      category: 'Study',
    };

    syncService.addTask(newTask);
    onShowNotification(`Task "${newTask.title}" created & synced with Today's Focus!`, 'Daily Objective');
    setModalTaskForm({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      priority: 'Medium',
      subject: getAllSubjectOptions()[0] || 'General',
    });
    setIsObjectiveModalOpen(false);
    refresh();
  };

  const handleStartTaskTimer = (task: TaskItem) => {
    pomodoroTimerService.linkTask(task.id);
    pomodoroTimerService.start();
    syncService.startFocusSession(task.id);
    onShowNotification(`Focus timer started for "${task.title}". Synced with Pomodoro!`, 'Focus Timer');
    refresh();
  };

  const handlePauseTaskTimer = (task: TaskItem) => {
    pomodoroTimerService.pause();
    syncService.pauseFocusSession(task.id);
    onShowNotification(`Focus timer paused for "${task.title}"`, 'Focus Timer');
    refresh();
  };

  const handleStopTaskTimer = (task: TaskItem, markDone = false) => {
    pomodoroTimerService.pause();
    syncService.stopFocusSession(task.id, markDone);
    onShowNotification(
      markDone ? `Completed "${task.title}" focus session!` : `Stopped focus timer for "${task.title}"`,
      'Focus Timer'
    );
    refresh();
  };

  const handleStartSingleSubjectFocus = (
    subject?: string,
    minutes?: number,
    slot?: string,
    customTopic?: string,
    priority?: TaskItem['priority']
  ) => {
    const chosenSub = subject || quickFocusSubject || (examSubjects[0] || 'Core Subject');
    const chosenMins = minutes || quickFocusMinutes || 60;
    const chosenSlot = slot || quickFocusSlot || (routineSlots[0]?.name || 'Morning');
    const topicText = customTopic !== undefined ? customTopic : quickFocusTopic;
    const sessionTitle = topicText.trim()
      ? `${chosenSub}: ${topicText.trim()}`
      : `${chosenSub} Single-Subject Focus Session`;
    const chosenPriority = priority || quickFocusPriority || 'High';

    // Derive approximate start and end times based on slot if possible
    const targetSlotObj = routineSlots.find((s) => s.name === chosenSlot || s.id === chosenSlot);
    const slotStart = targetSlotObj?.startTime || '09:00';
    const slotEnd = targetSlotObj?.endTime || '10:00';

    const focusTask: TaskItem = {
      id: 'focus-' + Date.now(),
      title: sessionTitle,
      type: 'Study Session',
      subject: chosenSub,
      dueDate: todayStr,
      startTime: slotStart,
      endTime: slotEnd,
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

    // 3. Sync with Pomodoro Study Engine as well
    try {
      pomodoroTimerService.linkTask(focusTask.id);
      pomodoroTimerService.start();
    } catch (e) {
      console.error(e);
    }

    // 4. Start the live study timer modal immediately with running timer
    setLiveStudyTask(focusTask);

    if (onShowNotification) {
      onShowNotification(
        `Added to ${chosenSlot} slot and started ${chosenMins}m focus timer on ${chosenSub}!`,
        'Single-Subject Focus Started'
      );
    }

    refresh();
  };

  const activeExam = db.getExams?.()?.find?.((e: any) => e.id === db.getActiveExamId?.()) || null;
  const todayTasks = progress.tasks;
  const subjectOptions = examSubjects && examSubjects.length > 0 ? examSubjects : getAllSubjectOptions();
  const displayName = user.fullName || (user as any).name || user.username || 'Aspirant';

  const fmtMins = (m: number) => {
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const priorityColor = (p: string) =>
    p === 'High' ? 'text-rose-600 bg-rose-50 border-rose-200' : p === 'Low' ? 'text-slate-500 bg-slate-50 border-slate-200' : 'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6 bg-transparent">
      {/* Header: Welcome + avatar + rotating quote */}
      <GlassCard className="relative overflow-hidden bg-gradient-to-r from-blue-50/90 via-teal-50/70 to-white border-cyan-200/50 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" /> Ready to begin
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="shrink-0 rounded-full ring-2 ring-teal-200/80 ring-offset-2 hover:ring-teal-400 transition-all cursor-pointer overflow-hidden w-12 h-12 bg-slate-100"
              title="Open Profile & Settings"
            >
              <img
                src={user.avatarUrl || ''}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI2NCIgZmlsbD0iIzNCODJGNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTQlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpIiBmb250LXNpemU9IjQ4IiBmb250LXdlaWdodD0iNzAwIiBmaWxsPSJ3aGl0ZSI+UzwvdGV4dD48L3N2Zz4=';
                }}
              />
            </button>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Welcome, {displayName.split(' ')[0]}
            </h1>
          </div>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            {activeExam
              ? `Active workspace: ${activeExam.title} (${activeExam.code}). Open Syllabus or Lecture Planner to start building progress.`
              : 'Your offline study workspace is ready. Create or select an exam in Settings → Exam Manager to begin.'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onNavigate('syllabus')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 text-white text-xs font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer"
            >
              Open Syllabus <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('lectures')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:border-teal-300 transition-all cursor-pointer"
            >
              Lecture Planner
            </button>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/80 border border-slate-100 max-w-sm transition-opacity duration-500">
          <Quote className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-800 leading-relaxed">“{quote.quote}”</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">— {quote.author}</p>
          </div>
        </div>
      </GlassCard>

      {/* Latest Progress Widget */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Completed', value: progress.completedCount, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-100/90 border border-emerald-200/90' },
          { label: 'Pending', value: progress.pendingCount, icon: Circle, color: 'text-amber-800 bg-amber-100/90 border border-amber-200/90' },
          { label: 'Study Time', value: fmtMins(progress.todayStudyMinutes), icon: Clock, color: 'text-blue-700 bg-blue-100/90 border border-blue-200/90' },
          {
            label: 'Active Task',
            value: progress.activeTask?.title?.slice(0, 18) || '—',
            icon: Play,
            color: 'text-purple-700 bg-purple-100/90 border border-purple-200/90',
          },
          {
            label: 'Last Session',
            value: progress.lastCompletedSession?.title?.slice(0, 18) || '—',
            icon: Check,
            color: 'text-teal-700 bg-teal-100/90 border border-teal-200/90',
          },
          {
            label: 'Upcoming',
            value: progress.upcomingSession
              ? `${progress.upcomingSession.startTime || ''} ${progress.upcomingSession.title?.slice(0, 12) || ''}`
              : '—',
            icon: AlertCircle,
            color: 'text-rose-700 bg-rose-100/90 border border-rose-200/90',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <GlassCard key={card.label} className="p-3.5 space-y-2 bg-white/95 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all rounded-2xl">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">{card.label}</div>
                <div className="text-sm font-black text-slate-900 truncate mt-0.5" title={String(card.value)}>
                  {card.value}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Countdown + Pomodoro + Daily goal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="flex flex-col justify-between p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-black text-slate-900">Exam Countdown</h2>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mb-3">
            Target: {settings.targetExamDate || '2027-02-07'}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Days', value: countdown.days },
              { label: 'Hrs', value: countdown.hours },
              { label: 'Min', value: countdown.minutes },
              { label: 'Sec', value: countdown.seconds },
            ].map((b) => (
              <div key={b.label} className="rounded-xl bg-slate-50 border border-slate-100 p-2 text-center">
                <div className="text-lg font-black font-mono text-slate-900">{b.value}</div>
                <div className="text-[9px] font-bold uppercase text-slate-400">{b.label}</div>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="min-h-[180px]">
          <PomodoroTimerWidget />
        </div>

        <GlassCard className="p-4 space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-black text-slate-900">Daily Objective & Focus</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsObjectiveModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-[10px] font-bold hover:bg-teal-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                  title="Create task with modal dialog"
                >
                  <Plus className="w-3 h-3" /> New Task
                </button>
                <span className="text-[10px] font-black text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                  {completedFocusCount}/{totalFocusCount} Done ({computedFocusPct}%)
                </span>
              </div>
            </div>

            {/* Primary Goal Tagline */}
            <input
              type="text"
              value={dailyObjective.goalText || ''}
              onChange={(e) => handleUpdateGoalText(e.target.value)}
              placeholder="Set main daily target…"
              className="w-full px-3 py-1.5 mb-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />

            {/* Synced Today's Focus Items in Daily Objective Div */}
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-0.5">
              {todaysFocusTasks.length === 0 ? (
                <div className="text-center py-4 px-2 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <p className="text-[11px] text-slate-400 font-medium">
                    No focus items for today. Click "+ New Task" above to add one via modal dialog.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsObjectiveModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Daily Task
                  </button>
                </div>
              ) : (
                todaysFocusTasks.map((t) => {
                  const isDone = t.completed || t.status === 'Completed';
                  const isInProgress = t.status === 'In Progress';
                  const isInlineEditing = inlineEditTaskId === t.id;
                  const isRescheduling = rescheduleTaskId === t.id;

                  // Timer sync states with Pomodoro Study Engine
                  const isLinked = pomodoroState.linkedTaskId === t.id;
                  const isTimerRunning = isLinked && pomodoroState.isRunning;
                  const secsLeft = isLinked ? pomodoroState.timeRemainingSecs : 0;
                  const mins = Math.floor(secsLeft / 60);
                  const secs = secsLeft % 60;
                  const formattedTimer = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

                  return (
                    <div
                      key={t.id}
                      className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                        isDone
                          ? 'bg-emerald-50/70 border-emerald-200 text-slate-600'
                          : isInProgress || isTimerRunning
                            ? 'bg-blue-50/90 border-blue-200 ring-1 ring-blue-300'
                            : 'bg-white border-slate-200 hover:border-teal-300'
                      }`}
                    >
                      {/* Normal Row Display */}
                      {!isInlineEditing ? (
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              {/* Mark Done / Undone Toggle Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleComplete(t)}
                                className="mt-0.5 shrink-0 cursor-pointer text-slate-400 hover:text-emerald-600 transition-colors"
                                title={isDone ? 'Mark Undone' : 'Mark Done'}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                                ) : isTimerRunning ? (
                                  <Flame className="w-4 h-4 text-teal-600 animate-bounce" />
                                ) : isInProgress ? (
                                  <Timer className="w-4 h-4 text-blue-600 animate-pulse" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-400 hover:text-teal-600" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className={`text-xs font-bold leading-tight ${isDone ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                  {t.title}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] font-medium text-slate-500">
                                  {/* Priority Badge */}
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                      t.priority === 'High'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : t.priority === 'Low'
                                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    {t.priority || 'Medium'}
                                  </span>

                                  {/* Subject Pill */}
                                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                    {t.subject || 'General'}
                                  </span>

                                  {/* Start Time & End Time */}
                                  <span className="flex items-center gap-1 text-slate-600 font-mono font-bold bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                    <Clock className="w-3 h-3 text-teal-600" />
                                    {t.startTime || '09:00'} - {t.endTime || '10:00'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Status Selector & Controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Status Select */}
                              <select
                                value={t.status || (isDone ? 'Completed' : 'Pending')}
                                onChange={(e) => handleQuickStatusChange(t, e.target.value as any)}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : isInProgress
                                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                              </select>

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleStartInlineEdit(t)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-teal-700 cursor-pointer"
                                title="Edit details"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {/* Reschedule Toggle */}
                              <button
                                type="button"
                                onClick={() => setRescheduleTaskId(rescheduleTaskId === t.id ? null : t.id)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-purple-700 cursor-pointer"
                                title="Reschedule"
                              >
                                <CalendarDays className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDelete(t.id)}
                                className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Task Focus Timer / Stopwatch Bar synced with Pomodoro Study Engine */}
                          <div className={`mt-2 p-1.5 rounded-lg border flex items-center justify-between gap-2 text-[10px] font-mono ${
                            isTimerRunning
                              ? 'bg-teal-500/10 border-teal-300 text-teal-900 ring-1 ring-teal-400/50'
                              : isLinked
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold">
                              <Flame className={`w-3.5 h-3.5 ${isTimerRunning ? 'text-teal-600 animate-pulse' : 'text-slate-400'}`} />
                              <span>
                                {isTimerRunning
                                  ? `Focus Active: ${formattedTimer}`
                                  : isLinked
                                    ? `Focus Paused: ${formattedTimer}`
                                    : 'Study Engine Focus Timer'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {isTimerRunning ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handlePauseTaskTimer(t)}
                                    className="px-2 py-0.5 rounded bg-amber-500 text-white font-sans font-bold hover:bg-amber-600 cursor-pointer flex items-center gap-0.5"
                                    title="Pause Study Engine Timer"
                                  >
                                    <Pause className="w-3 h-3" /> Pause
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStopTaskTimer(t, true)}
                                    className="px-2 py-0.5 rounded bg-emerald-600 text-white font-sans font-bold hover:bg-emerald-700 cursor-pointer flex items-center gap-0.5"
                                    title="Complete Focus Session"
                                  >
                                    <Square className="w-3 h-3" /> Complete
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartTaskTimer(t)}
                                  className="px-2 py-0.5 rounded bg-teal-600 text-white font-sans font-bold hover:bg-teal-700 cursor-pointer flex items-center gap-0.5"
                                  title="Start Focus Timer (Syncs with Pomodoro Study Engine)"
                                >
                                  <Play className="w-3 h-3" /> Focus Timer
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Quick Reschedule Options Drawer */}
                          {isRescheduling && (
                            <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 bg-purple-50/80 p-2 rounded-xl">
                              <span className="text-[10px] font-bold text-purple-900">Reschedule:</span>
                              <button
                                type="button"
                                onClick={() => handleRescheduleTomorrow(t)}
                                className="px-2 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-bold cursor-pointer hover:bg-purple-700"
                              >
                                Tomorrow
                              </button>
                              <div className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={rescheduleDateInput}
                                  onChange={(e) => setRescheduleDateInput(e.target.value)}
                                  className="px-1.5 py-0.5 rounded-lg border border-purple-200 text-[10px] bg-white font-semibold"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRescheduleCustom(t, rescheduleDateInput)}
                                  className="px-2 py-0.5 rounded-lg bg-teal-600 text-white text-[10px] font-bold cursor-pointer hover:bg-teal-700"
                                >
                                  Move
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Inline Edit View */
                        <div className="space-y-2 bg-slate-50 p-2 rounded-xl border border-teal-300">
                          <div className="text-[10px] font-bold uppercase text-teal-800">Edit Focus Item</div>
                          <input
                            type="text"
                            value={inlineEditForm.title}
                            onChange={(e) => setInlineEditForm({ ...inlineEditForm, title: e.target.value })}
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                            placeholder="Title"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[10px] font-bold text-slate-600">
                              Start Time:
                              <input
                                type="time"
                                value={inlineEditForm.startTime}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, startTime: e.target.value })}
                                className="w-full px-1.5 py-0.5 rounded border text-[11px] bg-white font-mono mt-0.5"
                              />
                            </label>
                            <label className="text-[10px] font-bold text-slate-600">
                              End Time:
                              <input
                                type="time"
                                value={inlineEditForm.endTime}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, endTime: e.target.value })}
                                className="w-full px-1.5 py-0.5 rounded border text-[11px] bg-white font-mono mt-0.5"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[10px] font-bold text-slate-600">
                              Status:
                              <select
                                value={inlineEditForm.status}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, status: e.target.value as any })}
                                className="w-full px-1.5 py-0.5 rounded border text-[11px] bg-white font-semibold mt-0.5"
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                              </select>
                            </label>
                            <label className="text-[10px] font-bold text-slate-600">
                              Subject:
                              <select
                                value={inlineEditForm.subject}
                                onChange={(e) => setInlineEditForm({ ...inlineEditForm, subject: e.target.value })}
                                className="w-full px-1.5 py-0.5 rounded border text-[11px] bg-white font-semibold mt-0.5"
                              >
                                {subjectOptions.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setInlineEditTaskId(null)}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(t)}
                              className="px-3 py-1 rounded-lg text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Add Focus Item directly inside Daily Objective Card */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="text-[10px] font-bold uppercase text-slate-400">Add Focus Item</div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newObjTitle}
                onChange={(e) => setNewObjTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddObjectiveTask()}
                placeholder="New objective item…"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddObjectiveTask}
                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold shrink-0 cursor-pointer hover:bg-teal-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="time"
                value={newObjStart}
                onChange={(e) => setNewObjStart(e.target.value)}
                className="px-1.5 py-1 rounded-lg border border-slate-200 text-[10px] font-mono bg-white"
                title="Start Time"
              />
              <input
                type="time"
                value={newObjEnd}
                onChange={(e) => setNewObjEnd(e.target.value)}
                className="px-1.5 py-1 rounded-lg border border-slate-200 text-[10px] font-mono bg-white"
                title="End Time"
              />
              <select
                value={newObjSubject}
                onChange={(e) => setNewObjSubject(e.target.value)}
                className="px-1.5 py-1 rounded-lg border border-slate-200 text-[10px] font-semibold bg-white truncate"
              >
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Quick start */}
      <div>
        <h2 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-purple-600" /> Quick Start
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: 'syllabus', label: 'Syllabus', desc: 'Subjects & topics', icon: BookOpen, color: 'text-blue-700 bg-blue-100/90 border-blue-200/90' },
            { id: 'lectures', label: 'Lecture Planner', desc: 'Plan & track lectures', icon: Layers, color: 'text-indigo-700 bg-indigo-100/90 border-indigo-200/90' },
            { id: 'study-hub', label: 'Study Hub', desc: 'Notes, PDFs, flashcards', icon: FileText, color: 'text-teal-700 bg-teal-100/90 border-teal-200/90' },
            { id: 'planner', label: 'Study Planner', desc: 'Weekly schedule', icon: Calendar, color: 'text-purple-700 bg-purple-100/90 border-purple-200/90' },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onNavigate(link.id)}
                className="text-left p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs transition-all hover:shadow-md hover:border-purple-300 cursor-pointer group"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 border shadow-2xs ${link.color}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="text-xs font-black text-slate-900 group-hover:text-purple-700 transition-colors">{link.label}</div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">{link.desc}</div>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-purple-600 opacity-90 group-hover:translate-x-0.5 transition-all">
                  Open <ChevronRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FOCUS LAUNCHER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-white to-indigo-50/90 border border-purple-200/90 shadow-sm space-y-4">
        {/* Header with Title & Active Exam Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100/90 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 text-white shadow-sm">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>⚡ Focus Launcher</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                  Instant Timer Sync
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Select target slot, choose any subject from {activeExam?.title || 'active exam'}, and instantly launch a verified focus session.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-purple-600" />
              {activeExam?.title || activeExam?.code || 'Active Exam Hub'}
            </span>
            <span className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
              {examSubjects.length} Subjects
            </span>
          </div>
        </div>

        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Target Routine Slot */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-600" /> Target Routine Slot
            </label>
            <select
              value={quickFocusSlot}
              onChange={(e) => setQuickFocusSlot(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white font-bold text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all shadow-2xs"
            >
              {routineSlots.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} Slot ({s.startTime} - {s.endTime})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Subject Dropdown (Dynamic for ALL exams) */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-purple-600" /> Exam Subject ({examSubjects.length})
            </label>
            <select
              value={quickFocusSubject}
              onChange={(e) => setQuickFocusSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white font-bold text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all shadow-2xs"
            >
              {(examSubjects.length > 0 ? examSubjects : getAllSubjectOptions()).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 3. Custom Topic / Goal */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-600" /> Topic / Session Goal (Optional)
            </label>
            <input
              type="text"
              value={quickFocusTopic}
              onChange={(e) => setQuickFocusTopic(e.target.value)}
              placeholder="e.g. Dynamic Programming, Ch. 3 DPP..."
              className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white font-semibold text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all shadow-2xs"
            />
          </div>

          {/* 4. Duration Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3 text-purple-600" /> Sprint Duration
            </label>
            <select
              value={quickFocusMinutes}
              onChange={(e) => setQuickFocusMinutes(parseInt(e.target.value) || 60)}
              className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white font-bold text-xs text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all shadow-2xs"
            >
              <option value={25}>25 mins (Pomodoro Sprint)</option>
              <option value={45}>45 mins (Focused Block)</option>
              <option value={60}>60 mins (Standard Deep Sprint)</option>
              <option value={90}>90 mins (Full Subject Mastery)</option>
              <option value={120}>120 mins (Exam Simulation Block)</option>
            </select>
          </div>
        </div>

        {/* Launch Button Action Bar without presets row */}
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => handleStartSingleSubjectFocus(quickFocusSubject, quickFocusMinutes, quickFocusSlot, quickFocusTopic, quickFocusPriority)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 text-white font-black text-xs shadow-md shadow-purple-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>⚡ Add to {quickFocusSlot} & Start Focus Timer</span>
          </button>
        </div>
      </div>

      {/* Today's Focus — production Quick Focus Manager */}
      <QuickFocusPanel onNavigate={onNavigate} onShowNotification={onShowNotification} />

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="text-sm font-black text-slate-900">
                {editingTask ? 'Edit Task' : 'Add Task'}
              </h3>
              <button type="button" onClick={() => setShowTaskModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Title *</span>
                <input
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Revise Master Theorem"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Subject</span>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value, chapter: '' })}
                  >
                    {subjectOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Or custom subject</span>
                  <input
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Add new…"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Chapter</span>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.chapter}
                    onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                  >
                    <option value="">—</option>
                    {chapters.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Topic</span>
                  <input
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    placeholder="Topic"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Description</span>
                <textarea
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none min-h-[60px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Priority</span>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as TaskItem['priority'] })}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Start</span>
                  <input
                    type="time"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">End</span>
                  <input
                    type="time"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Duration (min)</span>
                  <input
                    type="number"
                    min={5}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.estimatedMinutes}
                    onChange={(e) => setForm({ ...form, estimatedMinutes: parseInt(e.target.value) || 60 })}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Status</span>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Incomplete">Incomplete</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Recurring</span>
                  <select
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={form.recurring}
                    onChange={(e) => setForm({ ...form, recurring: e.target.value as any })}
                  >
                    <option value="None">One-time</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Day-wise">Day-wise</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.reminder}
                    onChange={(e) => setForm({ ...form, reminder: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Reminder
                </label>
                {form.reminder && (
                  <input
                    type="time"
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                    value={form.reminderTime}
                    onChange={(e) => setForm({ ...form, reminderTime: e.target.value })}
                  />
                )}
              </div>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Notes</span>
                <textarea
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none min-h-[50px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTask}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 cursor-pointer shadow-sm"
              >
                {editingTask ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for Creating Task in Daily Objective */}
      {isObjectiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-black text-slate-900">Create Daily Objective Task</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsObjectiveModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  value={modalTaskForm.title}
                  onChange={(e) => setModalTaskForm({ ...modalTaskForm, title: e.target.value })}
                  placeholder="e.g., Physics Chapter 4 PYQ Practice"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={modalTaskForm.startTime}
                    onChange={(e) => setModalTaskForm({ ...modalTaskForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={modalTaskForm.endTime}
                    onChange={(e) => setModalTaskForm({ ...modalTaskForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={modalTaskForm.priority}
                    onChange={(e) => setModalTaskForm({ ...modalTaskForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={modalTaskForm.subject}
                    onChange={(e) => setModalTaskForm({ ...modalTaskForm, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                  >
                    {subjectOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsObjectiveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateObjectiveTaskFromModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 shadow-sm cursor-pointer"
              >
                Add Task to Daily Focus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Single-Subject Focus Study Timer Modal with slot sync */}
      {liveStudyTask && (
        <LiveStudyTimerModal
          isOpen={true}
          initialSubject={liveStudyTask.subject}
          initialTaskTitle={liveStudyTask.title}
          initialTaskId={liveStudyTask.id}
          initialPlannedMinutes={liveStudyTask.estimatedMinutes || 60}
          initialType="Study Session"
          onClose={() => {
            setLiveStudyTask(null);
            refresh();
          }}
          onSessionCompleted={(summary) => {
            setLiveStudyTask(null);
            refresh();
            if (onShowNotification) {
              onShowNotification(
                `Single-Subject Focus session for "${summary.subject}" logged successfully (${summary.durationMinutes}m)!`,
                'Focus Session Logged'
              );
            }
          }}
        />
      )}
    </div>
  );
};

export default OverviewDashboard;
