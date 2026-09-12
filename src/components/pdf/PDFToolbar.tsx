import React from "react";
import {
  Columns,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Hand,
  Crop,
  Highlighter,
  Underline,
  PenTool,
  Eraser,
  Bookmark,
  BookmarkCheck,
  Search,
  Undo2,
  Redo2,
  Square,
  Circle,
  ArrowRight,
  Sparkles,
  Magnet,
  Palette,
  FileDown,
  Brain,
  FileText,
} from "lucide-react";

interface PDFToolbarProps {
  currentPage: number;
  numPages: number;
  zoom: number;
  activeTool: string;
  activeColor: string;
  bookmarks: number[];
  canUndo: boolean;
  canRedo: boolean;
  snapToPages?: boolean;
  annotationBarOpen?: boolean;
  onToggleSnapToPages?: () => void;
  onToggleAnnotationBar?: () => void;
  onExportStudyGuide?: () => void;
  onExportSummaryMarkdown?: () => void;
  onOpenRAGStudio?: () => void;
  onPageChange: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (zoom: any) => void;
  onToolSelect: (tool: any) => void;
  onColorSelect: (color: string) => void;
  onToggleBookmark: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onToggleRightSidebar: () => void;
  rightSidebarOpen: boolean;
}

const PRESET_COLORS = [
  "#f59e0b", // Amber / yellow highlight
  "#a855f7", // Purple accent
  "#10b981", // Green correct/formula
  "#3b82f6", // Blue info
  "#ec4899", // Pink important
  "#ef4444", // Red threat
];

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  currentPage,
  numPages,
  zoom,
  activeTool,
  activeColor,
  bookmarks,
  canUndo,
  canRedo,
  snapToPages = false,
  annotationBarOpen = false,
  onToggleSnapToPages,
  onToggleAnnotationBar,
  onExportStudyGuide,
  onExportSummaryMarkdown,
  onOpenRAGStudio,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onSetZoom,
  onToolSelect,
  onColorSelect,
  onToggleBookmark,
  onUndo,
  onRedo,
  onToggleSearch,
  onToggleSidebar,
  sidebarOpen,
  onToggleRightSidebar,
  rightSidebarOpen,
}) => {
  const isBookmarked = (bookmarks || []).includes(currentPage);

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-slate-200 select-none text-slate-700 h-[46px] shrink-0 gap-2 overflow-x-auto scrollbar-none">
      {/* Left section: Sidebar control & page navigation */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleSidebar}
          title="Toggle Navigation Sidebar"
          className={`p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer ${
            sidebarOpen ? "bg-purple-50 text-purple-600" : "text-slate-500"
          }`}
        >
          <Columns className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1.5" />

        {/* Page Nav */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-lg p-0.5">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="p-1 rounded hover:bg-white hover:shadow-sm text-slate-500 disabled:opacity-35 disabled:hover:bg-transparent disabled:shadow-none transition-all cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center text-xs font-bold text-slate-600 px-1.5">
            <span>{currentPage || 1}</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-slate-400">{numPages || 1}</span>
          </div>
          <button
            disabled={currentPage >= numPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="p-1 rounded hover:bg-white hover:shadow-sm text-slate-500 disabled:opacity-35 disabled:hover:bg-transparent disabled:shadow-none transition-all cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Middle section: View zoom & markup tools */}
      <div className="flex items-center gap-1.5">
        {/* Zoom */}
        <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-200/60 rounded-lg p-0.5 shrink-0">
          <button
            onClick={onZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all cursor-pointer"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <select
            value={["0.75", "1.0", "1.25", "1.5", "2.0", "3.0"].includes(zoom.toString()) ? zoom.toString() : ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "fit-width" || val === "fit-page") {
                onSetZoom(val);
              } else {
                onSetZoom(parseFloat(val));
              }
            }}
            className="text-[10.5px] font-extrabold bg-transparent text-slate-600 focus:outline-none px-1 border-none cursor-pointer"
          >
            <option value="" disabled hidden>{Math.round(zoom * 100)}%</option>
            <option value="0.75">75%</option>
            <option value="1.0">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2.0">200%</option>
            <option value="3.0">300%</option>
            <option value="fit-width">Fit Width</option>
            <option value="fit-page">Fit Page</option>
          </select>
          <button
            onClick={onZoomIn}
            title="Zoom In"
            className="p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-500 transition-all cursor-pointer"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* Action Tools Mode */}
        <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-200/60 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => onToolSelect("pan")}
            title="Pan (Hand View)"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "pan"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToolSelect("select")}
            title="Smart Crop Selection"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "select"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <Crop className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToolSelect("highlight")}
            title="Highlighter"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "highlight"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <Highlighter className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToolSelect("underline")}
            title="Underline Marker"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "underline"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToolSelect("drawing")}
            title="Freehand Ink Pen"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "drawing"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
          </button>

          {/* Shapes dropdown/quick items */}
          <button
            onClick={() => onToolSelect("rectangle")}
            title="Draw Rectangle"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "rectangle"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <Square className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToolSelect("circle")}
            title="Draw Circle"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "circle"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <Circle className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onToolSelect("arrow")}
            title="Draw Direction Arrow"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "arrow"
                ? "bg-white text-purple-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => onToolSelect("eraser")}
            title="Annotation Eraser"
            className={`p-1.5 rounded transition-all cursor-pointer ${
              activeTool === "eraser"
                ? "bg-white text-pink-600 shadow-sm font-black"
                : "text-slate-500 hover:bg-white/40"
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Color Presets */}
        {activeTool !== "pan" && activeTool !== "select" && activeTool !== "eraser" && (
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded-lg p-1 shrink-0 animate-fadeIn">
            {PRESET_COLORS.map((color) => {
              const isSelected = activeColor === color;
              return (
                <button
                  key={color}
                  onClick={() => onColorSelect(color)}
                  className={`h-3.5 w-3.5 rounded-full border cursor-pointer transition-transform ${
                    isSelected ? "scale-125 border-slate-700 shadow-sm" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Right section: Bookmarks, undo/redo, search */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-50 border border-slate-200/60 rounded-lg p-0.5">
          <button
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo Last Mark"
            className="p-1 rounded hover:bg-white hover:shadow-sm text-slate-500 disabled:opacity-35 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo Mark"
            className="p-1 rounded hover:bg-white hover:shadow-sm text-slate-500 disabled:opacity-35 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={onToggleBookmark}
          title="Bookmark Page"
          className={`p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer ${
            isBookmarked ? "text-purple-600 bg-purple-50" : "text-slate-500"
          }`}
        >
          {isBookmarked ? (
            <BookmarkCheck className="h-4 w-4 fill-purple-200" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>

        {/* Page Snapping toggle */}
        {onToggleSnapToPages && (
          <button
            onClick={onToggleSnapToPages}
            title={snapToPages ? "Page Snapping Enabled" : "Enable Page Snapping"}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              snapToPages ? "bg-purple-100 text-purple-700 font-bold" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Magnet className="h-4 w-4" />
          </button>
        )}

        {/* Floating Annotation Bar toggle */}
        {onToggleAnnotationBar && (
          <button
            onClick={onToggleAnnotationBar}
            title="Toggle Floating Annotation Toolbar"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              annotationBarOpen ? "bg-amber-100 text-amber-800 font-bold" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Palette className="h-4 w-4" />
          </button>
        )}

        {/* RAG Book Studio button */}
        {onOpenRAGStudio && (
          <button
            onClick={onOpenRAGStudio}
            title="Open RAG Book Knowledge Studio"
            className="p-1.5 rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition-all cursor-pointer font-black flex items-center gap-1 text-xs px-2.5 shadow-xs"
          >
            <Brain className="h-3.5 w-3.5" />
            <span>RAG Studio</span>
          </button>
        )}

        {/* Export Study Guide button */}
        {onExportStudyGuide && (
          <button
            onClick={onExportStudyGuide}
            title="Export Compiled Study Guide PDF"
            className="p-1.5 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer font-bold flex items-center gap-1 text-xs px-2"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Export PDF</span>
          </button>
        )}

        {/* Summary Markdown Export Button */}
        {onExportSummaryMarkdown && (
          <button
            onClick={onExportSummaryMarkdown}
            title="Generate & Download Structured Markdown Summary Report"
            className="p-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer font-bold flex items-center gap-1 text-xs px-2 border border-emerald-200/60 shadow-xs"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Summary</span>
          </button>
        )}

        <button
          onClick={onToggleSearch}
          title="Search Text"
          className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        <button
          onClick={onToggleRightSidebar}
          title="Toggle Study Ledger Sidebar"
          className={`p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer ${
            rightSidebarOpen ? "bg-purple-50 text-purple-600" : "text-slate-500"
          }`}
        >
          <Columns className="h-4 w-4 rotate-180" />
        </button>
      </div>
    </div>
  );
};
