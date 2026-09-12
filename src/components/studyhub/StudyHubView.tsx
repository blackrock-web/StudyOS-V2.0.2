import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  FileText,
  FileEdit,
  Calculator,
  Files,
  BookOpen,
  Sparkles,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { ScratchpadManager } from './ScratchpadManager';
import { SyllabusManager } from '../syllabus/SyllabusManager';
import { PDFWorkspace } from '../pdf/PDFWorkspace';
import { AppState, Subject, Note } from '../../types';

import { db } from '../../services/db';

export interface StudyHubViewProps {
  state: AppState;
  onUpdateState: (updates: Partial<AppState>) => void;
  onTriggerNotification?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error' | 'alarm') => void;
  onAddSubject: (name: string, color: string) => void;
  onDeleteSubject: (id: string) => void;
  onAddChapter: (subjectId: string, name: string) => void;
  onDeleteChapter: (subjectId: string, chapterId: string) => void;
  onUpdateChapter: (subjectId: string, chapterId: string, updates: any) => void;
  onSaveAISchedule?: (schedule: any[]) => void;
  onAddNote: (note: any) => void;
  onUpdateNote: (id: string, note: any) => void;
  onDeleteNote: (id: string) => void;
  activeSubTab?: 'dashboard' | 'subjects' | 'notes' | 'scratchpad' | 'formulas' | 'files';
  onActiveSubTabChange?: (tab: any) => void;
}

export const StudyHubView: React.FC<StudyHubViewProps> = ({
  state,
  onUpdateState,
  onTriggerNotification,
  onAddSubject,
  onDeleteSubject,
  onAddChapter,
  onDeleteChapter,
  onUpdateChapter,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  activeSubTab: propsActiveSubTab,
  onActiveSubTabChange,
}) => {
  const [activeExam, setActiveExam] = useState(() => db.getActiveExam());
  const [localActiveSubTab, setLocalActiveSubTab] = useState<
    'dashboard' | 'subjects' | 'notes' | 'scratchpad' | 'formulas' | 'files'
  >('dashboard');

  React.useEffect(() => {
    const handleExam = () => setActiveExam(db.getActiveExam());
    window.addEventListener('studyos_active_exam_changed', handleExam);
    window.addEventListener('studyos_exams_updated', handleExam);
    return () => {
      window.removeEventListener('studyos_active_exam_changed', handleExam);
      window.removeEventListener('studyos_exams_updated', handleExam);
    };
  }, []);

  const activeSubTab = propsActiveSubTab !== undefined ? propsActiveSubTab : localActiveSubTab;

  const setActiveSubTab = (tab: any) => {
    if (onActiveSubTabChange) {
      onActiveSubTabChange(tab);
    } else {
      setLocalActiveSubTab(tab);
    }
  };

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'subjects', name: 'Syllabus & Subjects', icon: Layers },
    { id: 'notes', name: 'Smart Notes', icon: FileText },
    { id: 'scratchpad', name: 'Scratch Pad', icon: FileEdit },
    { id: 'formulas', name: 'Formula Book', icon: Calculator },
    { id: 'files', name: 'PDF Workspace', icon: Files },
  ];

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#8b5cf6');
  const [showAddSubject, setShowAddSubject] = useState(false);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedNoteSubj, setSelectedNoteSubj] = useState(state.subjects[0]?.id || '');

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    onAddSubject(newSubjectName.trim(), newSubjectColor);
    setNewSubjectName('');
    setShowAddSubject(false);
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    const subj = state.subjects.find((s) => s.id === selectedNoteSubj);
    onAddNote({
      title: noteTitle.trim(),
      content: noteContent.trim(),
      subjectId: selectedNoteSubj || 'subj-1',
      subjectName: subj ? subj.name : 'General',
    });
    setNoteTitle('');
    setNoteContent('');
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden p-6 gap-4 text-slate-700 font-sans select-none">
      {/* Top Header & SubTab Navigation */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-purple-100 shadow-xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Study Hub Engine</h2>
            <p className="text-xs text-slate-500 font-medium">100% Offline Workspace • {activeExam?.title || 'Active Exam'} Syllabus & Notes</p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSubTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Tab Content Render */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* 1. DASHBOARD SUBTAB */}
        {activeSubTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 animate-fadeIn">
            <SyllabusManager
              onShowNotification={(msg, title) => onTriggerNotification?.(title || 'Syllabus', msg, 'info')}
            />
          </div>
        )}

        {/* 2. SYLLABUS & SUBJECTS SUBTAB */}
        {activeSubTab === 'subjects' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 animate-fadeIn">
            <SyllabusManager
              onShowNotification={(msg, title) => onTriggerNotification?.(title || 'Syllabus', msg, 'info')}
            />
          </div>
        )}

        {/* 3. NOTES SUBTAB */}
        {activeSubTab === 'notes' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Note Creator Form */}
              <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Create Quick Note</span>
                </h3>
                <form onSubmit={handleCreateNote} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                    <select
                      value={selectedNoteSubj}
                      onChange={(e) => setSelectedNoteSubj(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {state.subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Note Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Master Theorem Cases & Complexity"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Content</label>
                    <textarea
                      rows={4}
                      placeholder="Write key equations, formulas, or conceptual notes..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Save Note</span>
                  </button>
                </form>
              </div>

              {/* Notes List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900">Saved Notes ({state.notes.length})</h3>
                </div>

                {state.notes.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                    No notes saved yet. Use the form on the left to write notes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {state.notes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                              {note.subjectName || 'General'}
                            </span>
                            <button
                              onClick={() => onDeleteNote(note.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete Note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 mb-1">{note.title}</h4>
                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{note.content}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3.5 SCRATCHPAD SUBTAB */}
        {activeSubTab === 'scratchpad' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar animate-fadeIn">
            <ScratchpadManager
              onShowNotification={(msg, title) => onTriggerNotification?.(title || 'Scratch Pad', msg, 'info')}
            />
          </div>
        )}

        {/* 5. FORMULA BOOK SUBTAB */}
        {activeSubTab === 'formulas' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-2xl p-6 border border-purple-100 shadow-xs space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <Calculator className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="font-black text-sm text-slate-900">GATE CS Formula & Theorem Book</h3>
                <p className="text-xs text-slate-500">Quick reference for discrete math, algorithms, and theory</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                <span className="text-[10px] font-bold text-purple-600 uppercase">Algorithms</span>
                <h4 className="font-bold text-xs text-slate-900">Master Theorem</h4>
                <p className="text-xs font-mono text-slate-700 bg-white p-2 rounded-lg border border-slate-200 mt-1">
                  T(n) = aT(n/b) + f(n)
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Operating Systems</span>
                <h4 className="font-bold text-xs text-slate-900">Effective Access Time (Paging)</h4>
                <p className="text-xs font-mono text-slate-700 bg-white p-2 rounded-lg border border-slate-200 mt-1">
                  EAT = h(t + m) + (1-h)(t + 2m)
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                <span className="text-[10px] font-bold text-pink-600 uppercase">Discrete Math</span>
                <h4 className="font-bold text-xs text-slate-900">Handshaking Lemma</h4>
                <p className="text-xs font-mono text-slate-700 bg-white p-2 rounded-lg border border-slate-200 mt-1">
                  ∑ deg(v) = 2 |E|
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 6. PDF WORKSPACE SUBTAB */}
        {activeSubTab === 'files' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-fadeIn h-full">
            <PDFWorkspace
              state={state}
              onUpdateState={onUpdateState}
              onTriggerNotification={(title, msg, type) => onTriggerNotification?.(title || 'PDF Workspace', msg, (type as any) || 'info')}
            />
          </div>
        )}
      </div>
    </div>
  );
};
