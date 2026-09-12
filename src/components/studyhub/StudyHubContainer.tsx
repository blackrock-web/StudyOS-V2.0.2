import React, { useState, useEffect, useCallback } from 'react';
import { StudyHubView } from './StudyHubView';
import { AppState, Subject, Note, Task } from '../../types';
import { db } from '../../services/db';
import { SUBJECT_REGISTRY } from '../../data/subjectRegistry';

interface StudyHubContainerProps {
  onShowNotification: (msg: string, title?: string) => void;
  activeTab?: string;
}

function getHubStorageKey(): string {
  return `studyos_hub_app_state_v2_${db.getActiveExamId()}`;
}

const SUBJECT_COLORS = [
  '#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#6366f1', '#84cc16', '#f97316',
  '#14b8a6', '#a855f7', '#0ea5e9', '#e11d48',
];

/** Build Study Hub subjects from official GATE CS & DA hierarchy */
const defaultSubjects: Subject[] = SUBJECT_REGISTRY.map((reg, idx) => ({
  id: reg.id,
  name: reg.name,
  color: SUBJECT_COLORS[idx % SUBJECT_COLORS.length] || '#8b5cf6',
  chapters: reg.chapters.map((ch) => ({
    id: ch.id,
    name: ch.name,
    status: 'Not Started' as const,
    confidence: 1,
  })),
  progressPercent: 0,
}));

function loadHubState(): AppState {
  const activeExamId = db.getActiveExamId();
  const key = getHubStorageKey();
  try {
    let saved = localStorage.getItem(key);
    if (!saved && activeExamId === 'GATE2027') {
      saved = localStorage.getItem('studyos_hub_app_state_v2');
      if (saved) {
        localStorage.setItem(key, saved);
      }
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.subjects)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading StudyHub state:', e);
  }

  // Fallback for GATE2027
  if (activeExamId === 'GATE2027') {
    const first = defaultSubjects[0];
    return {
      subjects: defaultSubjects,
      notes: first
        ? [
            {
              id: 'note-1',
              subjectId: first.id,
              subjectName: first.name,
              title: `${first.name} — Starter Note`,
              content: 'Begin capturing concepts, theorems, and edge cases here.',
              tags: [first.name, 'GATE 2027'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isFavorite: true,
            },
          ]
        : [],
      flashcards: db.getFlashcards() || [],
      formulas: [
        {
          id: 'form-1',
          subjectId: 'subj-1',
          subjectName: 'Data Structures & Algorithms',
          category: 'Formula',
          title: 'Master Theorem Expansion',
          content: 'T(n) = aT(n/b) + f(n)',
          example: 'T(n) = 2T(n/2) + n log n -> Theta(n log^2 n)',
          tags: ['Master Theorem', 'Complexity'],
        },
      ],
      resources: [],
      tasks: [],
      profileXP: 320,
    };
  }

  // Non-GATE active exam: load subjects from active exam syllabus
  const syllabus = db.getSyllabus();
  const examSubjects: Subject[] = syllabus.map((sub, idx) => ({
    id: sub.id,
    name: sub.name,
    color: SUBJECT_COLORS[idx % SUBJECT_COLORS.length] || '#8b5cf6',
    chapters: (sub.topics || []).map((t, tIdx) => ({
      id: `${sub.id}-chap-${tIdx}`,
      name: t.name,
      status: t.status === 'Completed' ? 'Completed' : t.status === 'In Progress' ? 'In Progress' : 'Not Started',
      confidence: t.confidence || 1,
    })),
    progressPercent: 0,
  }));

  return {
    subjects: examSubjects,
    notes: [],
    flashcards: db.getFlashcards() || [],
    formulas: [],
    resources: [],
    tasks: [],
    profileXP: 0,
  };
}

export const StudyHubContainer: React.FC<StudyHubContainerProps> = ({
  onShowNotification,
  activeTab,
}) => {
  const [appState, setAppState] = useState<AppState>(loadHubState);

  // Reload hub state when active exam changes
  useEffect(() => {
    const handleExamChange = () => {
      setAppState(loadHubState());
    };

    window.addEventListener('studyos_active_exam_changed', handleExamChange);
    window.addEventListener('studyos_db_updated', handleExamChange);
    window.addEventListener('storage', handleExamChange);

    return () => {
      window.removeEventListener('studyos_active_exam_changed', handleExamChange);
      window.removeEventListener('studyos_db_updated', handleExamChange);
      window.removeEventListener('storage', handleExamChange);
    };
  }, []);

  // Map activeTab from App router to StudyHub subtab
  const [activeSubTab, setActiveSubTab] = useState<
    'dashboard' | 'subjects' | 'notes' | 'scratchpad' | 'formulas' | 'files'
  >(() => {
    if (activeTab === 'notes') return 'notes';
    if (activeTab === 'scratchpad') return 'scratchpad';
    if (activeTab === 'srs') return 'dashboard';
    if (activeTab === 'formula') return 'formulas';
    if (activeTab === 'pdf') return 'files';
    if (activeTab === 'subjects') return 'subjects';
    return 'dashboard';
  });

  useEffect(() => {
    if (activeTab === 'notes') setActiveSubTab('notes');
    else if (activeTab === 'scratchpad') setActiveSubTab('scratchpad');
    else if (activeTab === 'srs') setActiveSubTab('dashboard');
    else if (activeTab === 'formula') setActiveSubTab('formulas');
    else if (activeTab === 'pdf') setActiveSubTab('files');
    else if (activeTab === 'subjects') setActiveSubTab('subjects');
    else if (activeTab === 'study-hub' || activeTab === 'study-hub-dashboard') setActiveSubTab('dashboard');
  }, [activeTab]);

  // Persist State Updates
  const handleUpdateState = (updates: Partial<AppState>) => {
    setAppState((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(getHubStorageKey(), JSON.stringify(next));
      } catch (e) {
        console.error('Failed saving StudyHub state:', e);
      }
      return next;
    });
  };

  const handleTriggerNotification = (
    title: string,
    message: string,
    _type?: 'info' | 'warning' | 'success' | 'error' | 'alarm'
  ) => {
    onShowNotification(message, title);
  };

  const handleAddSubject = (name: string, color: string) => {
    const newSubj: Subject = {
      id: 'subj-' + Date.now(),
      name,
      color,
      chapters: [],
      progressPercent: 0,
    };
    handleUpdateState({ subjects: [...appState.subjects, newSubj] });
    onShowNotification(`Added subject: ${name}`, 'Study Hub');
  };

  const handleDeleteSubject = (id: string) => {
    const filtered = appState.subjects.filter((s) => s.id !== id);
    handleUpdateState({ subjects: filtered });
    onShowNotification('Subject deleted', 'Study Hub');
  };

  const handleAddChapter = (subjectId: string, name: string) => {
    const updated = appState.subjects.map((subj) => {
      if (subj.id === subjectId) {
        return {
          ...subj,
          chapters: [
            ...subj.chapters,
            {
              id: 'chap-' + Date.now(),
              name,
              status: 'Not Started' as const,
              confidence: 3,
            },
          ],
        };
      }
      return subj;
    });
    handleUpdateState({ subjects: updated });
    onShowNotification(`Added chapter: ${name}`, 'Study Hub');
  };

  const handleDeleteChapter = (subjectId: string, chapterId: string) => {
    const updated = appState.subjects.map((subj) => {
      if (subj.id === subjectId) {
        return {
          ...subj,
          chapters: subj.chapters.filter((c) => c.id !== chapterId),
        };
      }
      return subj;
    });
    handleUpdateState({ subjects: updated });
    onShowNotification('Chapter deleted', 'Study Hub');
  };

  const handleUpdateChapter = (subjectId: string, chapterId: string, updates: any) => {
    const updated = appState.subjects.map((subj) => {
      if (subj.id === subjectId) {
        return {
          ...subj,
          chapters: subj.chapters.map((chap) =>
            chap.id === chapterId ? { ...chap, ...updates } : chap
          ),
        };
      }
      return subj;
    });
    handleUpdateState({ subjects: updated });
  };

  const handleSaveAISchedule = (_schedule: any[]) => {
    onShowNotification('Study Schedule saved offline', 'Study Hub');
  };

  const handleAddNote = (note: any) => {
    const newNote: Note = {
      id: 'note-' + Date.now(),
      subjectId: note.subjectId || 'subj-1',
      subjectName: note.subjectName || 'General',
      title: note.title || 'Untitled Note',
      content: note.content || '',
      tags: note.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: note.isFavorite || false,
    };
    handleUpdateState({ notes: [newNote, ...appState.notes] });
    onShowNotification(`Saved Note: ${newNote.title}`, 'Smart Notes');
  };

  const handleUpdateNote = (id: string, updatedNote: any) => {
    const updated = appState.notes.map((n) =>
      n.id === id ? { ...n, ...updatedNote, updatedAt: new Date().toISOString() } : n
    );
    handleUpdateState({ notes: updated });
  };

  const handleDeleteNote = (id: string) => {
    const filtered = appState.notes.filter((n) => n.id !== id);
    handleUpdateState({ notes: filtered });
    onShowNotification('Note deleted', 'Smart Notes');
  };

  return (
    <StudyHubView
      state={appState}
      onUpdateState={handleUpdateState}
      onTriggerNotification={handleTriggerNotification}
      onAddSubject={handleAddSubject}
      onDeleteSubject={handleDeleteSubject}
      onAddChapter={handleAddChapter}
      onDeleteChapter={handleDeleteChapter}
      onUpdateChapter={handleUpdateChapter}
      onSaveAISchedule={handleSaveAISchedule}
      onAddNote={handleAddNote}
      onUpdateNote={handleUpdateNote}
      onDeleteNote={handleDeleteNote}
      activeSubTab={activeSubTab}
      onActiveSubTabChange={setActiveSubTab}
    />
  );
};
