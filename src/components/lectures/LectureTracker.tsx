import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Calendar,
  RotateCcw,
  CheckCircle2,
  Play,
  Pause,
  FastForward,
  Bookmark,
  FileText,
  Filter,
  Search,
  Sparkles,
  Award,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { db } from '../../services/db';
import { analyticsService } from '../../services/analyticsService';
import { PWLectureRecord } from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { PlannerView } from '../planner/PlannerView';

interface LectureTrackerProps {
  onShowNotification: (msg: string, title?: string) => void;
  onNavigate?: (tab: string) => void;
}

export const LectureTracker: React.FC<LectureTrackerProps> = ({ onShowNotification, onNavigate }) => {
  const [activeMode, setActiveMode] = useState<'planner' | 'table'>('planner');
  const [lectures, setLectures] = useState<PWLectureRecord[]>(db.getLectures());
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportLecturesJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text);
        // Detect lecture-plan shape (subjects with chapters) vs flat lecture records
        const isPlanShape =
          Array.isArray(data) &&
          data.length > 0 &&
          data[0] &&
          Array.isArray(data[0].chapters);

        if (isPlanShape) {
          const { subjectCount, chapterCount } = db.importLecturePlansReplace(data);
          setLectures(db.getLectures());
          onShowNotification(
            `Synced to latest import: ${subjectCount} subjects / ${chapterCount} chapters (old data cleared).`,
            'Lecture Planner'
          );
        } else {
          const { count } = db.importLecturesReplace(data);
          setLectures(db.getLectures());
          onShowNotification(
            `Imported ${count} lectures (previous lecture data fully replaced).`,
            'Lecture Planner'
          );
        }
      } catch (err: any) {
        onShowNotification(err?.message || 'Invalid lecture JSON file', 'Import Error');
      }
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const handleSync = () => {
      setLectures(db.getLectures());
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('studyos_lectures_updated', handleSync);
    window.addEventListener('studyos_lecture_plans_updated', handleSync);
    window.addEventListener('studyos_active_exam_changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('studyos_lectures_updated', handleSync);
      window.removeEventListener('studyos_lecture_plans_updated', handleSync);
      window.removeEventListener('studyos_active_exam_changed', handleSync);
    };
  }, []);
  const settings = db.getSettings();
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modals state
  const [editingNotesLecture, setEditingNotesLecture] = useState<PWLectureRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingLecture, setEditingLecture] = useState<PWLectureRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state for Add/Edit
  const [formData, setFormData] = useState<{
    subject: string;
    chapter: string;
    originalDate: string;
    reanchoredDate: string;
    durationMinutes: number;
    dpp: string;
    weeklyTest: string;
    status: PWLectureRecord['status'];
    watchSpeed: number;
    notes: string;
  }>({
    subject: db.getCurrentExamSubjects()[0] || 'General Studies',
    chapter: '',
    originalDate: new Date().toISOString().split('T')[0] || '',
    reanchoredDate: new Date().toISOString().split('T')[0] || '',
    durationMinutes: 90,
    dpp: '',
    weeklyTest: '',
    status: 'Pending',
    watchSpeed: 1,
    notes: '',
  });

  const handleReanchor = () => {
    if (onNavigate) {
      onNavigate('settings-database');
    } else {
      onShowNotification('Navigate to Settings -> Database & Backup to use Re-Anchor Engine', 'Date Re-Anchoring Engine');
    }
  };

  const handleResetCanonical = () => {
    db.resetLecturesToCanonical();
    setLectures(db.getLectures());
    onShowNotification('Lectures restored to canonical PW database state.', 'Database Reset');
  };

  const handleUpdateStatus = (id: string, newStatus: PWLectureRecord['status']) => {
    const lecture = lectures.find((l) => l.id === id);
    if (lecture) {
      const updated = {
        ...lecture,
        status: newStatus,
        timeSpentMinutes: newStatus === 'Completed' ? lecture.durationMinutes : lecture.timeSpentMinutes,
      };
      db.updateLecture(updated);
      setLectures(db.getLectures());
      if (newStatus === 'Completed') {
        db.logStudyMinutes('lectureMinutes', lecture.durationMinutes);
      }
      onShowNotification(`Lecture status: ${newStatus}`, 'PW Lecture Tracker');
    }
  };

  const handleUpdateSpeed = (id: string, speed: number) => {
    const lecture = lectures.find((l) => l.id === id);
    if (lecture) {
      const updated = { ...lecture, watchSpeed: speed };
      db.updateLecture(updated);
      setLectures(db.getLectures());
    }
  };

  const openAddModal = () => {
    const examSubjects = db.getCurrentExamSubjects();
    setFormData({
      subject: examSubjects[0] || 'General Studies',
      chapter: '',
      originalDate: new Date().toISOString().split('T')[0] || '',
      reanchoredDate: new Date().toISOString().split('T')[0] || '',
      durationMinutes: 90,
      dpp: '',
      weeklyTest: '',
      status: 'Pending',
      watchSpeed: 1,
      notes: '',
    });
    setShowAddModal(true);
  };

  const openEditModal = (lec: PWLectureRecord) => {
    setEditingLecture(lec);
    setFormData({
      subject: lec.subject,
      chapter: lec.chapter,
      originalDate: lec.originalDate,
      reanchoredDate: lec.reanchoredDate,
      durationMinutes: lec.durationMinutes,
      dpp: lec.dpp || '',
      weeklyTest: lec.weeklyTest || '',
      status: lec.status,
      watchSpeed: lec.watchSpeed || 1,
      notes: lec.notes || '',
    });
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.chapter.trim()) return;

    const newRec: PWLectureRecord = {
      id: 'lec-custom-' + Date.now(),
      subject: formData.subject,
      chapter: formData.chapter,
      lectureNumber: lectures.length + 1,
      originalDate: formData.originalDate,
      reanchoredDate: formData.reanchoredDate,
      durationMinutes: Number(formData.durationMinutes) || 90,
      timeSpentMinutes: formData.status === 'Completed' ? Number(formData.durationMinutes) : 0,
      dpp: formData.dpp,
      weeklyTest: formData.weeklyTest,
      status: formData.status,
      watchSpeed: formData.watchSpeed,
      notes: formData.notes,
      dppCompleted: false,
      bookmarkTimestamp: '',
      revisionCount: 0,
      confidence: 3,
      mistakesLogged: '',
    };

    db.addLecture(newRec);
    if (newRec.status === 'Completed') {
      analyticsService.trackLectureCompleted(newRec.subject, newRec.chapter, newRec.durationMinutes);
    } else {
      analyticsService.trackLectureStarted(newRec.subject, newRec.chapter);
    }
    setLectures(db.getLectures());
    setShowAddModal(false);
    onShowNotification(`Added new lecture: "${formData.chapter}"`, 'Lecture Planner');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecture || !formData.chapter.trim()) return;

    const updated: PWLectureRecord = {
      ...editingLecture,
      subject: formData.subject,
      chapter: formData.chapter,
      originalDate: formData.originalDate,
      reanchoredDate: formData.reanchoredDate,
      durationMinutes: Number(formData.durationMinutes) || 90,
      dpp: formData.dpp,
      weeklyTest: formData.weeklyTest,
      status: formData.status,
      watchSpeed: formData.watchSpeed,
      notes: formData.notes,
    };

    db.updateLecture(updated);
    setLectures(db.getLectures());
    setEditingLecture(null);
    onShowNotification(`Updated lecture: "${formData.chapter}"`, 'Lecture Planner');
  };

  const handleDeleteConfirm = () => {
    if (!deletingId) return;
    db.deleteLecture(deletingId);
    setLectures(db.getLectures());
    setDeletingId(null);
    onShowNotification('Lecture deleted successfully', 'Lecture Planner');
  };

  const handleMoveUp = (id: string) => {
    const idx = lectures.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const newLectures = [...lectures];
    const itemCurrent = newLectures[idx];
    const itemPrev = newLectures[idx - 1];
    if (itemCurrent && itemPrev) {
      newLectures[idx - 1] = itemCurrent;
      newLectures[idx] = itemPrev;
      db.setLectures(newLectures);
      setLectures(db.getLectures());
      onShowNotification(`Moved lecture up in sequence`, 'Lecture Reordered');
    }
  };

  const handleMoveDown = (id: string) => {
    const idx = lectures.findIndex((l) => l.id === id);
    if (idx < 0 || idx >= lectures.length - 1) return;
    const newLectures = [...lectures];
    const itemCurrent = newLectures[idx];
    const itemNext = newLectures[idx + 1];
    if (itemCurrent && itemNext) {
      newLectures[idx + 1] = itemCurrent;
      newLectures[idx] = itemNext;
      db.setLectures(newLectures);
      setLectures(db.getLectures());
      onShowNotification(`Moved lecture down in sequence`, 'Lecture Reordered');
    }
  };

  // Unique subjects for filter dropdown
  const examSubjects = db.getCurrentExamSubjects();
  const subjects = Array.from(new Set([...examSubjects, ...lectures.map((l) => l.subject)]));

  const filteredLectures = lectures.filter((l) => {
    if (subjectFilter !== 'ALL' && l.subject !== subjectFilter) return false;
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        l.subject.toLowerCase().includes(q) ||
        l.chapter.toLowerCase().includes(q) ||
        l.dpp.toLowerCase().includes(q) ||
        l.weeklyTest.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-[#1e1b4b] font-sans select-none">
      {/* CONDITIONAL RENDER: PLANNER vs TABLE */}
      {activeMode === 'planner' ? (
        <PlannerView onShowNotification={onShowNotification} activeTab="lectures" />
      ) : (
        <>
          {/* Filters and Search */}
          <GlassCard className="p-3 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <button
                onClick={() => setActiveMode('planner')}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all shrink-0 flex items-center gap-1"
              >
                ← Back to Planner
              </button>
              <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportLecturesJSON} />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-teal-100 text-teal-800 hover:bg-teal-200 transition-all shrink-0"
              >
                Import JSON (Replace)
              </button>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-purple-600 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search lectures, DPPs, tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-purple-100 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
              {/* Subject Filter */}
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="bg-slate-50 border border-purple-100 text-xs text-slate-800 font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All Subjects ({subjects.length})</option>
                {subjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-purple-100 text-xs text-slate-800 font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Skipped">Skipped</option>
                <option value="Paused">Paused</option>
                <option value="Rewatched">Rewatched</option>
              </select>

              <button
                onClick={openAddModal}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white flex items-center gap-1 shadow-xs hover:opacity-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Lecture
              </button>
              <button
                onClick={handleResetCanonical}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-purple-50 text-slate-700 flex items-center gap-1 border border-purple-200/80 shadow-2xs transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-purple-600" /> Reset
              </button>
            </div>
          </GlassCard>

      {/* Lecture Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-purple-50/70 border-b border-purple-100 text-[10px] font-black uppercase text-purple-700 tracking-wider">
                <th className="p-3.5">#</th>
                <th className="p-3.5">Subject</th>
                <th className="p-3.5">Chapter</th>
                <th className="p-3.5">Original Date</th>
                <th className="p-3.5">Re-Anchored Date</th>
                <th className="p-3.5">DPP</th>
                <th className="p-3.5">Test</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Speed</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50 text-xs">
              {filteredLectures.map((lec, idx) => (
                <tr
                  key={lec.id}
                  className="hover:bg-purple-50/50 transition-all hover:-translate-y-0.5 hover:shadow-xs group"
                >
                  <td className="p-3.5 font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="p-3.5 font-extrabold text-slate-900">{lec.subject}</td>
                  <td className="p-3.5 text-slate-700 font-medium max-w-xs truncate" title={lec.chapter}>
                    {lec.chapter}
                  </td>
                  <td className="p-3.5 font-mono text-slate-400 font-medium">{lec.originalDate}</td>
                  <td className="p-3.5 font-mono text-emerald-600 font-extrabold">{lec.reanchoredDate}</td>
                  <td className="p-3.5">
                    {lec.dpp ? (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-mono text-[10px] font-extrabold border border-purple-200">
                        {lec.dpp}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="p-3.5">
                    {lec.weeklyTest ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] border border-amber-200 font-extrabold">
                        {lec.weeklyTest}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <select
                      value={lec.status}
                      onChange={(e) => handleUpdateStatus(lec.id, e.target.value as any)}
                      className={`text-[11px] font-extrabold px-2 py-1 rounded-xl border focus:outline-none transition-all ${
                        lec.status === 'Completed'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : lec.status === 'Skipped'
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : lec.status === 'Rewatched'
                          ? 'bg-purple-50 border-purple-200 text-purple-700'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Skipped">Skipped</option>
                      <option value="Paused">Paused</option>
                      <option value="Rewatched">Rewatched</option>
                    </select>
                  </td>
                  <td className="p-3.5 font-mono">
                    <select
                      value={lec.watchSpeed}
                      onChange={(e) => handleUpdateSpeed(lec.id, parseFloat(e.target.value))}
                      className="bg-white border border-slate-200 text-[11px] font-bold text-slate-700 rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value={1}>1.0x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2.0x</option>
                    </select>
                  </td>
                  <td className="p-3.5 text-right flex items-center justify-end space-x-1">
                    <button
                      onClick={() => handleMoveUp(lec.id)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 disabled:opacity-30 disabled:hover:bg-slate-100 border border-slate-200/80 transition-all"
                      title="Move Up in Sequence"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(lec.id)}
                      disabled={idx === filteredLectures.length - 1}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 disabled:opacity-30 disabled:hover:bg-slate-100 border border-slate-200/80 transition-all"
                      title="Move Down in Sequence"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingNotesLecture(lec)}
                      className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 transition-all"
                      title="Lecture Notes & Mistakes Log"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(lec)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 transition-all"
                      title="Edit Lecture Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingId(lec.id)}
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all"
                      title="Delete Lecture"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
      </>
      )}

      {/* ADD / EDIT LECTURE MODAL */}
      {(showAddModal || editingLecture) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <Clock className="w-4 h-4 text-purple-600" />
                {showAddModal ? 'Add New Lecture / Task' : 'Edit Lecture Details'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLecture(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleSaveAdd : handleSaveEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. Algorithms"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chapter / Lecture Title</label>
                <input
                  type="text"
                  required
                  value={formData.chapter}
                  onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Asymptotic Notation & Recurrences"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Original Date</label>
                  <input
                    type="date"
                    value={formData.originalDate}
                    onChange={(e) => setFormData({ ...formData, originalDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Re-Anchored Date</label>
                  <input
                    type="date"
                    value={formData.reanchoredDate}
                    onChange={(e) => setFormData({ ...formData, reanchoredDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">DPP Code / Title</label>
                  <input
                    type="text"
                    value={formData.dpp}
                    onChange={(e) => setFormData({ ...formData, dpp: e.target.value })}
                    placeholder="e.g. DPP 01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Weekly Test Code</label>
                  <input
                    type="text"
                    value={formData.weeklyTest}
                    onChange={(e) => setFormData({ ...formData, weeklyTest: e.target.value })}
                    placeholder="e.g. Test 01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Skipped">Skipped</option>
                    <option value="Paused">Paused</option>
                    <option value="Rewatched">Rewatched</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Watch Speed</label>
                  <select
                    value={formData.watchSpeed}
                    onChange={(e) => setFormData({ ...formData, watchSpeed: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-purple-100 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={1}>1.0x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2.0x</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes / Key Takeaways</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Formulas, doubt notes..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-100 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingLecture(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white shadow-md hover:opacity-95 transition-all"
                >
                  {showAddModal ? 'Create Lecture' : 'Save Details'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Delete Lecture?</h3>
              <p className="text-xs text-slate-500 mt-1">This will permanently remove this lecture from your local planner database.</p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 text-white hover:bg-rose-700 shadow-md"
              >
                Delete Lecture
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Lecture Notes Modal */}
      {editingNotesLecture && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <FileText className="w-4 h-4 text-purple-600" /> Lecture Notes & Mistakes Log
            </h3>
            <div className="text-xs text-purple-700 font-extrabold" title={editingNotesLecture.chapter}>
              {editingNotesLecture.subject} • {editingNotesLecture.chapter}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Lecture Key Concept Notes:</label>
                <textarea
                  rows={4}
                  value={editingNotesLecture.notes}
                  onChange={(e) => setEditingNotesLecture({ ...editingNotesLecture, notes: e.target.value })}
                  placeholder="Write formulas, algorithms, or doubt timestamps here..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-100 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Logged Mistakes / Doubts:</label>
                <textarea
                  rows={2}
                  value={editingNotesLecture.mistakesLogged}
                  onChange={(e) => setEditingNotesLecture({ ...editingNotesLecture, mistakesLogged: e.target.value })}
                  placeholder="Note down questions you got wrong..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-purple-100 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-purple-100">
              <button
                onClick={() => setEditingNotesLecture(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  db.updateLecture(editingNotesLecture);
                  setLectures(db.getLectures());
                  setEditingNotesLecture(null);
                  onShowNotification('Notes saved to local SQLite', 'Lecture Tracker');
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white shadow-md hover:opacity-95 transition-all"
              >
                Save Notes
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
