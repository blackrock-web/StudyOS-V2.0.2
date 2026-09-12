import React, { useState, useEffect } from "react";
import {
  Highlighter,
  FileText,
  Brain,
  Calculator,
  Camera,
  Star,
  Copy,
  CheckSquare,
  Tag,
  CalendarRange,
  X,
  Sparkles,
  StickyNote,
  ChevronDown
} from "lucide-react";
import { getActiveProvider } from "../../services/aiProvider";

const HIGHLIGHT_COLORS = [
  { name: "Yellow", value: "#fde047", textClass: "text-yellow-400", bgClass: "bg-yellow-400" },
  { name: "Green", value: "#86efac", textClass: "text-green-400", bgClass: "bg-green-400" },
  { name: "Blue", value: "#93c5fd", textClass: "text-blue-400", bgClass: "bg-blue-400" },
  { name: "Pink", value: "#f472b6", textClass: "text-pink-400", bgClass: "bg-pink-400" },
  { name: "Purple", value: "#c084fc", textClass: "text-purple-400", bgClass: "bg-purple-400" },
  { name: "Orange", value: "#fdba74", textClass: "text-orange-400", bgClass: "bg-orange-400" },
];

interface FloatingSelectionToolbarProps {
  x: number;
  y: number;
  selectedText: string;
  hasRect: boolean;
  onApplyMarkup: (type: "highlight" | "underline" | "strikethrough") => void;
  onApplyColoredHighlight?: (color: string) => void;
  onAddStickyNote?: () => void;
  onCreateNote: () => void;
  onCreateFlashcard: () => void;
  onCreateFormula: () => void;
  onCaptureRegion: () => void;
  onToggleBookmark: () => void;
  onCopyText: () => void;
  onCreateTask: () => void;
  onAddTag: () => void;
  onAddToRevision: () => void;
  onCollectSelection: () => void;
  onClose: () => void;
}

export const FloatingSelectionToolbar: React.FC<FloatingSelectionToolbarProps> = ({
  x,
  y,
  selectedText,
  hasRect,
  onApplyMarkup,
  onApplyColoredHighlight,
  onAddStickyNote,
  onCreateNote,
  onCreateFlashcard,
  onCreateFormula,
  onCaptureRegion,
  onToggleBookmark,
  onCopyText,
  onCreateTask,
  onAddTag,
  onAddToRevision,
  onCollectSelection,
  onClose,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Setup Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        top: `${y}px`,
        left: `${x}px`,
        transform: "translate(-50%, -100%) translateY(-16px)",
      }}
      className="floating-selection-toolbar absolute z-[999] flex items-center bg-slate-900/95 backdrop-blur-md px-2 py-1 rounded-2xl border border-slate-700/60 shadow-2xl select-none text-white animate-fadeIn"
    >
      {/* Highlighting & Color Palette */}
      <div className="flex items-center gap-0.5 border-r border-slate-700/60 pr-1.5 mr-1.5 relative">
        <button
          onClick={() => {
            if (onApplyColoredHighlight) {
              onApplyColoredHighlight("#fde047");
            } else {
              onApplyMarkup("highlight");
            }
          }}
          title="Highlight Text (Yellow)"
          className="p-1.5 hover:bg-slate-800 rounded-lg text-yellow-400 hover:text-yellow-300 transition-all cursor-pointer"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </button>

        {/* Color Palette Toggle */}
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Choose Highlight Color"
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
        >
          <ChevronDown className="h-3 w-3" />
        </button>

        {showColorPicker && (
          <div className="absolute top-full left-0 mt-2 p-1.5 bg-slate-800/95 backdrop-blur-md rounded-xl border border-slate-700 shadow-xl flex items-center gap-1.5 z-50 animate-fadeIn">
            {HIGHLIGHT_COLORS.map((col) => (
              <button
                key={col.value}
                onClick={() => {
                  if (onApplyColoredHighlight) {
                    onApplyColoredHighlight(col.value);
                  } else {
                    onApplyMarkup("highlight");
                  }
                  setShowColorPicker(false);
                }}
                title={`Highlight in ${col.name}`}
                className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform cursor-pointer"
                style={{ backgroundColor: col.value }}
              />
            ))}
          </div>
        )}

        {/* Sticky Note Pin */}
        {onAddStickyNote && (
          <button
            onClick={onAddStickyNote}
            title="Attach Sticky Note to Selection"
            className="p-1.5 hover:bg-slate-800 rounded-lg text-amber-300 hover:text-amber-200 transition-all cursor-pointer"
          >
            <StickyNote className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={onCopyText}
          title="Copy to Clipboard"
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-slate-700/60 pr-1.5 mr-1.5">
        <button
          onClick={onCreateNote}
          title="Create Study Note"
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-bold text-blue-400 hover:text-blue-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Note</span>
        </button>

        <button
          onClick={async () => {
            const provider = getActiveProvider();
            await provider.generateFlashcards(selectedText || 'Sample selection');
          }}
          title="AI Generate Flashcards / Notes from Selection"
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-purple-950 rounded-lg text-xs font-bold text-purple-300 hover:text-purple-200 transition-all cursor-pointer whitespace-nowrap bg-purple-900/50 border border-purple-700/50"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>AI Generate</span>
        </button>

        <button
          onClick={onCreateFlashcard}
          title="Create Active Recall Flashcard"
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-bold text-pink-400 hover:text-pink-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <Brain className="h-3.5 w-3.5" />
          <span>Recall</span>
        </button>

        <button
          onClick={onCreateFormula}
          title="Create Formula Book entry"
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <Calculator className="h-3.5 w-3.5" />
          <span>Formula</span>
        </button>

        <button
          onClick={onCaptureRegion}
          title="Capture region screenshot"
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-bold text-sky-400 hover:text-sky-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Capture</span>
        </button>

        <button
          onClick={onCollectSelection}
          title="Collect selection for multi-selection bundle"
          className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-800 rounded-lg text-xs font-bold text-yellow-400 hover:text-yellow-300 transition-all cursor-pointer whitespace-nowrap"
        >
          <span>📥 Collect</span>
        </button>
      </div>

      <div className="flex items-center gap-1 mr-1">
        <button
          onClick={onToggleBookmark}
          title="Bookmark Page"
          className="p-1.5 hover:bg-slate-800 rounded-lg text-amber-500 hover:text-amber-400 transition-all cursor-pointer"
        >
          <Star className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onCreateTask}
          title="Create Linked Study Task"
          className="p-1.5 hover:bg-slate-800 rounded-lg text-purple-400 hover:text-purple-300 transition-all cursor-pointer"
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onAddTag}
          title="Add Custom Tag"
          className="p-1.5 hover:bg-slate-800 rounded-lg text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer"
        >
          <Tag className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onAddToRevision}
          title="Add to Revision Planner"
          className="p-1.5 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
        >
          <CalendarRange className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        onClick={onClose}
        title="Dismiss popup"
        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all ml-1 cursor-pointer border-l border-slate-700/60 pl-1.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

