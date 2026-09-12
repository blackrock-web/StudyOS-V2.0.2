import React, { useState } from "react";
import {
  Highlighter,
  Underline,
  StickyNote,
  PenTool,
  Square,
  Circle,
  ArrowRight,
  Eraser,
  Type,
  Palette,
  X,
  Sparkles,
  ChevronDown
} from "lucide-react";

interface AnnotationToolbarProps {
  activeTool: string;
  activeColor: string;
  onSelectTool: (tool: string) => void;
  onSelectColor: (color: string) => void;
  onClose?: () => void;
  onClearAnnotations?: () => void;
}

const PRESET_COLORS = [
  { hex: "#f59e0b", label: "Yellow Amber" },
  { hex: "#a855f7", label: "Purple" },
  { hex: "#10b981", label: "Emerald Green" },
  { hex: "#3b82f6", label: "Sky Blue" },
  { hex: "#ec4899", label: "Rose Pink" },
  { hex: "#ef4444", label: "Coral Red" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#000000", label: "Charcoal Black" },
];

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  activeColor,
  onSelectTool,
  onSelectColor,
  onClose,
  onClearAnnotations,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customHex, setCustomHex] = useState(activeColor);

  const handleCustomColorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customHex && /^#([0-9A-F]{3}){1,2}$/i.test(customHex)) {
      onSelectColor(customHex);
      setShowColorPicker(false);
    }
  };

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-2xl px-3 py-2 flex items-center gap-2 select-none animate-fadeIn transition-all">
      {/* Header Badge */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200 text-slate-500 font-extrabold text-[11px] uppercase tracking-wider">
        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
        <span>Markup</span>
      </div>

      {/* Primary Annotation Tools */}
      <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl">
        <button
          onClick={() => onSelectTool("highlight")}
          title="Highlight Text Tool"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "highlight"
              ? "bg-amber-400 text-amber-950 shadow-sm"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <Highlighter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Highlight</span>
        </button>

        <button
          onClick={() => onSelectTool("underline")}
          title="Underline Text Tool"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "underline"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <Underline className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Underline</span>
        </button>

        <button
          onClick={() => onSelectTool("sticky_note")}
          title="Add Sticky Note Annotation"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "sticky_note"
              ? "bg-yellow-300 text-amber-900 shadow-sm"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <StickyNote className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sticky Note</span>
        </button>

        <button
          onClick={() => onSelectTool("drawing")}
          title="Freehand Ink Drawing Pen"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "drawing"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <PenTool className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Pen</span>
        </button>

        <button
          onClick={() => onSelectTool("text")}
          title="Text Callout Box"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "text"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <Type className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Text</span>
        </button>

        <button
          onClick={() => onSelectTool("rectangle")}
          title="Draw Box / Rectangle"
          className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "rectangle" ? "bg-white text-purple-600 shadow-sm" : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <Square className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onSelectTool("circle")}
          title="Draw Circle"
          className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "circle" ? "bg-white text-purple-600 shadow-sm" : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <Circle className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onSelectTool("arrow")}
          title="Draw Pointer Arrow"
          className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "arrow" ? "bg-white text-purple-600 shadow-sm" : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onSelectTool("eraser")}
          title="Annotation Eraser"
          className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTool === "eraser" ? "bg-pink-100 text-pink-700 shadow-sm" : "text-slate-600 hover:bg-white/60"
          }`}
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Color Palette Selector */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 relative">
        <div className="flex items-center gap-1">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.hex}
              onClick={() => onSelectColor(color.hex)}
              title={color.label}
              className={`h-4 w-4 rounded-full border cursor-pointer transition-transform ${
                activeColor === color.hex ? "scale-125 border-slate-800 shadow-md ring-2 ring-purple-400" : "border-slate-300"
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>

        {/* Custom Color Input Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Custom Hex Color Picker"
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-0.5"
          >
            <Palette className="h-3.5 w-3.5 text-slate-600" />
            <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
          </button>

          {showColorPicker && (
            <form
              onSubmit={handleCustomColorSubmit}
              className="absolute top-8 right-0 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-40 w-44 animate-fadeIn"
            >
              <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Pick Color</div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    onSelectColor(e.target.value);
                  }}
                  className="h-7 w-7 rounded border border-slate-200 cursor-pointer p-0"
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  placeholder="#a855f7"
                  className="w-full text-xs font-mono font-bold border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-purple-500"
                />
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          title="Close Annotation Bar"
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
