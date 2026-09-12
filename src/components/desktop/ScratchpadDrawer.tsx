import React, { useState, useEffect, useRef } from 'react';
import {
  Edit3,
  X,
  Copy,
  Trash2,
  Clock,
  CheckSquare,
  Code,
  Sparkles,
  Save,
  Plus,
  Pin,
  ChevronDown,
  Download,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { ScratchpadNote } from '../../types';
import { db } from '../../services/db';

interface ScratchpadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeExamTitle?: string;
  onShowNotification?: (msg: string, title?: string) => void;
}

export const ScratchpadDrawer: React.FC<ScratchpadDrawerProps> = ({
  isOpen,
  onClose,
  activeExamTitle = 'Active Workspace',
  onShowNotification,
}) => {
  const [allNotes, setAllNotes] = useState<ScratchpadNote[]>(() => db.getScratchpadNotes());
  const [activeNote, setActiveNote] = useState<ScratchpadNote>(() => db.getScratchpadActiveNote());
  const [editTitle, setEditTitle] = useState<string>(activeNote?.title || '');
  const [noteText, setNoteText] = useState<string>(activeNote?.content || '');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [showNoteSelector, setShowNoteSelector] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncStateFromDb = () => {
    const notes = db.getScratchpadNotes();
    setAllNotes(notes);
    const active = db.getScratchpadActiveNote();
    if (active) {
      setActiveNote(active);
      setEditTitle(active.title);
      setNoteText(active.content);
    }
  };

  useEffect(() => {
    if (isOpen) {
      syncStateFromDb();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      syncStateFromDb();
    };
    window.addEventListener('studyos_scratchpad_updated', handleUpdate);
    return () => window.removeEventListener('studyos_scratchpad_updated', handleUpdate);
  }, []);

  const executeSaveNow = (titleVal: string, contentVal: string) => {
    if (!activeNote) return;
    const updated = db.saveScratchpadNote({
      id: activeNote.id,
      title: titleVal.trim() || 'Untitled Scratch Note',
      content: contentVal,
    });
    setActiveNote(updated);
    setAllNotes(db.getScratchpadNotes());
    setLastSavedTime(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  };

  // Debounced autosave (700ms)
  const handleContentChange = (val: string) => {
    setNoteText(val);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      executeSaveNow(editTitle, val);
    }, 700);
  };

  const handleTitleChange = (val: string) => {
    setEditTitle(val);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      executeSaveNow(val, noteText);
    }, 700);
  };

  // Window beforeunload listener to guarantee saves on tab/window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeNote) {
        db.saveScratchpadNote({
          id: activeNote.id,
          title: editTitle.trim() || 'Untitled Scratch Note',
          content: noteText,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeNote, editTitle, noteText]);

  const handleSelectNote = (note: ScratchpadNote) => {
    executeSaveNow(editTitle, noteText);
    db.setScratchpadActiveNoteId(note.id);
    setActiveNote(note);
    setEditTitle(note.title);
    setNoteText(note.content);
    setShowNoteSelector(false);
  };

  const handleCreateNew = () => {
    executeSaveNow(editTitle, noteText);
    const created = db.saveScratchpadNote({
      title: `Scratch Note #${allNotes.length + 1}`,
      content: '',
      isPinned: false,
    });
    syncStateFromDb();
    setShowNoteSelector(false);
    if (onShowNotification) {
      onShowNotification('Created new scratch note', 'Scratchpad');
    }
  };

  const handleTogglePin = () => {
    if (!activeNote) return;
    const updated = db.saveScratchpadNote({
      id: activeNote.id,
      isPinned: !activeNote.isPinned,
    });
    syncStateFromDb();
    if (onShowNotification) {
      onShowNotification(
        updated.isPinned ? 'Note pinned' : 'Note unpinned',
        'Scratchpad'
      );
    }
  };

  const insertSnippet = (snippet: string) => {
    const updated = noteText ? `${noteText}\n${snippet}` : snippet;
    handleContentChange(updated);
  };

  const insertTimestamp = () => {
    const nowStr = `\n---\n⏱️ [${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] - `;
    insertSnippet(nowStr);
  };

  const handleCopy = () => {
    if (!noteText) return;
    navigator.clipboard.writeText(noteText);
    if (onShowNotification) {
      onShowNotification('Scratchpad notes copied to clipboard!', 'Scratchpad');
    }
  };

  const handleExportTxt = () => {
    const blob = new Blob([`${editTitle}\n\n${noteText}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(editTitle || 'scratchpad').toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    if (onShowNotification) {
      onShowNotification('Exported note as .txt file', 'Scratchpad');
    }
  };

  const handleConfirmClear = () => {
    db.clearScratchpadNotes();
    setShowClearConfirm(false);
    syncStateFromDb();
    if (onShowNotification) {
      onShowNotification('Cleared scratchpad notes.', 'Scratchpad');
    }
  };

  if (!isOpen) return null;

  const wordCount = noteText.trim() ? noteText.trim().split(/\s+/).length : 0;
  const charCount = noteText.length;

  return (
    <div className="fixed inset-0 z-[999999] flex justify-end bg-slate-950/40 backdrop-blur-xs animate-fadeIn font-sans select-none">
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-md h-full border-l border-purple-200/80 shadow-2xl flex flex-col justify-between overflow-hidden animate-slideLeft">
        {/* Header */}
        <div className="p-5 border-b border-purple-100 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white relative shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  Session Scratchpad
                </h3>
                <p className="text-[11px] text-purple-200 font-medium">
                  Workspace: <span className="font-bold underline">{activeExamTitle}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Note Switcher Bar */}
          <div className="relative mt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNoteSelector(!showNoteSelector)}
                className="flex-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white flex items-center justify-between border border-white/15 transition-all cursor-pointer"
              >
                <span className="truncate flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                  {editTitle || 'Untitled Scratch Note'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-purple-300 shrink-0" />
              </button>
              <button
                onClick={handleCreateNew}
                className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl transition-all cursor-pointer shrink-0"
                title="New Scratch Note"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Note Selector Dropdown */}
            {showNoteSelector && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-purple-500/30 rounded-xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                {allNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      activeNote?.id === note.id
                        ? 'bg-purple-600/40 text-purple-200 border border-purple-400/40'
                        : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <span className="truncate pr-2">{note.title || 'Untitled Note'}</span>
                    {note.isPinned && <Pin className="w-3 h-3 text-amber-400 shrink-0 fill-current" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-purple-200 pt-2">
            <span className="flex items-center gap-1">
              <Save className="w-3 h-3 text-emerald-400" />
              {lastSavedTime ? `Auto-saved at ${lastSavedTime}` : 'Autosaved in Local Database'}
            </span>
            <span>
              {wordCount} Words • {charCount} Chars
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <div className="flex items-center space-x-1">
            <button
              onClick={insertTimestamp}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-700 text-slate-700 flex items-center gap-1 transition-all cursor-pointer text-[11px]"
              title="Insert Time Stamp"
            >
              <Clock className="w-3 h-3 text-purple-600" /> Time
            </button>
            <button
              onClick={() => insertSnippet('- [ ] ')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-700 text-slate-700 flex items-center gap-1 transition-all cursor-pointer text-[11px]"
              title="Insert Todo Checkbox"
            >
              <CheckSquare className="w-3 h-3 text-purple-600" /> Task
            </button>
            <button
              onClick={() => insertSnippet('```\n// Code or Formula Snippet\n```')}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-700 text-slate-700 flex items-center gap-1 transition-all cursor-pointer text-[11px]"
              title="Insert Code Block"
            >
              <Code className="w-3 h-3 text-purple-600" /> Code
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                activeNote?.isPinned
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-amber-600'
              }`}
              title={activeNote?.isPinned ? 'Unpin Note' : 'Pin Note'}
            >
              <Pin className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              onClick={handleExportTxt}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer"
              title="Export .txt"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-all cursor-pointer"
              title="Copy All Notes"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
              title="Clear Scratchpad Notes"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title Input & Text Area Content */}
        <div className="flex-1 p-4 bg-white/80 overflow-y-auto flex flex-col space-y-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Title (Optional)..."
            className="w-full font-bold text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />

          <textarea
            value={noteText}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Jot down quick thoughts, temporary calculation steps, formula derivations, or key insights during study sessions..."
            className="w-full flex-1 resize-none font-mono text-xs text-slate-900 leading-relaxed border-none focus:outline-none focus:ring-0 bg-transparent placeholder-slate-400 custom-scrollbar"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Persists offline per account & exam</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-fadeIn space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-black text-slate-900">Clear All Scratch Notes?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to clear all scratch pad notes for this workspace? This will reset your scratchpad database collection.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Clear All Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
