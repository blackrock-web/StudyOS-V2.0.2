/**
 * Quick Focus — production Today Planner & Todo Manager
 * Material 3 popup for all mutations; dashboard is display-only + open trigger.
 * Syncs with syncService / Planner offline.
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Calendar,
  Plus,
  Check,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  Pin,
  Archive,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Clock,
  Flag,
  X,
  GripVertical,
  Import,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { TaskItem } from '../../types';
import { db } from '../../services/db';
import { syncService } from '../../services/syncService';
import { taskSessionService } from '../../services/taskSessionService';
import { getAllSubjectOptions } from '../../data/subjectRegistry';
import { GlassCard } from '../shared/GlassCard';

export type TodoCategory = 'Study' | 'Personal' | 'Revision' | 'Assignment' | 'Exam' | 'Custom';

interface QuickFocusPanelProps {
  onNavigate: (tab: string) => void;
  onShowNotification: (msg: string, title?: string) => void;
}

type SortMode = 'manual' | 'priority' | 'due';

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const CATEGORIES: TodoCategory[] = ['Study', 'Personal', 'Revision', 'Assignment', 'Exam', 'Custom'];
const COLOR_TAGS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(partial?: Partial<TaskItem>): Partial<TaskItem> {
  const subs = db.getCurrentExamSubjects();
  return {
    title: '',
    description: '',
    subject: subs[0] || 'General Studies',
    priority: 'Medium',
    category: 'Study',
    dueDate: todayStr(),
    startTime: '',
    endTime: '',
    estimatedMinutes: 25,
    notes: '',
    colorTag: COLOR_TAGS[0],
    pinned: false,
    reminder: false,
    recurring: 'None',
    ...partial,
  };
}

export const QuickFocusPanel: React.FC<QuickFocusPanelProps> = ({ onNavigate, onShowNotification }) => {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [popupOpen, setPopupOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [filterCat, setFilterCat] = useState<'all' | TodoCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<TaskItem> | null>(null);
  const [undoStack, setUndoStack] = useState<TaskItem[][]>([]);
  const [redoStack, setRedoStack] = useState<TaskItem[][]>([]);
  const [deletedBin, setDeletedBin] = useState<TaskItem[]>([]);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    const unsub = syncService.subscribe('*', () => refresh());
    const onUpdate = () => refresh();
    window.addEventListener('studyos_db_updated', onUpdate);
    window.addEventListener('studyos_tasks_updated', onUpdate);
    window.addEventListener('studyos_active_exam_changed', onUpdate);
    return () => {
      unsub();
      window.removeEventListener('studyos_db_updated', onUpdate);
      window.removeEventListener('studyos_tasks_updated', onUpdate);
      window.removeEventListener('studyos_active_exam_changed', onUpdate);
    };
  }, [refresh]);

  const subjectOptions = useMemo(() => {
    void tick;
    const subs = db.getCurrentExamSubjects();
    return subs.length > 0 ? subs : getAllSubjectOptions();
  }, [tick]);

  const allToday = useMemo(() => {
    void tick;
    return syncService.getTodaysTasks(todayStr());
  }, [tick]);

  const todaySummary = useMemo(() => {
    void tick;
    return taskSessionService.getTodaySummary();
  }, [tick]);

  const tasks = useMemo(() => {
    let list = [...allToday];
    if (filterCat !== 'all') {
      list = list.filter((t) => (t.category || 'Study') === filterCat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.subject || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q)
      );
    }
    if (sortMode === 'priority') {
      list.sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority || 'Medium'] ?? 1) - (PRIORITY_ORDER[b.priority || 'Medium'] ?? 1) ||
          (a.startTime || '').localeCompare(b.startTime || '')
      );
    } else if (sortMode === 'due') {
      list.sort((a, b) => (a.startTime || '99').localeCompare(b.startTime || '99'));
    } else {
      list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || (a.startTime || '').localeCompare(b.startTime || ''));
    }
    // Pinned first
    list.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
    return list;
  }, [allToday, filterCat, search, sortMode]);

  const completed = tasks.filter((t) => t.completed || t.status === 'Completed').length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdue = tasks.filter((t) => {
    if (t.completed || t.status === 'Completed') return false;
    if (!t.startTime) return false;
    const now = new Date();
    const [h, m] = t.startTime.split(':').map(Number);
    const due = new Date();
    due.setHours(h || 0, m || 0, 0, 0);
    return due.getTime() < now.getTime();
  });

  const snapshot = () => syncService.getTasks().map((t) => ({ ...t }));

  const pushUndo = () => {
    setUndoStack((s) => [...s.slice(-29), snapshot()]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1]!;
    setRedoStack((r) => [...r, snapshot()]);
    setUndoStack((s) => s.slice(0, -1));
    // Restore tasks for today from snapshot (best-effort full list write)
    const byId = new Map(prev.map((t) => [t.id, t]));
    const current = syncService.getTasks();
    current.forEach((t) => {
      const old = byId.get(t.id);
      if (old) syncService.updateTask(old);
    });
    refresh();
    onShowNotification('Undo applied', 'Quick Focus');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    setUndoStack((s) => [...s, snapshot()]);
    setRedoStack((r) => r.slice(0, -1));
    next.forEach((t) => syncService.updateTask(t));
    refresh();
    onShowNotification('Redo applied', 'Quick Focus');
  };

  const openCreate = () => {
    setEditing(emptyDraft());
    setPopupOpen(true);
  };

  const openEdit = (t: TaskItem) => {
    setEditing({ ...t });
    setPopupOpen(true);
  };

  const saveEditing = () => {
    if (!editing?.title?.trim()) {
      onShowNotification('Title is required', 'Quick Focus');
      return;
    }
    pushUndo();
    if (editing.id) {
      const existing = syncService.getTasks().find((x) => x.id === editing.id);
      if (existing) {
        syncService.updateTask({
          ...existing,
          ...editing,
          title: editing.title!.trim(),
          updatedAt: new Date().toISOString(),
        } as TaskItem);
        onShowNotification('Task updated', 'Quick Focus');
      }
    } else {
      syncService.addTask({
        id: `task-${Date.now()}`,
        title: editing.title!.trim(),
        description: editing.description || '',
        subject: editing.subject || 'General',
        chapter: editing.chapter,
        topic: editing.topic,
        priority: (editing.priority as TaskItem['priority']) || 'Medium',
        category: editing.category || 'Study',
        dueDate: editing.dueDate || todayStr(),
        startTime: editing.startTime || undefined,
        endTime: editing.endTime || undefined,
        estimatedMinutes: editing.estimatedMinutes || 25,
        notes: editing.notes,
        colorTag: editing.colorTag,
        pinned: editing.pinned,
        reminder: editing.reminder,
        recurring: editing.recurring ? "Daily" : "None",
        status: 'Pending',
        completed: false,
      } as TaskItem);
      onShowNotification('Task created', 'Quick Focus');
    }
    setEditing(null);
    setPopupOpen(false);
    refresh();
  };

  const toggleComplete = (t: TaskItem) => {
    pushUndo();
    const done = !(t.completed || t.status === 'Completed');
    syncService.markComplete(t.id, done);
    refresh();
  };

  const deleteTask = (t: TaskItem) => {
    pushUndo();
    setDeletedBin((b) => [t, ...b].slice(0, 50));
    syncService.deleteTask(t.id);
    refresh();
    onShowNotification('Task deleted — restore from popup bin', 'Quick Focus');
  };

  const restoreDeleted = (t: TaskItem) => {
    pushUndo();
    syncService.addTask({
      ...t,
      id: undefined,
      title: t.title,
    } as any);
    setDeletedBin((b) => b.filter((x) => x.id !== t.id));
    refresh();
    onShowNotification('Task restored', 'Quick Focus');
  };

  const duplicateTask = (t: TaskItem) => {
    pushUndo();
    syncService.duplicateTask(t.id);
    refresh();
    onShowNotification('Task duplicated', 'Quick Focus');
  };

  const bulkComplete = () => {
    if (selectedIds.size === 0) return;
    pushUndo();
    selectedIds.forEach((id) => syncService.markComplete(id, true));
    setSelectedIds(new Set());
    refresh();
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    pushUndo();
    selectedIds.forEach((id) => {
      const t = allToday.find((x) => x.id === id);
      if (t) setDeletedBin((b) => [t, ...b].slice(0, 50));
      syncService.deleteTask(id);
    });
    setSelectedIds(new Set());
    refresh();
  };

  const importFromTimetable = () => {
    pushUndo();
    const existingTitles = new Set(allToday.map((t) => t.title + '|' + (t.startTime || '')));
    const plannerTasks = syncService.getTasks().filter((t) => t.dueDate === todayStr());
    let added = 0;
    plannerTasks.forEach((t) => {
      const key = t.title + '|' + (t.startTime || '');
      if (!existingTitles.has(key) && t.linkedSessionId) {
        // already present via getTodaysTasks
      }
      if (!existingTitles.has(key)) {
        existingTitles.add(key);
        added++;
      }
    });
    // Tasks already shared via same store — import is essentially "ensure visible"
    onShowNotification(
      added > 0
        ? `Timetable already in sync (${plannerTasks.length} session(s) today)`
        : `Synced ${plannerTasks.length} study session(s) for today`,
      'Quick Focus'
    );
    refresh();
  };

  const onDragStart = (id: string) => {
    dragId.current = id;
  };
  const onDrop = (targetId: string) => {
    if (!dragId.current || dragId.current === targetId) return;
    pushUndo();
    const order = tasks.map((t) => t.id);
    const from = order.indexOf(dragId.current);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragId.current);
    order.forEach((id, idx) => {
      const t = syncService.getTasks().find((x) => x.id === id);
      if (t) syncService.updateTask({ ...t, orderIndex: idx });
    });
    dragId.current = null;
    refresh();
  };

  // Keyboard shortcuts inside popup
  useEffect(() => {
    if (!popupOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopupOpen(false);
        setEditing(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setEditing(emptyDraft());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popupOpen, undoStack, redoStack]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    tasks.forEach((t) => {
      const c = t.category || 'Study';
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(t);
    });
    return map;
  }, [tasks]);

  return (
    <>
      <GlassCard
        className="space-y-3 p-4 cursor-pointer hover:ring-2 hover:ring-purple-200/80 transition-all"
        onClick={() => setPopupOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPopupOpen(true);
          }
        }}
        aria-label="Open Quick Focus planner"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" /> Today’s Focus
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {completed}/{total} done · {pct}% · click to manage
            </p>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-label={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 flex items-center gap-1 px-3 py-1.5 rounded-xl cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Today's Live Session Metrics Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[10px] font-bold">
          <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Focus</span>
            <span className="text-purple-600 font-mono">{todaySummary.focusTimeMinutes}m</span>
          </div>
          <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Break</span>
            <span className="text-teal-600 font-mono">{todaySummary.breakTimeMinutes}m</span>
          </div>
          <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Remaining</span>
            <span className="text-amber-600 font-mono">{todaySummary.remainingTimeMinutes}m</span>
          </div>
          <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
            <span className="text-slate-400">Score</span>
            <span className="text-emerald-600 font-mono">{todaySummary.dailyProductivityScore}%</span>
          </div>
        </div>

        {todaySummary.currentTask && (
          <div className="px-2.5 py-1.5 bg-purple-50/80 border border-purple-200/60 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-ping shrink-0" />
              <span className="font-extrabold text-purple-950 truncate">
                Current: {todaySummary.currentTask.title}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-purple-700 shrink-0">
              {todaySummary.currentTask.estimatedMinutes}m
            </span>
          </div>
        )}

        {!collapsed && (
          <>
            {total === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-bold text-slate-600">No tasks for today</p>
                <p className="text-xs text-slate-400">Click to open the planner and add your first focus item.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                {tasks.slice(0, 8).map((t) => {
                  const done = t.completed || t.status === 'Completed';
                  const isOver = overdue.some((o) => o.id === t.id);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left ${
                        done
                          ? 'bg-emerald-50/60 border-emerald-100 opacity-75'
                          : isOver
                            ? 'bg-rose-50 border-rose-200'
                            : 'bg-slate-50/80 border-slate-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(t);
                      }}
                    >
                      <button
                        type="button"
                        className="shrink-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComplete(t);
                        }}
                        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold truncate ${done ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {t.pinned && <Pin className="w-3 h-3 inline mr-1 text-amber-500" />}
                          {t.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate">
                          {t.startTime ? `${t.startTime} · ` : ''}
                          {t.subject || t.category || 'Study'}
                        </div>
                      </div>
                      {t.priority === 'High' && <Flag className="w-3 h-3 text-rose-500 shrink-0" />}
                    </div>
                  );
                })}
                {tasks.length > 8 && (
                  <p className="text-[10px] text-center text-slate-400 font-medium pt-1">
                    +{tasks.length - 8} more — open planner
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </GlassCard>

      {/* Material 3 style popup */}
      {popupOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick Focus Manager"
          onClick={() => {
            setPopupOpen(false);
            setEditing(null);
          }}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
              <div>
                <h3 className="text-base font-black text-slate-900">Quick Focus Manager</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {completed}/{total} · Offline · Synced with Planner
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={handleUndo} className="p-2 rounded-xl hover:bg-white cursor-pointer" title="Undo (Ctrl+Z)">
                  <Undo2 className="w-4 h-4 text-slate-600" />
                </button>
                <button type="button" onClick={handleRedo} className="p-2 rounded-xl hover:bg-white cursor-pointer" title="Redo">
                  <Redo2 className="w-4 h-4 text-slate-600" />
                </button>
                <button type="button" onClick={importFromTimetable} className="p-2 rounded-xl hover:bg-white cursor-pointer" title="Sync timetable">
                  <Import className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(emptyDraft())}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPopupOpen(false);
                    setEditing(null);
                  }}
                  className="p-2 rounded-xl hover:bg-white cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value as any)}
                className="text-xs rounded-xl border border-slate-200 px-2 py-1.5 cursor-pointer"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="text-xs rounded-xl border border-slate-200 px-2 py-1.5 cursor-pointer"
              >
                <option value="manual">Manual order</option>
                <option value="priority">Priority</option>
                <option value="due">Due time</option>
              </select>
              {selectedIds.size > 0 && (
                <>
                  <button type="button" onClick={bulkComplete} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 cursor-pointer">
                    Complete ({selectedIds.size})
                  </button>
                  <button type="button" onClick={bulkDelete} className="text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-700 cursor-pointer">
                    Delete ({selectedIds.size})
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="text-[11px] font-bold text-purple-600 flex items-center gap-0.5 cursor-pointer"
              >
                Full Planner <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* List */}
              <div className="md:col-span-3 space-y-2">
                {tasks.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm font-medium">No matching tasks</div>
                ) : (
                  Array.from(grouped.entries()).map(([cat, items]) => (
                    <div key={cat} className="space-y-1.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">{cat}</div>
                      {items.map((t) => {
                        const done = t.completed || t.status === 'Completed';
                        const sel = selectedIds.has(t.id);
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => onDragStart(t.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => onDrop(t.id)}
                            className={`flex items-start gap-2 p-2.5 rounded-2xl border ${
                              sel ? 'border-purple-400 bg-purple-50' : done ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-white'
                            }`}
                          >
                            <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 shrink-0 cursor-grab" />
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => {
                                setSelectedIds((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(t.id)) n.delete(t.id);
                                  else n.add(t.id);
                                  return n;
                                });
                              }}
                              className="mt-1 cursor-pointer"
                            />
                            <button type="button" className="mt-0.5 cursor-pointer" onClick={() => toggleComplete(t)}>
                              {done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-slate-400" />}
                            </button>
                            <button type="button" className="flex-1 text-left min-w-0 cursor-pointer" onClick={() => openEdit(t)}>
                              <div className={`text-xs font-bold ${done ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                {t.pinned && <Pin className="w-3 h-3 inline text-amber-500 mr-1" />}
                                {t.title}
                              </div>
                              <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-2">
                                {t.startTime && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Clock className="w-3 h-3" /> {t.startTime}
                                    {t.endTime ? `–${t.endTime}` : ''}
                                  </span>
                                )}
                                <span>{t.subject}</span>
                                {t.priority === 'High' && <span className="text-rose-500 font-bold">High</span>}
                              </div>
                            </button>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button type="button" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" onClick={() => duplicateTask(t)} title="Duplicate">
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                              <button type="button" className="p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer" onClick={() => deleteTask(t)} title="Delete">
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}

                {deletedBin.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Recently deleted</div>
                    {deletedBin.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-xs py-1">
                        <span className="text-slate-500 truncate">{t.title}</span>
                        <button type="button" className="text-purple-600 font-bold cursor-pointer" onClick={() => restoreDeleted(t)}>
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Editor */}
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5">
                {editing ? (
                  <>
                    <div className="text-[10px] font-black uppercase text-slate-400">
                      {editing.id ? 'Edit task' : 'New task'}
                    </div>
                    <input
                      value={editing.title || ''}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      placeholder="Title *"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      autoFocus
                    />
                    <textarea
                      value={editing.description || editing.notes || ''}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value, notes: e.target.value })}
                      placeholder="Notes / description"
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editing.priority || 'Medium'}
                        onChange={(e) => setEditing({ ...editing, priority: e.target.value as any })}
                        className="text-xs rounded-xl border border-slate-200 px-2 py-1.5"
                      >
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                      <select
                        value={editing.category || 'Study'}
                        onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                        className="text-xs rounded-xl border border-slate-200 px-2 py-1.5"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <select
                      value={editing.subject || ''}
                      onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                      className="w-full text-xs rounded-xl border border-slate-200 px-2 py-1.5"
                    >
                      {subjectOptions.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={editing.startTime || ''}
                        onChange={(e) => setEditing({ ...editing, startTime: e.target.value })}
                        className="text-xs rounded-xl border border-slate-200 px-2 py-1.5"
                      />
                      <input
                        type="time"
                        value={editing.endTime || ''}
                        onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
                        className="text-xs rounded-xl border border-slate-200 px-2 py-1.5"
                      />
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={editing.estimatedMinutes || 25}
                      onChange={(e) => setEditing({ ...editing, estimatedMinutes: Number(e.target.value) })}
                      className="w-full text-xs rounded-xl border border-slate-200 px-2 py-1.5"
                      placeholder="Duration (min)"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_TAGS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditing({ ...editing, colorTag: c })}
                          className={`w-6 h-6 rounded-full cursor-pointer border-2 ${editing.colorTag === c ? 'border-slate-900' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editing.pinned}
                        onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
                      />
                      Pin to top
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editing.reminder}
                        onChange={(e) => setEditing({ ...editing, reminder: e.target.checked })}
                      />
                      Offline reminder
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editing.recurring === "Daily"}
                        onChange={(e) => setEditing({ ...editing, recurring: e.target.checked ? "Daily" : "None" })}
                      />
                      Recurring daily
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={saveEditing}
                        className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-xs font-black cursor-pointer hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-10 text-center text-slate-400 text-xs font-medium space-y-2">
                    <MoreHorizontal className="w-8 h-8 mx-auto text-slate-300" />
                    <p>Select a task to edit, or create a new one.</p>
                    <p className="text-[10px]">Shortcuts: Ctrl+N new · Ctrl+Z undo · Esc close</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
