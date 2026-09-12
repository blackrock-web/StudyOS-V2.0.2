import React, { useState } from "react";
import {
  FileText,
  Bookmark,
  Search,
  LayoutGrid,
  List,
  Menu,
  ChevronLeft,
  Network,
  Folder,
  HelpCircle,
  Sigma,
  ChevronRight,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { PDFThumbnailPanel } from "./PDFThumbnailPanel";
import { BookmarksPanel } from "./BookmarksPanel";
import { SearchPanel } from "./SearchPanel";
import { NotesPanel } from "./NotesPanel";
import { Note, Flashcard, FormulaItem } from "../../types";
import { SearchMatch } from "./services/searchService";

interface PDFSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDocument: any;
  numPages: number;
  currentPage: number;
  bookmarks: number[];
  searchResults: SearchMatch[];
  isSearching: boolean;
  notes: Note[];
  flashcards?: Flashcard[];
  formulas?: FormulaItem[];
  activePdfName: string;
  outline: any[];
  onNavigateToPage: (page: number) => void;
  onToggleBookmark: (page: number) => void;
  onSearch: (query: string) => void;
  onCreateNote: () => void;
  onDeleteNote?: (id: string) => void;
  onJumpToLocation: (page: number, coordinates?: { x: number; y: number; w: number; h: number }) => void;

  // Advanced search extensions
  searchQuery: string;
  caseSensitive: boolean;
  setCaseSensitive: (val: boolean) => void;
  wholeWord: boolean;
  setWholeWord: (val: boolean) => void;
  isRegex: boolean;
  setIsRegex: (val: boolean) => void;
  currentMatchIndex: number;
  setCurrentMatchIndex: (val: number) => void;
  searchHistory: string[];
  onClearSearch: () => void;
  onNextMatch: () => void;
  onPrevMatch: () => void;
}

type SidebarTab = "thumbnails" | "outline" | "bookmarks" | "search" | "notes" | "tree";

export const PDFSidebar: React.FC<PDFSidebarProps> = ({
  isOpen,
  onClose,
  pdfDocument,
  numPages,
  currentPage,
  bookmarks,
  searchResults,
  isSearching,
  notes,
  flashcards = [],
  formulas = [],
  activePdfName,
  outline,
  onNavigateToPage,
  onToggleBookmark,
  onSearch,
  onCreateNote,
  onDeleteNote,
  onJumpToLocation,

  // Advanced search extensions
  searchQuery,
  caseSensitive,
  setCaseSensitive,
  wholeWord,
  setWholeWord,
  isRegex,
  setIsRegex,
  currentMatchIndex,
  setCurrentMatchIndex,
  searchHistory,
  onClearSearch,
  onNextMatch,
  onPrevMatch,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>("thumbnails");

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-[310px] bg-slate-50 border-r border-slate-200 text-slate-700 shrink-0 select-none relative z-40 animate-slideRight">
      {/* Mini tab selector strip */}
      <div className="w-[48px] bg-slate-900 flex flex-col items-center py-4 gap-4 border-r border-slate-800 text-slate-400 shrink-0">
        <button
          onClick={() => setActiveTab("thumbnails")}
          title="Thumbnails"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "thumbnails" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("outline")}
          title="Document Chapters Outline"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "outline" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <List className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("bookmarks")}
          title="Bookmarks"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "bookmarks" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Bookmark className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("search")}
          title="Text Search"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "search" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("notes")}
          title="Extracted Study Notes"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "notes" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <FileText className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("tree")}
          title="Knowledge Library Tree"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "tree" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Network className="h-4 w-4" />
        </button>

        <div className="mt-auto">
          <button
            onClick={onClose}
            title="Collapse Sidebar"
            className="p-2 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main active panel area */}
      <div className="flex-1 overflow-hidden h-full">
        {activeTab === "thumbnails" && (
          <PDFThumbnailPanel
            pdfDocument={pdfDocument}
            numPages={numPages}
            currentPage={currentPage}
            bookmarks={bookmarks}
            onNavigateToPage={onNavigateToPage}
          />
        )}

        {activeTab === "outline" && (
          <div className="flex flex-col h-full bg-white">
            <div className="p-3 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Book Index / Outline</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {outline.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  This document has no pre-defined outline index.
                </div>
              ) : (
                <div className="space-y-1">
                  {outline.map((item, idx) => (
                    <OutlineItem
                      key={idx}
                      item={item}
                      onNavigateToPage={onNavigateToPage}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "bookmarks" && (
          <BookmarksPanel
            bookmarks={bookmarks}
            onNavigateToPage={onNavigateToPage}
            onToggleBookmark={onToggleBookmark}
          />
        )}

        {activeTab === "search" && (
          <SearchPanel
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            caseSensitive={caseSensitive}
            setCaseSensitive={setCaseSensitive}
            wholeWord={wholeWord}
            setWholeWord={setWholeWord}
            isRegex={isRegex}
            setIsRegex={setIsRegex}
            currentMatchIndex={currentMatchIndex}
            setCurrentMatchIndex={setCurrentMatchIndex}
            searchHistory={searchHistory}
            onSearch={onSearch}
            onClearSearch={onClearSearch}
            onNextMatch={onNextMatch}
            onPrevMatch={onPrevMatch}
            onNavigateToPage={onNavigateToPage}
          />
        )}

        {activeTab === "notes" && (
          <NotesPanel
            notes={notes}
            activePdfName={activePdfName}
            onCreateNote={onCreateNote}
            onDeleteNote={onDeleteNote}
          />
        )}

        {activeTab === "tree" && (
          <KnowledgeTreePanel
            notes={notes}
            flashcards={flashcards}
            formulas={formulas}
            activePdfName={activePdfName}
            onJumpToLocation={onJumpToLocation}
          />
        )}
      </div>
    </div>
  );
};

interface KnowledgeTreePanelProps {
  notes: Note[];
  flashcards: Flashcard[];
  formulas: FormulaItem[];
  activePdfName: string;
  onJumpToLocation: (page: number, coordinates?: { x: number; y: number; w: number; h: number }) => void;
}

export const KnowledgeTreePanel: React.FC<KnowledgeTreePanelProps> = ({
  notes,
  flashcards,
  formulas,
  activePdfName,
  onJumpToLocation,
}) => {
  const pdfBaseName = activePdfName ? activePdfName.replace(".pdf", "") : "Active Document";

  // Group by page number
  const pageMap: {
    [page: number]: {
      notes: Note[];
      flashcards: Flashcard[];
      formulas: FormulaItem[];
    };
  } = {};

  // 1. Filter items belonging strictly to the active document
  const docNotes = notes.filter(n => (n as any).pdfMockName === activePdfName || (n as any).pdfName === activePdfName || (n.title || "").includes(pdfBaseName));
  const docCards = flashcards.filter(fc => (fc as any).pdfName === activePdfName || (fc as any).pdfMockName === activePdfName || ((fc as any).topic || "").includes(pdfBaseName));
  const docFormulas = formulas.filter(f => (f as any).pdfName === activePdfName || (f as any).pdfMockName === activePdfName || (f.title || "").includes(pdfBaseName));

  docNotes.forEach(n => {
    const page = (n as any).pdfPage || 1;
    if (!pageMap[page]) pageMap[page] = { notes: [], flashcards: [], formulas: [] };
    pageMap[page]!.notes.push(n);
  });

  docCards.forEach(fc => {
    const page = (fc as any).pdfPage || 1;
    if (!pageMap[page]) pageMap[page] = { notes: [], flashcards: [], formulas: [] };
    pageMap[page]!.flashcards.push(fc);
  });

  docFormulas.forEach(f => {
    const page = (f as any).pdfPage || 1;
    if (!pageMap[page]) pageMap[page] = { notes: [], flashcards: [], formulas: [] };
    pageMap[page]!.formulas.push(f);
  });

  const sortedPages = Object.keys(pageMap)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full bg-white text-slate-800">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Knowledge Library Tree</span>
        <span className="text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded-full">
          {docNotes.length + docCards.length + docFormulas.length} Items
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {sortedPages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-1.5">
            <span className="text-xl">🌳</span>
            <p className="text-[11px] leading-relaxed max-w-[200px] font-bold">
              Your Knowledge Tree is empty. Make selections in the PDF to auto-build your library.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Document Root Node */}
            <div className="flex items-center gap-2 text-slate-850 font-extrabold text-xs">
              <Folder className="h-4 w-4 text-amber-500 fill-amber-500/20" />
              <span className="truncate" title={activePdfName}>{activePdfName}</span>
            </div>

            {/* Page Branches */}
            <div className="pl-4 border-l border-slate-100 space-y-3 ml-2">
              {sortedPages.map((page) => {
                const pageData = pageMap[page];
                return (
                  <PageTreeNode
                    key={page}
                    page={page}
                    notes={pageData?.notes || []}
                    flashcards={pageData?.flashcards || []}
                    formulas={pageData?.formulas || []}
                    onJumpToLocation={onJumpToLocation}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Collapsible page branch sub-node
const PageTreeNode: React.FC<{
  page: number;
  notes: Note[];
  flashcards: Flashcard[];
  formulas: FormulaItem[];
  onJumpToLocation: (page: number, coordinates?: any) => void;
}> = ({ page, notes, flashcards, formulas, onJumpToLocation }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-1 text-left">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 py-1 px-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg cursor-pointer transition-all text-slate-700 font-bold text-xs"
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-slate-400" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
        <Folder className="h-3.5 w-3.5 text-blue-500 fill-blue-500/10" />
        <span className="flex-1 truncate">Page {page}</span>
        <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
          {notes.length + flashcards.length + formulas.length}
        </span>
      </button>

      {expanded && (
        <div className="pl-3.5 border-l border-slate-100 space-y-1 ml-2">
          {/* Notes */}
          {notes.map((n) => (
            <div
              key={n.id}
              onClick={() => onJumpToLocation(page, (n as any).coordinates)}
              className="flex items-center gap-1.5 py-1 px-1.5 text-[11px] text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-md cursor-pointer transition-colors leading-snug font-medium"
              title="Double click to scroll PDF here"
            >
              <FileText className="h-3 w-3 text-amber-500 shrink-0" />
              <span className="truncate flex-1 font-bold text-slate-600 hover:text-purple-700">{n.title}</span>
            </div>
          ))}

          {/* Flashcards */}
          {flashcards.map((fc) => (
            <div
              key={fc.id}
              onClick={() => onJumpToLocation(page, (fc as any).coordinates)}
              className="flex items-center gap-1.5 py-1 px-1.5 text-[11px] text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-md cursor-pointer transition-colors leading-snug font-medium"
              title="Double click to scroll PDF here"
            >
              <HelpCircle className="h-3 w-3 text-pink-500 shrink-0" />
              <span className="truncate flex-1 font-bold text-slate-600 hover:text-purple-700">Recall: {fc.front}</span>
            </div>
          ))}

          {/* Formulas */}
          {formulas.map((form) => (
            <div
              key={form.id}
              onClick={() => onJumpToLocation(page, (form as any).coordinates)}
              className="flex items-center gap-1.5 py-1 px-1.5 text-[11px] text-slate-650 hover:text-slate-900 hover:bg-slate-50 rounded-md cursor-pointer transition-colors leading-snug font-medium"
              title="Double click to scroll PDF here"
            >
              <Sigma className="h-3 w-3 text-emerald-500 shrink-0" />
              <span className="truncate flex-1 font-bold text-slate-600 hover:text-purple-700">Math: {form.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Sub-component for individual hierarchical outline outline node
const OutlineItem: React.FC<{ item: any; onNavigateToPage: (page: number) => void }> = ({
  item,
  onNavigateToPage,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const hasChildren = item.items && item.items.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof item.dest === "number") {
      onNavigateToPage(item.dest);
    } else {
      // In PDF.js, destinations can be raw ref lists; resolve to page if possible
      console.log("Outline target destination:", item.dest);
    }
  };

  return (
    <div className="space-y-0.5 text-left select-none">
      <div
        onClick={handleClick}
        className="flex items-center gap-1.5 p-1.5 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg cursor-pointer transition-all"
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
            className="p-0.5 rounded hover:bg-slate-100 text-slate-400"
          >
            <span className="text-[10px] font-bold block w-3 h-3 leading-none text-center">
              {collapsed ? "+" : "-"}
            </span>
          </button>
        )}
        <span className="text-xs font-bold text-slate-700 truncate flex-1 leading-snug">
          {item.title}
        </span>
      </div>

      {hasChildren && !collapsed && (
        <div className="pl-4 border-l border-slate-100 space-y-0.5 ml-2">
          {item.items.map((sub: any, sIdx: number) => (
            <OutlineItem
              key={sIdx}
              item={sub}
              onNavigateToPage={onNavigateToPage}
            />
          ))}
        </div>
      )}
    </div>
  );
};
