import React, { useState } from "react";
import { Note } from "../../types";
import { FileText, Plus, Search, Trash2 } from "lucide-react";

interface NotesPanelProps {
  notes: Note[];
  activePdfName: string;
  onCreateNote: () => void;
  onDeleteNote?: (id: string) => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  activePdfName,
  onCreateNote,
  onDeleteNote,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotes = (notes || []).filter((note) => {
    if (!note) return false;
    // Show notes created from this PDF or matched by title
    const matchesPdf = activePdfName && ((note as any).pdfMockName === activePdfName || note.content?.includes(activePdfName) || note.title?.includes(activePdfName));
    const matchesSearch = note.title?.toLowerCase().includes((searchQuery || "").toLowerCase()) || 
                          note.content?.toLowerCase().includes((searchQuery || "").toLowerCase());
    return (matchesPdf || searchQuery) && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-white text-slate-700">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Document Study Notes</span>
        <button
          onClick={onCreateNote}
          className="p-1 hover:bg-slate-50 text-purple-600 rounded flex items-center gap-1 text-[10px] font-extrabold cursor-pointer"
        >
          <Plus className="h-3 w-3" /> Add Note
        </button>
      </div>

      <div className="p-2 border-b border-slate-50 flex items-center gap-1.5">
        <Search className="h-3 w-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search study notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-[11px] bg-transparent focus:outline-none w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No study notes found for this document yet. Use the highlight or drag selection tool to capture snippets!
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="p-3 bg-slate-50/50 hover:bg-purple-50/10 border border-slate-100 rounded-xl space-y-1 transition-all group"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-black text-slate-800 leading-tight block">
                  {note.title || "Untitled Note"}
                </span>
                {onDeleteNote && (
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="p-1 text-slate-300 hover:text-pink-600 rounded transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap break-words">
                {note.content}
              </p>
              <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 pt-1">
                <FileText className="h-2.5 w-2.5" />
                <span>Modified: {new Date(note.lastModified || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
