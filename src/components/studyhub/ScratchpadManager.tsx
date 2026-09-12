import React, { useState, useEffect, useRef } from 'react';
import {
  FileEdit,
  Plus,
  Pin,
  Trash2,
  Copy,
  Download,
  Search,
  Clock,
  Sparkles,
  Check,
  AlertTriangle,
  FolderOpen,
  Calendar,
  Tag,
  CheckSquare,
  Code,
  Save,
  Star,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { ScratchpadNote } from '../../types';
import { db } from '../../services/db';

interface ScratchpadManagerProps {
  onShowNotification?: (msg: string, title?: string) => void;
  onOpenDrawer?: () => void;
}

export const ScratchpadManager: React.FC<ScratchpadManagerProps> = ({
  onShowNotification,
  onOpenDrawer,
}) => {
  const [notes, setNotes] = useState<ScratchpadNote[]>(() => db.getScratchpadNotes());
  const [activeNote, setActiveNote] = useState<ScratchpadNote | null>(() =>
    db.getScratchpadActiveNote()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pinned' | 'recent'>('all');
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<ScratchpadNote | null>(null);

  // Editable fields for active note
  const [editTitle, setEditTitle] = useState(activeNote?.title || '');
  const [editContent, setEditContent] = useState(activeNote?.content || '');

  // Debounced autosave ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with DB state
  const loadFromDb = () => {
    const currentNotes = db.getScratchpadNotes();
    setNotes(currentNotes);
    const currActive = db.getScratchpadActiveNote();
    if (currActive) {
      setActiveNote(currActive);
      setEditTitle(currActive.title);
      setEditContent(currActive.content);
    }
  };

  useEffect(() => {
    loadFromDb();
    const handleUpdate = () => loadFromDb();
    window.addEventListener('studyos_scratchpad_updated', handleUpdate);
    return () => window.removeEventListener('studyos_scratchpad_updated', handleUpdate);
  }, []);

  // Sync edits when active note changes
  useEffect(() => {
    if (activeNote) {
      setEditTitle(activeNote.title);
      setEditContent(activeNote.content);
    }
  }, [activeNote?.id]);

  // Execute immediate save function
  const triggerSaveNow = (titleVal: string, contentVal: string) => {
    if (!activeNote) return;
    const updated = db.saveScratchpadNote({
      id: activeNote.id,
      title: titleVal.trim() || 'Untitled Scratch Note',
      content: contentVal,
    });
    setActiveNote(updated);
    setNotes(db.getScratchpadNotes());
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  // Debounced auto-save (700ms)
  const handleContentChange = (val: string) => {
    setEditContent(val);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      triggerSaveNow(editTitle, val);
    }, 700);
  };

  const handleTitleChange = (val: string) => {
    setEditTitle(val);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      triggerSaveNow(val, editContent);
    }, 700);
  };

  // Window beforeunload safeguard to ensure pending saves are written immediately
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeNote) {
        db.saveScratchpadNote({
          id: activeNote.id,
          title: editTitle.trim() || 'Untitled Scratch Note',
          content: editContent,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeNote, editTitle, editContent]);

  const handleSelectNote = (note: ScratchpadNote) => {
    // Flush pending save before switching
    if (activeNote && (editTitle !== activeNote.title || editContent !== activeNote.content)) {
      triggerSaveNow(editTitle, editContent);
    }
    db.setScratchpadActiveNoteId(note.id);
    setActiveNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleCreateNew = () => {
    const newNote = db.saveScratchpadNote({
      title: `Scratch Note #${notes.length + 1}`,
      content: '',
      isPinned: false,
    });
    loadFromDb();
    if (onShowNotification) {
      onShowNotification(`Created new Scratch Pad Note`, 'Scratch Pad');
    }
  };

  const handleTogglePin = (note: ScratchpadNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = db.saveScratchpadNote({
      id: note.id,
      isPinned: !note.isPinned,
    });
    loadFromDb();
    if (onShowNotification) {
      onShowNotification(
        updated.isPinned ? 'Note pinned to top' : 'Note unpinned',
        'Scratch Pad'
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (!noteToDelete) return;
    db.deleteScratchpadNote(noteToDelete.id);
    setNoteToDelete(null);
    loadFromDb();
    if (onShowNotification) {
      onShowNotification('Scratch Pad note deleted', 'Scratch Pad');
    }
  };

  const handleClearAllConfirm = () => {
    db.clearScratchpadNotes();
    setShowClearConfirm(false);
    loadFromDb();
    if (onShowNotification) {
      onShowNotification('All Scratch Pad notes cleared', 'Scratch Pad');
    }
  };

  const handleCopyNote = (content: string) => {
    navigator.clipboard.writeText(content);
    if (onShowNotification) {
      onShowNotification('Copied note text to clipboard', 'Scratch Pad');
    }
  };

  const handleExportTxt = (note: ScratchpadNote) => {
    const blob = new Blob([`${note.title}\n\n${note.content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    if (onShowNotification) {
      onShowNotification('Exported note as .txt file', 'Scratch Pad');
    }
  };

  const handleExportAllJson = () => {
    const jsonStr = JSON.stringify(notes, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyos_scratchpad_notes_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (onShowNotification) {
      onShowNotification('Exported all Scratch Pad notes as JSON', 'Scratch Pad');
    }
  };

  const insertSnippet = (snippet: string) => {
    const updated = editContent ? `${editContent}\n${snippet}` : snippet;
    handleContentChange(updated);
  };

  const insertTimestamp = () => {
    const nowStr = `\n---\n⏱️ [${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] - `;
    insertSnippet(nowStr);
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    if (filterTab === 'pinned' && !note.isPinned) return false;
    if (filterTab === 'recent') {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      if (note.updatedAt < dayAgo) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      return matchTitle || matchContent;
    }
    return true;
  });

  const wordCount = editContent.trim() ? editContent.trim().split(/\s+/).length : 0;
  const charCount = editContent.length;

  return (
    <div className="flex flex-col h-full bg-slate-50/60 font-sans p-4 space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-purple-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/20 rounded-2xl border border-purple-400/30 text-purple-300">
            <FileEdit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Scratch Pad Manager</h2>
              <span className="text-[10px] bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full font-bold">
                100% Offline Persistence
              </span>
            </div>
            <p className="text-xs text-purple-200 mt-0.5">
              Autosaved thoughts, calculation scratchpads, and session notes scoped per workspace.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenDrawer && (
            <button
              onClick={onOpenDrawer}
              className="px-3.5 py-2 bg-purple-600/40 hover:bg-purple-600/60 border border-purple-400/30 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-purple-300" /> Open Floating Drawer
            </button>
          )}
          <button
            onClick={handleExportAllJson}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer"
            title="Export All Notes to JSON"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export JSON
          </button>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Scratch Note
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar List (4 cols) & Editor Panel (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Scratch Notes List */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col min-h-0 overflow-hidden">
          {/* Search & Tabs */}
          <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search scratch notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-xl font-bold">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({notes.length})
                </button>
                <button
                  onClick={() => setFilterTab('pinned')}
                  className={`px-2 py-1 rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                    filterTab === 'pinned'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Pin className="w-3 h-3 text-amber-500" /> Pinned
                </button>
                <button
                  onClick={() => setFilterTab('recent')}
                  className={`px-2 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                    filterTab === 'recent'
                      ? 'bg-white text-purple-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Recent
                </button>
              </div>

              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-[10px] text-rose-600 font-bold hover:underline px-1 cursor-pointer"
                title="Clear All Scratch Notes"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* List of Notes */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <FolderOpen className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">No scratch notes found.</p>
                <p className="text-[11px]">Click "New Scratch Note" to start jotting thoughts.</p>
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isActive = activeNote?.id === note.id;
                const snippet = note.content.trim().slice(0, 60) || 'Empty note...';
                return (
                  <div
                    key={note.id}
                    onClick={() => handleSelectNote(note)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                      isActive
                        ? 'bg-purple-50/80 border-purple-300 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        className={`text-xs font-extrabold truncate flex-1 ${
                          isActive ? 'text-purple-950' : 'text-slate-800'
                        }`}
                      >
                        {note.title || 'Untitled Scratch Note'}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleTogglePin(note, e)}
                          className={`p-1 rounded-md transition-all ${
                            note.isPinned
                              ? 'text-amber-500 bg-amber-50'
                              : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600'
                          }`}
                          title={note.isPinned ? 'Unpin Note' : 'Pin Note'}
                        >
                          <Pin className="w-3 h-3 fill-current" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteToDelete(note);
                          }}
                          className="p-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-all"
                          title="Delete Note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 font-mono mt-1 line-clamp-2 leading-relaxed">
                      {snippet}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-2 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(note.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>{note.content.length} chars</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Scratchpad Editor Workspace */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col min-h-0 overflow-hidden">
          {activeNote ? (
            <>
              {/* Active Note Header Bar */}
              <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Scratchpad Title..."
                    className="w-full bg-transparent font-black text-sm text-slate-900 focus:outline-none focus:bg-white focus:px-2 focus:py-1 focus:rounded-lg focus:ring-2 focus:ring-purple-400/30 border-none transition-all"
                  />
                  <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 mt-1">
                    <span>
                      Created:{' '}
                      {new Date(activeNote.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>
                      Updated:{' '}
                      {new Date(activeNote.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg">
                    {isSavedNotice ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3 text-emerald-500" /> Autosaving
                      </>
                    )}
                  </span>

                  <button
                    onClick={() => handleTogglePin(activeNote)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      activeNote.isPinned
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    title={activeNote.isPinned ? 'Unpin Note' : 'Pin Note'}
                  >
                    <Pin className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <button
                    onClick={() => handleCopyNote(editContent)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-all cursor-pointer"
                    title="Copy Note Text"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleExportTxt(activeNote)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer"
                    title="Export as .txt"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setNoteToDelete(activeNote)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Editor Snippets Toolbar */}
              <div className="px-3 py-1.5 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between text-xs shrink-0 overflow-x-auto">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={insertTimestamp}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Clock className="w-3 h-3 text-purple-600" /> Timestamp
                  </button>
                  <button
                    onClick={() => insertSnippet('- [ ] ')}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <CheckSquare className="w-3 h-3 text-purple-600" /> Task Checkbox
                  </button>
                  <button
                    onClick={() => insertSnippet('```\n// Formula or Calculation Step\n```')}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Code className="w-3 h-3 text-purple-600" /> Formula/Code
                  </button>
                </div>

                <div className="text-[10px] font-mono font-bold text-slate-400">
                  {wordCount} Words • {charCount} Chars
                </div>
              </div>

              {/* Editor Area */}
              <div className="flex-1 p-4 bg-white overflow-y-auto">
                <textarea
                  value={editContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Type or paste scratch pad notes, calculation steps, formula derivations, or session thoughts..."
                  className="w-full h-full resize-none font-mono text-xs text-slate-900 leading-relaxed border-none focus:outline-none focus:ring-0 bg-transparent placeholder-slate-400 custom-scrollbar"
                />
              </div>

              {/* Status Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium shrink-0">
                <div className="flex items-center gap-2 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Autosaves 500-1000ms after typing stops & on tab close</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-purple-700">
                  DB ID: {activeNote.id}
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <FileEdit className="w-12 h-12 mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No active scratch note selected</p>
              <button
                onClick={handleCreateNew}
                className="mt-3 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition-all cursor-pointer"
              >
                Create Scratch Note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Delete Note */}
      {noteToDelete && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 animate-fadeIn space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-black text-slate-900">Delete Scratch Pad Note?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete <span className="font-bold underline">{noteToDelete.title}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setNoteToDelete(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Delete Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Clear All Notes */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
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
                onClick={handleClearAllConfirm}
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
