import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Brain,
  Calculator,
  Highlighter,
  Search,
  ChevronRight,
  Trash2,
  Plus,
  BookOpen,
  LayoutDashboard,
  Star,
  CheckSquare,
  Pin,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Download,
  Tag,
  RotateCw,
  Copy,
  Link,
  Undo2,
  Redo2,
  Grid,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  Send,
  RefreshCw,
  Zap
} from "lucide-react";
import { NotesPanel } from "./NotesPanel";
import { SearchPanel } from "./SearchPanel";
import { RAGStudioPanel } from "./RAGStudioPanel";
import { Note, Flashcard, FormulaItem, Task } from "../../types";
import { PDFAnnotation } from "./types/annotation";
import { SearchMatch } from "./services/searchService";

interface PDFRightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  notes: Note[];
  flashcards: Flashcard[];
  formulas: FormulaItem[];
  annotations: PDFAnnotation[];
  tasks: Task[];
  bookmarks: number[];
  activePdfName: string;
  searchResults: SearchMatch[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onNavigateToPage: (page: number) => void;
  onJumpToLocation: (page: number, coordinates?: { x: number; y: number; w: number; h: number }) => void;
  onCreateNote: () => void;
  onDeleteNote?: (id: string) => void;
  onCreateFlashcard?: () => void;
  onDeleteFlashcard?: (id: string) => void;
  onCreateFormula?: () => void;
  onDeleteFormula?: (id: string) => void;
  onRemoveAnnotation?: (id: string) => void;
  onToggleBookmark?: () => void;
  onTriggerNotification?: (title: string, message: string, type: "info" | "warning" | "success" | "alarm") => void;
}

type RightSidebarTab = "rag-studio" | "page-knowledge" | "page-workspace" | "copilot" | "notes" | "flashcards" | "formulas" | "annotations" | "search";

interface WhiteboardCard {
  id: string;
  type: "note" | "card" | "formula" | "highlight" | "task" | "bookmark" | "copy";
  title: string;
  content: string;
  color: "yellow" | "pink" | "green" | "blue" | "purple";
  x: number;
  y: number;
  w: number;
  h: number;
  isPinned: boolean;
  isCollapsed: boolean;
  page: number;
  coordinates?: any;
  image?: string;
  rotation?: number;
}

export const PDFRightSidebar: React.FC<PDFRightSidebarProps> = ({
  isOpen,
  onClose,
  currentPage,
  notes,
  flashcards,
  formulas,
  annotations,
  tasks,
  bookmarks,
  activePdfName,
  searchResults,
  isSearching,
  onSearch,
  onNavigateToPage,
  onJumpToLocation,
  onCreateNote,
  onDeleteNote,
  onCreateFlashcard,
  onDeleteFlashcard,
  onCreateFormula,
  onDeleteFormula,
  onRemoveAnnotation,
  onToggleBookmark,
  onTriggerNotification,
}) => {
  const [activeTab, setActiveTab] = useState<RightSidebarTab>("page-knowledge");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // PDF Copilot states
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotHistory, setCopilotHistory] = useState<
    { role: "user" | "assistant"; content: string; page?: number }[]
  >([
    {
      role: "assistant",
      content: `Hi! I am your PDF Copilot for ${activePdfName || "this document"}. Ask me anything about Page ${currentPage}, highlighted text, or related study notes.`,
    },
  ]);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const handleSendCopilotQuery = (prompt?: string) => {
    const text = prompt || copilotInput;
    if (!text.trim()) return;

    setCopilotHistory((prev) => [...prev, { role: "user", content: text }]);
    setCopilotInput("");
    setCopilotLoading(true);

    setTimeout(() => {
      let answer = "";
      if (text.includes("Summarize")) {
        answer = `Summary of Page ${currentPage} in ${activePdfName}:\nThis page introduces fundamental definitions, primary equations, and core boundary conditions. Recommended to review linked notes and solved practice questions.`;
      } else if (text.includes("formulas")) {
        answer = `Formulas found on Page ${currentPage}:\n- Primary equation: E = mc^2\n- Secondary relation: Delta V = I * R\nAdded to your page workspace.`;
      } else {
        answer = `Analyzed "${text}" on Page ${currentPage} of ${activePdfName}:\nGrounded in local PDF text and active StudyOS knowledge graph.`;
      }

      setCopilotHistory((prev) => [...prev, { role: "assistant", content: answer, page: currentPage }]);
      setCopilotLoading(false);
    }, 600);
  };

  // Whiteboard states
  const [boardCards, setBoardCards] = useState<WhiteboardCard[]>([]);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connections, setConnections] = useState<{ fromId: string; toId: string }[]>([]);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);

  // Advanced Whiteboard controls
  const [boardZoom, setBoardZoom] = useState(1.0);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [undoStack, setUndoStack] = useState<WhiteboardCard[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardCard[][]>([]);
  const [verticalGuide, setVerticalGuide] = useState<number | null>(null);
  const [horizontalGuide, setHorizontalGuide] = useState<number | null>(null);

  const boardScrollContainerRef = useRef<HTMLDivElement>(null);
  const [isWhiteboardPanning, setIsWhiteboardPanning] = useState(false);
  const boardPanStartX = useRef(0);
  const boardPanStartY = useRef(0);
  const boardPanStartScrollLeft = useRef(0);
  const boardPanStartScrollTop = useRef(0);

  const pdfBaseName = activePdfName ? activePdfName.replace(".pdf", "") : "";

  // 1. Filtering ALL items for "Document Library" tabs
  const filteredFlashcards = (flashcards || []).filter(
    (fc) => fc && ((fc as any).topic === pdfBaseName || fc.front?.includes(pdfBaseName) || (fc as any).pdfName === activePdfName)
  );

  const filteredFormulas = (formulas || []).filter(
    (f) => f && (f.title?.includes(pdfBaseName) || f.content?.includes(pdfBaseName) || (f as any).pdfName === activePdfName)
  );

  // 2. Filtering items belonging strictly to the CURRENT PAGE
  const pageNotes = (notes || []).filter(
    (n) => n && (n as any).pdfPage === currentPage && ((n as any).pdfMockName === activePdfName || (n as any).pdfName === activePdfName || (n.title || "").includes(pdfBaseName))
  );

  const pageFlashcards = (flashcards || []).filter(
    (fc) => fc && (fc as any).pdfPage === currentPage && ((fc as any).pdfName === activePdfName || (fc as any).pdfMockName === activePdfName || ((fc as any).topic || "").includes(pdfBaseName))
  );

  const pageFormulas = (formulas || []).filter(
    (f) => f && (f as any).pdfPage === currentPage && ((f as any).pdfName === activePdfName || (f as any).pdfMockName === activePdfName || (f.title || "").includes(pdfBaseName))
  );

  const pageBookmarks = bookmarks.includes(currentPage) ? [currentPage] : [];

  const pageHighlights = (annotations || []).filter(
    (ann) => ann && ann.page === currentPage
  );

  const pageTasks = (tasks || []).filter(
    (t) => t && (t as any).pdfPage === currentPage && ((t as any).pdfMockName === activePdfName || (t as any).pdfName === activePdfName || (t.title || "").includes(pdfBaseName))
  );

  // Sync current page items to Whiteboard boardCards on tab enter or currentPage changes
  useEffect(() => {
    const list: WhiteboardCard[] = [];

    // Helper to merge or get default
    const getCardProps = (id: string, defaultProps: Partial<WhiteboardCard>) => {
      const existing = boardCards.find(c => c.id === id);
      if (existing) {
        return {
          ...defaultProps,
          x: existing.x,
          y: existing.y,
          color: existing.color,
          isPinned: existing.isPinned,
          isCollapsed: existing.isCollapsed,
          rotation: existing.rotation || 0,
        };
      }
      return defaultProps;
    };

    // Map Notes
    pageNotes.forEach((n, index) => {
      const base = {
        id: n.id,
        type: "note" as const,
        title: n.title,
        content: n.content,
        color: "yellow" as const,
        x: 10 + (index * 25) % 300,
        y: 10 + index * 130,
        w: 180,
        h: 120,
        isPinned: false,
        isCollapsed: false,
        page: currentPage,
        coordinates: (n as any).coordinates,
        image: (n as any).image,
        rotation: 0,
      };
      list.push({ ...base, ...getCardProps(n.id, base) });
    });

    // Map Flashcards
    pageFlashcards.forEach((fc, index) => {
      const base = {
        id: fc.id,
        type: "card" as const,
        title: "Recall Card",
        content: `Q: ${fc.front}\nA: ${fc.back}`,
        color: "pink" as const,
        x: 40 + (index * 25) % 300,
        y: 40 + index * 130,
        w: 180,
        h: 120,
        isPinned: false,
        isCollapsed: false,
        page: currentPage,
        coordinates: (fc as any).coordinates,
        image: (fc as any).image,
        rotation: 0,
      };
      list.push({ ...base, ...getCardProps(fc.id, base) });
    });

    // Map Formulas
    pageFormulas.forEach((f, index) => {
      const base = {
        id: f.id,
        type: "formula" as const,
        title: f.title,
        content: f.content,
        color: "green" as const,
        x: 70 + (index * 25) % 300,
        y: 70 + index * 130,
        w: 180,
        h: 120,
        isPinned: false,
        isCollapsed: false,
        page: currentPage,
        coordinates: (f as any).coordinates,
        image: (f as any).image,
        rotation: 0,
      };
      list.push({ ...base, ...getCardProps(f.id, base) });
    });

    // Map Tasks
    pageTasks.forEach((t, index) => {
      const base = {
        id: t.id,
        type: "task" as const,
        title: t.title,
        content: t.notes || "No extra task details",
        color: "purple" as const,
        x: 100 + (index * 25) % 300,
        y: 100 + index * 130,
        w: 180,
        h: 110,
        isPinned: false,
        isCollapsed: false,
        page: currentPage,
        coordinates: (t as any).coordinates,
        rotation: 0,
      };
      list.push({ ...base, ...getCardProps(t.id, base) });
    });

    // Map Bookmarks
    pageBookmarks.forEach((b) => {
      const id = `bmark-${currentPage}`;
      const base = {
        id,
        type: "bookmark" as const,
        title: `Bookmark`,
        content: `Page ${currentPage} is bookmarked for active study list.`,
        color: "blue" as const,
        x: 120,
        y: 150,
        w: 170,
        h: 80,
        isPinned: true,
        isCollapsed: false,
        page: currentPage,
        rotation: 0,
      };
      list.push({ ...base, ...getCardProps(id, base) });
    });

    // Keep any user-created duplicated cards or dynamic copy cards
    boardCards.forEach(c => {
      if (c.type === "copy" && !list.some(item => item.id === c.id)) {
        list.push(c);
      }
    });

    setBoardCards(list);
  }, [currentPage, notes, flashcards, formulas, tasks, bookmarks, activePdfName]);

  const handleBoardBackgroundMouseDown = (e: React.MouseEvent) => {
    const isBackground = e.target === e.currentTarget || (e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).id === "grid-overlay";
    if (isBackground || e.button === 1) {
      setIsWhiteboardPanning(true);
      boardPanStartX.current = e.clientX;
      boardPanStartY.current = e.clientY;
      if (boardScrollContainerRef.current) {
        boardPanStartScrollLeft.current = boardScrollContainerRef.current.scrollLeft;
        boardPanStartScrollTop.current = boardScrollContainerRef.current.scrollTop;
      }
    }
  };

  const handleBoardBackgroundMouseMove = (e: React.MouseEvent) => {
    if (isWhiteboardPanning && boardScrollContainerRef.current) {
      e.preventDefault();
      const dx = e.clientX - boardPanStartX.current;
      const dy = e.clientY - boardPanStartY.current;
      boardScrollContainerRef.current.scrollLeft = boardPanStartScrollLeft.current - dx;
      boardScrollContainerRef.current.scrollTop = boardPanStartScrollTop.current - dy;
    } else {
      handleContainerMouseMove(e);
    }
  };

  // Whiteboard interaction handlers
  const handleCardDragStart = (e: React.MouseEvent, cardId: string) => {
    const card = boardCards.find(c => c.id === cardId);
    if (!card || card.isPinned) return;
    
    // Save history point
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);

    setDraggedCardId(cardId);
    const bounds = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top
    });
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!draggedCardId) return;
    const containerBounds = e.currentTarget.getBoundingClientRect();
    
    // Scale client delta by boardZoom to keep dragging physically matched with cursor position
    const rawX = (e.clientX - containerBounds.left - dragOffset.x) / boardZoom;
    const rawY = (e.clientY - containerBounds.top - dragOffset.y) / boardZoom;

    // Apply Snap to Grid
    const x = snapToGrid ? Math.round(rawX / 16) * 16 : rawX;
    const y = snapToGrid ? Math.round(rawY / 16) * 16 : rawY;

    // Alignment guides calculations!
    const activeCard = boardCards.find(c => c.id === draggedCardId);
    if (!activeCard) return;

    let alignedX = x;
    let alignedY = y;
    let guideX: number | null = null;
    let guideY: number | null = null;

    boardCards.forEach(c => {
      if (c.id === draggedCardId) return;
      // If we are close to another card's X center or corner, snap!
      if (Math.abs(c.x - x) < 8) {
        alignedX = c.x;
        guideX = c.x;
      } else if (Math.abs((c.x + c.w) - (x + activeCard.w)) < 8) {
        alignedX = c.x + c.w - activeCard.w;
        guideX = c.x + c.w;
      }
      
      // If we are close to another card's Y center or corner, snap!
      if (Math.abs(c.y - y) < 8) {
        alignedY = c.y;
        guideY = c.y;
      } else if (Math.abs((c.y + c.h) - (y + activeCard.h)) < 8) {
        alignedY = c.y + c.h - activeCard.h;
        guideY = c.y + c.h;
      }
    });

    setVerticalGuide(guideX);
    setHorizontalGuide(guideY);

    setBoardCards(prev => prev.map(c => {
      if (c.id === draggedCardId && !c.isPinned) {
        // limit inside 1500x1500px infinite canvas boundaries
        const finalX = Math.max(0, Math.min(alignedX, 1500 - c.w));
        const finalY = Math.max(0, Math.min(alignedY, 1500 - c.h));
        return { 
          ...c, 
          x: finalX, 
          y: finalY 
        };
      }
      return c;
    }));
  };

  const handleCardDragEnd = () => {
    setDraggedCardId(null);
    setIsWhiteboardPanning(false);
    setVerticalGuide(null);
    setHorizontalGuide(null);
  };

  const handleBoardUndo = () => {
    if (undoStack.length === 0) return;
    const prevState = undoStack[undoStack.length - 1];
    if (prevState) {
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, boardCards]);
      setBoardCards(prevState);
      onTriggerNotification?.("Undo Action", "Restored previous whiteboard layout.", "info");
    }
  };

  const handleBoardRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    if (nextState) {
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, boardCards]);
      setBoardCards(nextState);
      onTriggerNotification?.("Redo Action", "Reapplied whiteboard layout.", "info");
    }
  };

  const bringToFront = (id: string) => {
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    const card = boardCards.find(c => c.id === id);
    if (!card) return;
    setBoardCards(prev => [...prev.filter(c => c.id !== id), card]);
    onTriggerNotification?.("Bring to Front", "Reordered card layer to top.", "success");
  };

  const sendToBack = (id: string) => {
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    const card = boardCards.find(c => c.id === id);
    if (!card) return;
    setBoardCards(prev => [card, ...prev.filter(c => c.id !== id)]);
    onTriggerNotification?.("Send to Back", "Reordered card layer to bottom.", "success");
  };

  const handleTogglePin = (id: string) => {
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    setBoardCards(prev => prev.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c));
  };

  const handleToggleCollapse = (id: string) => {
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    setBoardCards(prev => prev.map(c => c.id === id ? { ...c, isCollapsed: !c.isCollapsed } : c));
  };

  const handleDeleteCardItem = (id: string, type: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} permanently?`)) return;
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    if (type === "note" && onDeleteNote) {
      onDeleteNote(id);
    } else if (type === "card" && onDeleteFlashcard) {
      onDeleteFlashcard(id);
    } else if (type === "formula" && onDeleteFormula) {
      onDeleteFormula(id);
    }
    // Filter out connections for deleted card
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    setBoardCards(prev => prev.filter(c => c.id !== id));
  };

  const handleRotateCard = (id: string) => {
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    setBoardCards(prev => prev.map(c => c.id === id ? { ...c, rotation: ((c.rotation || 0) + 15) % 360 } : c));
  };

  const handleDuplicateCard = (id: string) => {
    const original = boardCards.find(c => c.id === id);
    if (!original) return;
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    const newCard: WhiteboardCard = {
      ...original,
      id: `${original.id}-dup-${Date.now()}`,
      x: original.x + 30,
      y: original.y + 30,
      title: `${original.title} (Copy)`,
      rotation: original.rotation || 0,
      type: "copy",
    };
    setBoardCards(prev => [...prev, newCard]);
    onTriggerNotification?.("Card Duplicated", `Successfully created a copy of "${original.title}".`, "success");
  };

  const handleConnectCards = (id: string) => {
    if (!connectionSourceId) {
      setConnectionSourceId(id);
      onTriggerNotification?.("Select Target Card", "Select another card to draw a connection line.", "info");
    } else {
      if (connectionSourceId === id) {
        setConnectionSourceId(null);
        return;
      }
      // Check if connection already exists
      const exists = connections.some(
        conn => (conn.fromId === connectionSourceId && conn.toId === id) || (conn.fromId === id && conn.toId === connectionSourceId)
      );
      setUndoStack(u => [...u, boardCards].slice(-25));
      setRedoStack([]);
      if (exists) {
        // Toggle off (remove connection)
        setConnections(prev => prev.filter(
          conn => !((conn.fromId === connectionSourceId && conn.toId === id) || (conn.fromId === id && conn.toId === connectionSourceId))
        ));
        onTriggerNotification?.("Connection Removed", "Successfully deleted card link.", "info");
      } else {
        setConnections(prev => [...prev, { fromId: connectionSourceId, toId: id }]);
        onTriggerNotification?.("Cards Connected", "Line connector created successfully.", "success");
      }
      setConnectionSourceId(null);
    }
  };

  const handleChangeCardColor = (id: string, color: WhiteboardCard["color"]) => {
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    setBoardCards(prev => prev.map(c => c.id === id ? { ...c, color } : c));
  };

  const handleResizeCard = (id: string, size: "S" | "M" | "L") => {
    setUndoStack(u => [...u, boardCards].slice(-25));
    setRedoStack([]);
    const widthMap = { S: 140, M: 180, L: 240 };
    const heightMap = { S: 90, M: 120, L: 180 };
    setBoardCards(prev => prev.map(c => c.id === id ? { ...c, w: widthMap[size], h: heightMap[size] } : c));
  };

  // Sticky color maps
  const colorClasses = {
    yellow: "bg-amber-100/90 border-amber-300 shadow-amber-200/50 text-amber-900",
    pink: "bg-rose-100/90 border-rose-300 shadow-rose-200/50 text-rose-900",
    green: "bg-emerald-100/90 border-emerald-300 shadow-emerald-200/50 text-emerald-900",
    blue: "bg-sky-100/90 border-sky-300 shadow-sky-200/50 text-sky-900",
    purple: "bg-purple-100/90 border-purple-300 shadow-purple-200/50 text-purple-900",
  };

  if (!isOpen) return null;

  return (
    <div className="flex h-full w-[330px] bg-slate-50 border-l border-slate-200 text-slate-700 shrink-0 select-none relative z-40 animate-slideLeft">
      {/* Main active panel area */}
      <div className="flex-1 overflow-hidden h-full bg-white flex flex-col">
        
        {/* TAB 0: RAG BOOK KNOWLEDGE STUDIO */}
        {activeTab === "rag-studio" && (
          <RAGStudioPanel
            activePdfName={activePdfName}
            currentPage={currentPage}
            onNavigateToPage={onNavigateToPage}
            onJumpToLocation={onJumpToLocation}
            onTriggerNotification={onTriggerNotification}
            isCompact={true}
          />
        )}

        {/* TAB 1: Sticky PAGE KNOWLEDGE dashboard list */}
        {activeTab === "page-knowledge" && (
          <div className="flex flex-col h-full bg-slate-50 text-slate-800">
            {/* Header with quick overview stats */}
            <div className="p-4 bg-white border-b border-slate-200 space-y-2 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                  <BookOpen className="h-4 w-4 text-purple-600" /> Page Knowledge
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-100">
                  Page {currentPage}
                </span>
              </div>
              
              {/* Category Counter Pill Grid */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                  <span className="block text-slate-400 font-extrabold">Notes</span>
                  <span className="text-xs font-black text-slate-800">{pageNotes.length}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                  <span className="block text-slate-400 font-extrabold">Cards</span>
                  <span className="text-xs font-black text-slate-800">{pageFlashcards.length}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                  <span className="block text-slate-400 font-extrabold">Formulas</span>
                  <span className="text-xs font-black text-slate-800">{pageFormulas.length}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                  <span className="block text-slate-400 font-extrabold">Bookmarks</span>
                  <span className="text-xs font-black text-slate-800">{pageBookmarks.length}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                  <span className="block text-slate-400 font-extrabold">Markups</span>
                  <span className="text-xs font-black text-slate-800">{pageHighlights.length}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-center">
                  <span className="block text-slate-400 font-extrabold">Tasks</span>
                  <span className="text-xs font-black text-slate-800">{pageTasks.length}</span>
                </div>
              </div>
            </div>

            {/* Sticky Cards Scrollable List */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {pageNotes.length === 0 &&
               pageFlashcards.length === 0 &&
               pageFormulas.length === 0 &&
               pageBookmarks.length === 0 &&
               pageHighlights.length === 0 &&
               pageTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                  <span className="text-2xl">💡</span>
                  <p className="text-xs leading-relaxed max-w-[200px] font-semibold">
                    No items on Page {currentPage}. Use the text/region selection tool to capture notes, cards, and formulas!
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                    Sticky Cards (Double-click to open in PDF)
                  </div>

                  {/* Notes Sticky Cards */}
                  {pageNotes.map(n => (
                    <div
                      key={n.id}
                      onClick={() => setSelectedCardId(selectedCardId === n.id ? null : n.id)}
                      onDoubleClick={() => onJumpToLocation(currentPage, (n as any).coordinates)}
                      className="p-3.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-2xl shadow-sm cursor-pointer transition-all space-y-2 text-left relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Note
                        </span>
                        <span className="text-[8px] text-amber-600 font-bold">p. {currentPage}</span>
                      </div>
                      <h4 className="text-xs font-black text-amber-900 leading-snug">{n.title}</h4>
                      
                      {(n as any).image && (
                        <div className="border border-amber-200 rounded-lg overflow-hidden bg-white p-1 max-h-24">
                          <img src={(n as any).image} className="w-full h-full object-contain" alt="Crop note" />
                        </div>
                      )}

                      <p className={`text-[11px] text-amber-800 leading-relaxed ${selectedCardId === n.id ? "" : "line-clamp-2"}`}>
                        {n.content}
                      </p>

                      <div className="flex items-center justify-between text-[9px] text-amber-600 pt-1 border-t border-amber-200/50 font-bold">
                        <span>Double-click to return</span>
                        {onDeleteNote && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteNote(n.id); }}
                            className="text-amber-500 hover:text-red-600 p-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Flashcards Sticky Cards */}
                  {pageFlashcards.map(fc => (
                    <div
                      key={fc.id}
                      onClick={() => setSelectedCardId(selectedCardId === fc.id ? null : fc.id)}
                      onDoubleClick={() => onJumpToLocation(currentPage, (fc as any).coordinates)}
                      className="p-3.5 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-2xl shadow-sm cursor-pointer transition-all space-y-2 text-left relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] font-extrabold uppercase bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <Brain className="h-3 w-3" /> Recall Card
                        </span>
                        <span className="text-[8px] text-rose-600 font-bold">p. {currentPage}</span>
                      </div>

                      {(fc as any).image && (
                        <div className="border border-rose-200 rounded-lg overflow-hidden bg-white p-1 max-h-24">
                          <img src={(fc as any).image} className="w-full h-full object-contain" alt="Crop fc" />
                        </div>
                      )}

                      <div>
                        <span className="text-[8px] font-black text-rose-400 uppercase tracking-wide">Question</span>
                        <p className="text-[11px] font-extrabold text-rose-900 leading-tight">{fc.front}</p>
                      </div>

                      {selectedCardId === fc.id && (
                        <div className="border-t border-dashed border-rose-200 pt-1.5 animate-fadeIn">
                          <span className="text-[8px] font-black text-rose-400 uppercase tracking-wide">Answer</span>
                          <p className="text-[11px] text-rose-700 leading-relaxed">{fc.back}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[9px] text-rose-600 pt-1 border-t border-rose-200/50 font-bold">
                        <span>{selectedCardId === fc.id ? "Click to collapse" : "Click to view answer"}</span>
                        {onDeleteFlashcard && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteFlashcard(fc.id); }}
                            className="text-rose-500 hover:text-red-600 p-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Formulas Sticky Cards */}
                  {pageFormulas.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedCardId(selectedCardId === f.id ? null : f.id)}
                      onDoubleClick={() => onJumpToLocation(currentPage, (f as any).coordinates)}
                      className="p-3.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-2xl shadow-sm cursor-pointer transition-all space-y-2 text-left relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <Calculator className="h-3 w-3" /> Formula
                        </span>
                        <span className="text-[8px] text-emerald-600 font-bold">p. {currentPage}</span>
                      </div>
                      <h4 className="text-xs font-black text-emerald-900 leading-snug">{f.title}</h4>

                      {(f as any).image && (
                        <div className="border border-emerald-200 rounded-lg overflow-hidden bg-white p-1 max-h-24">
                          <img src={(f as any).image} className="w-full h-full object-contain" alt="Crop formula" />
                        </div>
                      )}

                      <p className="text-[10px] font-mono bg-slate-900 text-emerald-400 p-1.5 rounded-md break-all select-all">
                        {f.content}
                      </p>

                      <div className="flex items-center justify-between text-[9px] text-emerald-600 pt-1 border-t border-emerald-200/50 font-bold">
                        <span>Double-click to return</span>
                        {onDeleteFormula && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteFormula(f.id); }}
                            className="text-emerald-500 hover:text-red-600 p-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Bookmarks */}
                  {pageBookmarks.map(b => (
                    <div
                      key={`b-${b}`}
                      onDoubleClick={() => onJumpToLocation(currentPage)}
                      className="p-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-sky-100 text-sky-700 rounded-xl">
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </span>
                        <div>
                          <span className="text-xs font-black text-sky-900 block leading-tight">Page Bookmark</span>
                          <span className="text-[9px] text-sky-500 font-bold block">Spaced repetition flag</span>
                        </div>
                      </div>
                      {onToggleBookmark && (
                        <button onClick={onToggleBookmark} className="text-sky-400 hover:text-red-500 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Highlights Markups */}
                  {pageHighlights.map(ann => (
                    <div
                      key={ann.id}
                      onClick={() => onJumpToLocation(currentPage, (ann as any).coordinates)}
                      className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-2xl text-left text-xs text-yellow-900 flex justify-between items-start gap-2 shadow-sm"
                    >
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-yellow-800 bg-yellow-100 px-1 py-0.5 rounded uppercase leading-none block w-max">
                          {ann.type} Annotation
                        </span>
                        <p className="text-[10px] text-yellow-800 leading-snug italic font-medium">
                          "{(ann as any).text}"
                        </p>
                      </div>
                      {onRemoveAnnotation && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveAnnotation(ann.id); }}
                          className="text-yellow-400 hover:text-red-500 p-1 shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Page Tasks */}
                  {pageTasks.map(t => (
                    <div
                      key={t.id}
                      onDoubleClick={() => onJumpToLocation(currentPage, (t as any).coordinates)}
                      className="p-3 bg-purple-50 hover:bg-purple-100/60 border border-purple-200 rounded-2xl text-left space-y-1.5 shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-extrabold uppercase bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <CheckSquare className="h-3 w-3" /> Linked Task
                        </span>
                        <span className="text-[8px] text-purple-600 font-black bg-white border border-purple-150 px-1 rounded-full">
                          {t.priority}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-purple-900 leading-snug">{t.title}</h4>
                      {t.notes && <p className="text-[10px] text-purple-800 font-bold leading-tight">{t.notes}</p>}
                      <div className="text-[8px] font-bold text-purple-500 text-right">Double-click to navigate</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PAGE WORKSPACE interactive whiteboard */}
        {activeTab === "page-workspace" && (
          <div className="flex flex-col h-full bg-slate-100 text-slate-800">
            <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">Page Workspace</span>
                <span className="text-[9px] text-slate-400 font-bold block">Interactive Board (Drag & Customize)</span>
              </div>
              <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded">p. {currentPage}</span>
            </div>

            {/* Whiteboard Controls Subbar */}
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 gap-1.5 text-xs select-none">
              <div className="flex items-center gap-1.5">
                {/* Snap to grid */}
                <button
                  onClick={() => {
                    setSnapToGrid(!snapToGrid);
                    onTriggerNotification?.("Grid Snapping", !snapToGrid ? "Snapping enabled (16px grid)." : "Snapping disabled.", "info");
                  }}
                  title="Snap to 16px Grid"
                  className={`p-1 rounded hover:bg-slate-200 transition-all cursor-pointer ${
                    snapToGrid ? "bg-purple-100 text-purple-700 font-extrabold" : "text-slate-500"
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" />
                </button>
                <div className="h-4 w-px bg-slate-200" />
                {/* Zoom out */}
                <button
                  onClick={() => setBoardZoom(z => Math.max(0.6, Number((z - 0.2).toFixed(1))))}
                  disabled={boardZoom <= 0.6}
                  title="Zoom Out Board"
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer text-slate-500"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-black text-slate-600 min-w-8 text-center">
                  {Math.round(boardZoom * 100)}%
                </span>
                {/* Zoom in */}
                <button
                  onClick={() => setBoardZoom(z => Math.min(1.8, Number((z + 0.2).toFixed(1))))}
                  disabled={boardZoom >= 1.8}
                  title="Zoom In Board"
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer text-slate-500"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Undo */}
                <button
                  onClick={handleBoardUndo}
                  disabled={undoStack.length === 0}
                  title="Undo Layout Action"
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-500 cursor-pointer"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                {/* Redo */}
                <button
                  onClick={handleBoardRedo}
                  disabled={redoStack.length === 0}
                  title="Redo Layout Action"
                  className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-500 cursor-pointer"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
                <div className="h-4 w-px bg-slate-200" />
                {/* Clear copies */}
                <button
                  onClick={() => {
                    if (window.confirm("Do you want to reset all custom copies on this page's whiteboard?")) {
                      setUndoStack(u => [...u, boardCards]);
                      setBoardCards(prev => prev.filter(c => c.type !== "copy"));
                      setConnections([]);
                    }
                  }}
                  title="Clear custom elements"
                  className="text-[9px] font-extrabold text-pink-600 hover:text-pink-700 px-1.5 py-0.5 rounded hover:bg-pink-50"
                >
                  Reset Layout
                </button>
              </div>
            </div>

            {/* Interactive Workspace Board */}
            <div
              ref={boardScrollContainerRef}
              className={`flex-1 overflow-auto p-4 relative min-h-0 bg-slate-100/50 ${
                isWhiteboardPanning ? "cursor-grabbing" : "cursor-default"
              }`}
              style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "16px 16px" }}
              onMouseDown={handleBoardBackgroundMouseDown}
              onMouseMove={handleBoardBackgroundMouseMove}
              onMouseUp={handleCardDragEnd}
              onMouseLeave={handleCardDragEnd}
            >
              {boardCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-6">
                  <span className="text-2xl mb-2">🎨</span>
                  <p className="text-xs font-semibold leading-relaxed">
                    Whiteboard is empty. Compile study items on Page {currentPage} to interact with sticky cards.
                  </p>
                </div>
              ) : (
                <div 
                  className="relative w-[1500px] h-[1500px] pointer-events-auto origin-top-left"
                  style={{ transform: `scale(${boardZoom})`, width: `${1500 * boardZoom}px`, height: `${1500 * boardZoom}px` }}
                >
                  {/* SVG Connections Overlay */}
                  <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
                    {/* Alignment guide line vertical */}
                    {verticalGuide !== null && (
                      <line
                        x1={verticalGuide}
                        y1={0}
                        x2={verticalGuide}
                        y2={1500}
                        stroke="#a855f7"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        className="opacity-85"
                      />
                    )}
                    {/* Alignment guide line horizontal */}
                    {horizontalGuide !== null && (
                      <line
                        x1={0}
                        y1={horizontalGuide}
                        x2={1500}
                        y2={horizontalGuide}
                        stroke="#a855f7"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        className="opacity-85"
                      />
                    )}

                    {connections.map((conn, idx) => {
                      const fromCard = boardCards.find(c => c.id === conn.fromId);
                      const toCard = boardCards.find(c => c.id === conn.toId);
                      if (!fromCard || !toCard) return null;

                      // Calculate coordinates of centers
                      const fromX = fromCard.x + fromCard.w / 2;
                      const fromY = fromCard.y + (fromCard.isCollapsed ? 20 : fromCard.h / 2);
                      const toX = toCard.x + toCard.w / 2;
                      const toY = toCard.y + (toCard.isCollapsed ? 20 : toCard.h / 2);

                      return (
                        <g key={`conn-${idx}`} className="opacity-80">
                          <line
                            x1={fromX}
                            y1={fromY}
                            x2={toX}
                            y2={toY}
                            stroke="#818cf8"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            strokeLinecap="round"
                          />
                          <circle
                            cx={(fromX + toX) / 2}
                            cy={(fromY + toY) / 2}
                            r="3.5"
                            fill="#6366f1"
                            stroke="#ffffff"
                            strokeWidth="1"
                          />
                        </g>
                      );
                    })}
                  </svg>

                   {boardCards.map(c => (
                    <div
                      key={c.id}
                      style={{
                        position: "absolute",
                        left: `${c.x}px`,
                        top: `${c.y}px`,
                        width: `${c.w}px`,
                        height: c.isCollapsed ? "auto" : `${c.h}px`,
                        zIndex: draggedCardId === c.id ? 100 : 10,
                        transform: `rotate(${c.rotation || 0}deg)`,
                      }}
                      onDoubleClick={() => c.coordinates && onJumpToLocation(c.page, c.coordinates)}
                      className={`border border-solid p-2.5 rounded-xl flex flex-col justify-between shadow-lg select-none transition-all cursor-pointer hover:border-slate-400/50 ${
                        draggedCardId === c.id ? "shadow-2xl opacity-90 scale-[1.02]" : ""
                      } ${colorClasses[c.color]}`}
                    >
                      {/* Card Header (Handle for Dragging) */}
                      <div
                        onMouseDown={(e) => handleCardDragStart(e, c.id)}
                        className={`flex items-center justify-between gap-1 border-b border-black/10 pb-1 cursor-grab active:cursor-grabbing shrink-0`}
                      >
                        <div className="flex items-center gap-1 overflow-hidden">
                          {c.isPinned && <Pin className="h-2.5 w-2.5 text-slate-500 shrink-0" />}
                          <span className="text-[9px] font-black uppercase tracking-wider truncate">
                            {c.title}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-0.5 shrink-0">
                          {/* Mini Control Panel */}
                          <button
                            onClick={() => handleConnectCards(c.id)}
                            title={connectionSourceId === c.id ? "Connecting... click another card" : "Link/Connect Card"}
                            className={`p-0.5 rounded transition-colors ${
                              connectionSourceId === c.id ? "bg-purple-600 text-white animate-pulse" : "hover:bg-black/10 text-slate-500"
                            }`}
                          >
                            <Link className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={() => handleRotateCard(c.id)}
                            title="Rotate card (15 deg)"
                            className="p-0.5 hover:bg-black/10 text-slate-500 rounded transition-all active:scale-95"
                          >
                            <RotateCw className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateCard(c.id)}
                            title="Duplicate card copy"
                            className="p-0.5 hover:bg-black/10 text-slate-500 rounded transition-all"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={() => handleTogglePin(c.id)}
                            title={c.isPinned ? "Unpin Card" : "Pin Card"}
                            className="p-0.5 hover:bg-black/10 rounded"
                          >
                            <Pin className={`h-2.5 w-2.5 ${c.isPinned ? "fill-current text-slate-800" : "text-slate-400"}`} />
                          </button>
                          <button
                            onClick={() => handleToggleCollapse(c.id)}
                            className="p-0.5 hover:bg-black/10 rounded"
                          >
                            {c.isCollapsed ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronUp className="h-2.5 w-2.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteCardItem(c.id, c.type)}
                            title="Delete item permanently"
                            className="p-0.5 hover:bg-red-500/20 hover:text-red-700 text-slate-500 rounded transition-colors"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card content if not collapsed */}
                      {!c.isCollapsed && (
                        <div className="flex-1 overflow-hidden my-1.5 flex flex-col justify-start">
                          {c.image && (
                            <div className="border border-black/10 rounded overflow-hidden bg-white p-0.5 max-h-12 mb-1 shrink-0">
                              <img src={c.image} className="w-full h-full object-contain" alt="Whiteboard preview" />
                            </div>
                          )}
                          <p className="text-[10px] leading-tight overflow-y-auto max-h-full font-medium whitespace-pre-wrap select-text">
                            {c.content}
                          </p>
                        </div>
                      )}

                      {/* Bottom Controls / double-click cue */}
                      <div className="flex items-center justify-between pt-1 border-t border-black/5 text-[8px] text-black/50 shrink-0">
                        {/* Size & Layers controllers (only visible when expanded) */}
                        {!c.isCollapsed ? (
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => handleResizeCard(c.id, "S")} className="px-1 bg-black/5 hover:bg-black/10 rounded font-bold" title="Resize Small">S</button>
                            <button onClick={() => handleResizeCard(c.id, "M")} className="px-1 bg-black/5 hover:bg-black/10 rounded font-bold" title="Resize Medium">M</button>
                            <button onClick={() => handleResizeCard(c.id, "L")} className="px-1 bg-black/5 hover:bg-black/10 rounded font-bold" title="Resize Large">L</button>
                            <div className="w-px h-2 bg-black/10 mx-0.5" />
                            <button onClick={() => bringToFront(c.id)} className="px-1 bg-black/5 hover:bg-black/10 rounded font-black" title="Bring to Front">▲</button>
                            <button onClick={() => sendToBack(c.id)} className="px-1 bg-black/5 hover:bg-black/10 rounded font-black" title="Send to Back">▼</button>
                          </div>
                        ) : (
                          <div />
                        )}

                        {/* Color swatches */}
                        <div className="flex gap-0.5">
                          {(["yellow", "pink", "green", "blue", "purple"] as const).map(color => (
                            <button
                              key={color}
                              onClick={() => handleChangeCardColor(c.id, color)}
                              className={`w-2 h-2 rounded-full border border-black/10`}
                              style={{
                                backgroundColor:
                                  color === "yellow" ? "#fef08a" :
                                  color === "pink" ? "#fecdd3" :
                                  color === "green" ? "#a7f3d0" :
                                  color === "blue" ? "#bae6fd" : "#e9d5ff"
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Double click to return info banner */}
                      {c.coordinates && (
                        <button
                          onDoubleClick={() => onJumpToLocation(c.page, c.coordinates)}
                          title="Double click to scroll back to PDF"
                          className="text-[7px] text-right text-slate-400 font-bold block shrink-0 hover:text-slate-600 mt-1"
                        >
                          Double click to find in PDF
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Global Document Notes */}
        {activeTab === "notes" && (
          <NotesPanel
            notes={notes}
            activePdfName={activePdfName}
            onCreateNote={onCreateNote}
            onDeleteNote={onDeleteNote}
          />
        )}

        {/* TAB 4: Global Document Flashcards */}
        {activeTab === "flashcards" && (
          <div className="flex flex-col h-full bg-white text-slate-700">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Document Flashcards</span>
              {onCreateFlashcard && (
                <button
                  onClick={onCreateFlashcard}
                  className="p-1 hover:bg-slate-50 text-purple-600 rounded flex items-center gap-1 text-[10px] font-extrabold cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add Card
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredFlashcards.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No active recall flashcards created for this document yet. Use the selection menu to capture definitions!
                </div>
              ) : (
                filteredFlashcards.map((card) => (
                  <div
                    key={card.id}
                    className="p-3 bg-slate-50/50 hover:bg-pink-50/10 border border-slate-150 rounded-xl space-y-1.5 transition-all"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-extrabold uppercase text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded">
                        Active Recall
                      </span>
                      {onDeleteFlashcard && (
                        <button
                          onClick={() => onDeleteFlashcard(card.id)}
                          className="p-1 text-slate-300 hover:text-pink-600 rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-0.5">FRONT (QUESTION)</span>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{card.front}</p>
                    </div>
                    <div className="border-t border-dashed border-slate-100 pt-1.5">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-0.5">BACK (ANSWER)</span>
                      <p className="text-xs text-slate-600 leading-relaxed">{card.back}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: PDF COPILOT */}
        {activeTab === "copilot" && (
          <div className="flex flex-col h-full bg-slate-50 text-slate-800">
            <div className="p-4 bg-white border-b border-slate-200 space-y-2 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-600" /> PDF Copilot
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                  Page {currentPage}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Ask questions about Page {currentPage}, summarize text, or find related formulas.
              </p>
            </div>

            {/* Quick Action Chips */}
            <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap gap-1.5 text-[10px]">
              <button
                onClick={() => handleSendCopilotQuery(`Summarize Page ${currentPage}`)}
                className="px-2.5 py-1 bg-purple-50 text-purple-800 hover:bg-purple-100 font-bold rounded-lg border border-purple-200"
              >
                📖 Summarize Page
              </button>
              <button
                onClick={() => handleSendCopilotQuery(`Find formulas on Page ${currentPage}`)}
                className="px-2.5 py-1 bg-purple-50 text-purple-800 hover:bg-purple-100 font-bold rounded-lg border border-purple-200"
              >
                🧮 Find Formulas
              </button>
              <button
                onClick={() => handleSendCopilotQuery(`Find related flashcards & questions`)}
                className="px-2.5 py-1 bg-purple-50 text-purple-800 hover:bg-purple-100 font-bold rounded-lg border border-purple-200"
              >
                ❓ Find Questions
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {copilotHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl text-xs space-y-1 ${
                    item.role === "user"
                      ? "bg-purple-600 text-white ml-auto max-w-[85%]"
                      : "bg-white text-slate-800 border border-slate-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{item.content}</div>
                </div>
              ))}
              {copilotLoading && (
                <div className="text-xs text-purple-600 font-bold animate-pulse p-2">
                  Analyzing document page...
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCopilotQuery()}
                placeholder={`Ask Copilot about Page ${currentPage}...`}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => handleSendCopilotQuery()}
                disabled={copilotLoading}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: Global Document Formulas */}
        {activeTab === "formulas" && (
          <div className="flex flex-col h-full bg-white text-slate-700">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Formula Book</span>
              {onCreateFormula && (
                <button
                  onClick={onCreateFormula}
                  className="p-1 hover:bg-slate-50 text-purple-600 rounded flex items-center gap-1 text-[10px] font-extrabold cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add Formula
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredFormulas.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No scientific formulas compiled for this document. Save technical snippets directly to your ledger!
                </div>
              ) : (
                filteredFormulas.map((formula) => (
                  <div
                    key={formula.id}
                    className="p-3 bg-slate-50/50 hover:bg-green-50/10 border border-slate-150 rounded-xl space-y-1 transition-all"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-black text-slate-800 leading-snug">{formula.title}</span>
                      {onDeleteFormula && (
                        <button
                          onClick={() => onDeleteFormula(formula.id)}
                          className="p-1 text-slate-300 hover:text-pink-600 rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-mono bg-slate-900 text-green-400 p-2 rounded-lg break-all select-all">
                      {formula.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: Markup Annotations list */}
        {activeTab === "annotations" && (
          <div className="flex flex-col h-full bg-white text-slate-700">
            <div className="p-3 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Markup Annotations</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {annotations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No highlights, underlines, or drawings have been added to this document yet.
                </div>
              ) : (
                annotations.map((ann) => (
                  <div
                    key={ann.id}
                    onClick={() => onNavigateToPage(ann.page)}
                    className="p-2.5 bg-slate-50 hover:bg-purple-50/20 border border-slate-100 rounded-xl transition-all cursor-pointer text-left flex items-start justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-black text-purple-700 uppercase bg-purple-50 px-1.5 py-0.5 rounded">
                          Page {ann.page}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 capitalize">
                          {ann.type}
                        </span>
                      </div>
                      {(ann as any).text && (
                        <p className="text-[10px] text-slate-600 leading-snug italic line-clamp-2">
                          "{(ann as any).text}"
                        </p>
                      )}
                    </div>
                    {onRemoveAnnotation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAnnotation(ann.id);
                        }}
                        className="text-slate-300 hover:text-pink-600 p-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 7: Document Text Search */}
        {activeTab === "search" && (
          <SearchPanel
            searchResults={searchResults}
            isSearching={isSearching}
            onSearch={onSearch}
            onNavigateToPage={onNavigateToPage}
          />
        )}
      </div>

      {/* Mini tab selector strip on the right */}
      <div className="w-[48px] bg-slate-900 flex flex-col items-center py-4 gap-3 border-l border-slate-800 text-slate-400 shrink-0">
        
        {/* RAG Book Studio tab */}
        <button
          onClick={() => setActiveTab("rag-studio")}
          title="RAG Book Knowledge Studio"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "rag-studio" ? "bg-purple-600 text-white font-extrabold shadow-md" : "hover:text-purple-300 hover:bg-slate-800/60"
          }`}
        >
          <Brain className="h-4 w-4" />
        </button>

        {/* Page Knowledge tab */}
        <button
          onClick={() => setActiveTab("page-knowledge")}
          title="Page Knowledge panel"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "page-knowledge" ? "bg-slate-800 text-purple-400 font-extrabold" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <BookOpen className="h-4 w-4" />
        </button>

        {/* Page Workspace Board tab */}
        <button
          onClick={() => setActiveTab("page-workspace")}
          title="Page Digital Whiteboard"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "page-workspace" ? "bg-slate-800 text-purple-400 font-extrabold" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("copilot")}
          title="PDF Copilot & Page AI"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "copilot" ? "bg-purple-600 text-white font-extrabold shadow-md" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="w-6 h-[1px] bg-slate-800 my-1 shrink-0" />

        <button
          onClick={() => setActiveTab("notes")}
          title="Document Study Notes"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "notes" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <FileText className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("flashcards")}
          title="Recall Flashcards"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "flashcards" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Brain className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("formulas")}
          title="Scientific Formulas"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "formulas" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Calculator className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("annotations")}
          title="Markup Log"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "annotations" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Highlighter className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveTab("search")}
          title="Find Text Search"
          className={`p-2 rounded-lg cursor-pointer transition-colors ${
            activeTab === "search" ? "bg-slate-800 text-white" : "hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="mt-auto">
          <button
            onClick={onClose}
            title="Collapse Sidebar"
            className="p-2 rounded-lg hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
