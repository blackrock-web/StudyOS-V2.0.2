import React, { useState, useEffect, useRef } from "react";
import { AppState, Note, Flashcard, FormulaItem } from "../../types";
import {
  usePDFWorkspace,
} from "./hooks/usePDFWorkspace";
import { usePDFDocument } from "./hooks/usePDFDocument";
import { usePDFTabs } from "./hooks/usePDFTabs";
import { usePDFAnnotations } from "./hooks/usePDFAnnotations";
import { usePDFHistory } from "./hooks/usePDFHistory";
import { usePDFSelection } from "./hooks/usePDFSelection";
import { usePDFSearch } from "./hooks/usePDFSearch";
import { usePDFZoom } from "./hooks/usePDFZoom";

import { PDFTabs } from "./PDFTabs";
import { PDFToolbar } from "./PDFToolbar";
import { PDFSidebar } from "./PDFSidebar";
import { PDFRightSidebar } from "./PDFRightSidebar";
import { PDFViewer } from "./PDFViewer";
import { FloatingSelectionToolbar } from "./FloatingSelectionToolbar";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { ExportStudyGuideModal } from "./ExportStudyGuideModal";
import { RAGStudioModal } from "./RAGStudioModal";
import { storageService } from "./services/storageService";

import {
  UploadCloud,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Loader2,
  Trash2,
  ArrowRight,
  X,
} from "lucide-react";
import { Task } from "../../types";

interface PDFWorkspaceProps {
  state?: AppState;
  onUpdateState?: (updates: Partial<AppState>) => void;
  onTriggerNotification?: (
    title: string,
    message: string,
    type: "info" | "warning" | "success" | "alarm"
  ) => void;
}

export const PDFWorkspace: React.FC<PDFWorkspaceProps> = ({
  state: inputState,
  onUpdateState: inputOnUpdateState,
  onTriggerNotification,
}) => {
  const state: AppState = inputState || ({
    notes: [],
    subjects: [],
    tasks: [],
    flashcards: [],
    formulas: [],
    exams: [],
    userProfile: { name: 'Student' },
  } as any);

  const onUpdateState = inputOnUpdateState || (() => {});
  // 1. Files & Directory workspace scanning
  const { localFiles, loadingFiles, errorFiles, scanWorkspaceFiles } = usePDFWorkspace();

  // 2. Tabs State Manager
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    openTab,
    closeTab,
    updateTabState,
    getActiveTab,
  } = usePDFTabs();

  const activeTab = getActiveTab();

  // 3. Document Load State
  const { pdfDocument, loading: docLoading, error: docError, numPages, outline } = usePDFDocument(
    activeTab ? (activeTab.sourceUrl || activeTab.name) : null
  );

  // 4. Annotations Manager (ink, highlights, underline)
  const {
    annotations,
    setAnnotations,
    addAnnotation,
    removeAnnotation,
    clearAllAnnotations,
    getAnnotationsForPage,
    activeTool,
    setActiveTool,
    activeColor,
    setActiveColor,
    strokeThickness,
    setStrokeThickness,
    strokeOpacity,
    setStrokeOpacity,
  } = usePDFAnnotations(activeTabId || null);

  // 5. Drawing Undo/Redo History
  const {
    annotations: historyAnnotations,
    setAnnotations: setHistoryAnnotations,
    pushState: pushHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePDFHistory(annotations);

  // Keep drawing history and annotations layer synced
  useEffect(() => {
    setHistoryAnnotations(annotations);
  }, [annotations]);

  const handleAddAnnotation = async (ann: any) => {
    const freshAnn = await addAnnotation({
      ...ann,
      pdfId: activeTabId || "",
    });
    pushHistoryState([...annotations, freshAnn]);
  };

  const handleRemoveAnnotation = async (id: string) => {
    await removeAnnotation(id);
    pushHistoryState(annotations.filter((a) => a.id !== id));
  };

  // 6. Selection layer coordinates manager
  const { selection, clearSelection, updateSelection } = usePDFSelection();

  // 7. Client-side Search coordinate manager
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchOpen,
    setSearchOpen,
    caseSensitive,
    setCaseSensitive,
    wholeWord,
    setWholeWord,
    isRegex,
    setIsRegex,
    currentMatchIndex,
    setCurrentMatchIndex,
    searchHistory,
    executeSearch,
    clearSearch,
    nextMatch,
    prevMatch,
  } = usePDFSearch();

  // 8. Fluid zoom manager
  const { zoom, zoomIn, zoomOut, setExactZoom } = usePDFZoom(
    activeTab ? activeTab.zoom : 1.3
  );

  const handleSetZoom = (value: number | string) => {
    if (value === "fit-width") {
      const container = document.querySelector(".pdf-viewer-container");
      if (container) {
        const containerWidth = container.clientWidth;
        // Subtract padding (p-8 is 64px, scrollbars, spacing, total ~90px)
        const calculatedZoom = Math.max(0.4, (containerWidth - 90) / 612);
        setExactZoom(Number(calculatedZoom.toFixed(2)));
      }
    } else if (value === "fit-page") {
      const container = document.querySelector(".pdf-viewer-container");
      if (container) {
        const containerHeight = container.clientHeight;
        // Standard page height at 100% zoom is ~850px.
        const calculatedZoom = Math.max(0.4, (containerHeight - 80) / 850);
        setExactZoom(Number(calculatedZoom.toFixed(2)));
      }
    } else {
      setExactZoom(typeof value === "string" ? parseFloat(value) : value);
    }
  };

  // Sync zoom state with the active tab structure
  useEffect(() => {
    if (activeTabId && zoom) {
      updateTabState(activeTabId, { zoom });
    }
  }, [zoom, activeTabId]);

  // Page Snapping, Annotation Bar & Export Guide states
  const [snapToPages, setSnapToPages] = useState<boolean>(false);
  const [annotationBarOpen, setAnnotationBarOpen] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [ragStudioOpen, setRagStudioOpen] = useState<boolean>(false);

  // Sync current page scrolling state with active tab bookmarks
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    if (activeTabId && activeTab) {
      // 1. Always start at Page 1.
      setCurrentPage(1);
      updateTabState(activeTabId, { currentPage: 1 });

      // 2. Reset zoom to 1.0 (100%).
      setExactZoom(1.0);

      // 3. Clear active selections.
      clearSelection();

      // 4. Ensure all floating toolbars or selection controls are closed.
      setCreationModal(null);
      setCollectedSelections([]);
    }
  }, [activeTabId]);

  const handlePageVisible = (page: number) => {
    setCurrentPage(page);
    if (activeTabId) {
      updateTabState(activeTabId, { currentPage: page });
    }
  };

  // 9. Collapsible sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  // Creation helpers from sidebar
  const handleCreateNoteFromSidebar = () => {
    setCreationModal({
      type: "note",
      initialText: `Extracted Note from Page ${currentPage} of ${activeTab?.name || "Document"}`,
    });
  };

  const handleCreateFlashcardFromSidebar = () => {
    setCreationModal({
      type: "card",
      initialText: `Question from Page ${currentPage} of ${activeTab?.name || "Document"}`,
    });
  };

  const handleCreateFormulaFromSidebar = () => {
    setCreationModal({
      type: "formula",
      initialText: `Formula from Page ${currentPage} of ${activeTab?.name || "Document"}`,
    });
  };

  // 10. Dialog popups for creating Note / Flashcard / Formula
  const [creationModal, setCreationModal] = useState<{
    type: "note" | "card" | "formula";
    initialText: string;
    rect?: any;
    image?: string;
  } | null>(null);

  // Buffer state for multi-selection collection support
  const [collectedSelections, setCollectedSelections] = useState<{
    text: string;
    rect?: any;
    page: number;
    image?: string;
  }[]>([]);

  // Helper function to crop the selected area from rendered canvas
  const cropCanvas = (pageNum: number, rect: { x: number; y: number; w: number; h: number }) => {
    try {
      const pageEl = document.querySelector(`[data-page-num="${pageNum}"]`);
      if (!pageEl) return null;
      const canvas = pageEl.querySelector("canvas");
      if (!canvas) return null;

      const scaleFactor = 2; // Crisp 2x device-pixel-ratio captures
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = rect.w * scaleFactor;
      tempCanvas.height = rect.h * scaleFactor;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return null;

      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = "high";

      // Calculate backing ratio (dpr)
      const dpr = canvas.width / parseFloat(canvas.style.width || String(canvas.width));

      tempCtx.drawImage(
        canvas,
        rect.x * dpr,
        rect.y * dpr,
        rect.w * dpr,
        rect.h * dpr,
        0,
        0,
        rect.w * scaleFactor,
        rect.h * scaleFactor
      );

      return tempCanvas.toDataURL("image/png");
    } catch (err) {
      console.warn("Failed to crop canvas:", err);
      return null;
    }
  };

  // Helper to scroll and visually pulse highlight the target region
  const handleJumpToLocation = (page: number, coordinates?: { x: number; y: number; w: number; h: number }) => {
    handleNavigateToPage(page);
    setTimeout(() => {
      const pageEl = document.querySelector(`[data-page-num="${page}"]`) as HTMLElement;
      const viewerContainer = document.querySelector(".overflow-y-auto.bg-slate-100") as HTMLElement;
      if (pageEl && viewerContainer) {
        const scrollY = pageEl.offsetTop + (coordinates ? coordinates.y : 0) - 100;
        viewerContainer.scrollTo({
          top: scrollY,
          behavior: "smooth"
        });
        
        // Draw visual pulsing highlight overlay in parent page relative container
        if (coordinates) {
          const highlightDiv = document.createElement("div");
          highlightDiv.className = "absolute border-4 border-yellow-400 bg-yellow-400/20 animate-pulse rounded z-[999] pointer-events-none transition-all duration-1000";
          highlightDiv.style.left = `${coordinates.x}px`;
          highlightDiv.style.top = `${coordinates.y}px`;
          highlightDiv.style.width = `${coordinates.w}px`;
          highlightDiv.style.height = `${coordinates.h}px`;
          
          const relativeContainer = pageEl.querySelector(".relative");
          if (relativeContainer) {
            relativeContainer.appendChild(highlightDiv);
            setTimeout(() => {
              highlightDiv.style.opacity = "0";
              setTimeout(() => highlightDiv.remove(), 1000);
            }, 2500);
          }
        }
      }
    }, 350);
  };

  const handleCopyText = () => {
    if (!selection) return;
    navigator.clipboard.writeText(selection.text);
    if (onTriggerNotification) {
      onTriggerNotification("Copied to Clipboard", "Selected text copied successfully.", "success");
    }
    clearSelection();
  };

  const handleToolbarCreateTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: `Review Page ${currentPage} of ${activeTab?.name || "document"}`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      priority: "Medium",
      type: "Study",
      completed: false,
      rescheduledCount: 0,
      notes: selection?.text || `Review coordinates on Page ${currentPage}`,
      pdfMockName: activeTab?.name,
      pdfPage: currentPage,
      coordinates: selection?.rect || undefined,
    } as any;
    onUpdateState({
      tasks: [newTask, ...(state.tasks || [])],
    });
    if (onTriggerNotification) {
      onTriggerNotification("Task Created", "A study task was linked to this page and added to your tracker.", "success");
    }
    clearSelection();
  };

  const handleToolbarAddTag = () => {
    const tag = prompt("Enter a tag for this selection:", "Important");
    if (tag) {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: `Tag: ${tag} (Page ${currentPage})`,
        content: selection?.text || `Tagged region on page ${currentPage}`,
        lastModified: new Date().toISOString(),
        pdfMockName: activeTab?.name,
        pdfPage: currentPage,
        image: selection?.rect ? cropCanvas(selection.rect.page, selection.rect) || undefined : undefined,
        coordinates: selection?.rect || undefined,
        topic: tag,
      } as any;
      onUpdateState({
        notes: [newNote, ...(state.notes || [])],
      });
      if (onTriggerNotification) {
        onTriggerNotification("Tagged successfully", `Saved as a tagged note: "${tag}"`, "success");
      }
    }
    clearSelection();
  };

  const handleToolbarAddToRevision = () => {
    if (onTriggerNotification) {
      onTriggerNotification("Added to Revision Planner", `Page ${currentPage} has been scheduled for spaced repetition review.`, "success");
    }
    clearSelection();
  };

  const handleCaptureRegion = () => {
    if (!selection || !selection.rect) {
      if (onTriggerNotification) {
        onTriggerNotification("No Region Box", "Please use the 'select' tool to draw a rectangle bounds box first.", "warning");
      }
      return;
    }
    const imgData = cropCanvas(selection.rect.page, selection.rect);
    if (imgData) {
      const newNote: Note = {
        id: `note-capture-${Date.now()}`,
        title: `Captured Diagram - Page ${currentPage}`,
        content: selection.text || `Screenshot of diagrams, figures or equations on Page ${currentPage}`,
        lastModified: new Date().toISOString(),
        pdfMockName: activeTab?.name,
        pdfPage: currentPage,
        image: imgData,
        coordinates: selection.rect,
        topic: "Diagram",
      } as any;
      onUpdateState({
        notes: [newNote, ...(state.notes || [])],
      });

      // Save locally via browser download
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `studyos_capture_p${currentPage}_${Date.now()}.png`;
      link.click();

      if (onTriggerNotification) {
        onTriggerNotification("Region Captured", "Saved diagram locally and logged into your study notes dashboard.", "success");
      }
    }
    clearSelection();
  };

  const handleCollectSelection = () => {
    if (!selection) return;
    let croppedImage = undefined;
    if (selection.rect) {
      croppedImage = cropCanvas(selection.rect.page, selection.rect) || undefined;
    }

    setCollectedSelections((prev) => [
      ...prev,
      {
        text: selection.text || (selection.rect ? `Extracted region p. ${selection.rect.page}` : ""),
        rect: selection.rect || undefined,
        page: selection.rect ? selection.rect.page : currentPage,
        image: croppedImage,
      },
    ]);

    if (onTriggerNotification) {
      onTriggerNotification(
        "Added to Collection",
        `Buffered this selection. Current multi-selection collection has ${collectedSelections.length + 1} items.`,
        "success"
      );
    }
    clearSelection();
  };

  const handleSaveCollectedBundle = () => {
    if (collectedSelections.length === 0) return;

    // Combine all text and screenshots into one comprehensive Note
    const combinedText = collectedSelections
      .map(
        (sel, idx) =>
          `### Selection #${idx + 1} (Page ${sel.page})\n${sel.text}\n${
            sel.rect ? `Coordinates: x=${Math.round(sel.rect.x)}, y=${Math.round(sel.rect.y)}, w=${Math.round(sel.rect.w)}, h=${Math.round(sel.rect.h)}` : ""
          }`
      )
      .join("\n\n---\n\n");

    const primaryImage = collectedSelections.find((s) => s.image)?.image;

    const combinedNote: Note = {
      id: `note-bundle-${Date.now()}`,
      title: `Multi-Selection Bundle (${collectedSelections.length} items) - Page ${currentPage}`,
      content: combinedText,
      lastModified: new Date().toISOString(),
      pdfMockName: activeTab?.name,
      pdfPage: currentPage,
      image: primaryImage,
    } as any;

    onUpdateState({
      notes: [combinedNote, ...(state.notes || [])],
    });

    if (onTriggerNotification) {
      onTriggerNotification(
        "Collection Compiled",
        `Created a single compiled study note with all ${collectedSelections.length} extracts synced.`,
        "success"
      );
    }

    setCollectedSelections([]);
  };

  // 11. State for manual uploader
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Recent History List from DB
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  useEffect(() => {
    storageService.getRecentFiles().then((recents) => {
      setRecentFiles(recents || []);
    });
  }, [activeTabId]);

  // Handle selecting/uploading a local PDF (offline IndexedDB + open in viewer)
  const handleFileUpload = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      if (onTriggerNotification) {
        onTriggerNotification("Invalid Format", "Please upload PDF documents only.", "warning");
      }
      return;
    }

    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      if (onTriggerNotification) {
        onTriggerNotification("Invalid Format", "Only PDF files are supported.", "warning");
      }
      return;
    }

    setUploadingFile(true);

    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string" && result.startsWith("data:")) {
            resolve(result);
          } else {
            reject(new Error("Failed to read PDF as data URL."));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read local file."));
        reader.readAsDataURL(file);
      });

      const id = `local-pdf-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await storageService.savePdfFile(id, file.name, dataUrl, file.size);
      await openTab(id, file.name, dataUrl);
      await storageService.addRecentFile(file.name);
      await scanWorkspaceFiles();

      if (onTriggerNotification) {
        onTriggerNotification(
          "PDF Loaded",
          `${file.name} is selected and open in the workspace.`,
          "success"
        );
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      if (onTriggerNotification) {
        onTriggerNotification(
          "Upload Failed",
          error?.message || "Failed to load the selected PDF.",
          "alarm"
        );
      }
    } finally {
      setUploadingFile(false);
    }
  };

  // Drag and Drop helpers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Handle double clicking or selecting a file from workspace list
  const handleOpenFile = async (file: any) => {
    let sourceUrl: string | undefined = file.sourceUrl;
    if (!sourceUrl && file.id) {
      try {
        const stored = await storageService.getPdfFile(file.id);
        sourceUrl = stored?.dataUrl;
      } catch (err) {
        console.warn("Could not resolve stored PDF binary:", err);
      }
    }
    await openTab(file.id || file.name, file.name, sourceUrl);
    await storageService.addRecentFile(file.name);
    if (onTriggerNotification) {
      onTriggerNotification(
        "Workspace Document Loaded",
        sourceUrl
          ? `Opened ${file.name} in the PDF viewer.`
          : `Opened ${file.name} — re-select the file if the viewer cannot load it.`,
        sourceUrl ? "info" : "warning"
      );
    }
  };

  // Bookmark toggle
  const handleToggleBookmark = () => {
    if (!activeTab) return;
    const isBookmarked = (activeTab.bookmarks || []).includes(currentPage);
    let updated: number[];
    if (isBookmarked) {
      updated = (activeTab.bookmarks || []).filter((b) => b !== currentPage);
    } else {
      updated = [...(activeTab.bookmarks || []), currentPage];
    }
    updateTabState(activeTab.id, { bookmarks: updated });
    
    if (onTriggerNotification) {
      onTriggerNotification(
        isBookmarked ? "Bookmark Removed" : "Bookmark Saved",
        `Page ${currentPage} is ${isBookmarked ? "removed from" : "added to"} your study bookmarks.`,
        "info"
      );
    }
  };

  // Navigate to target page
  const handleNavigateToPage = (page: number) => {
    if (page < 1 || page > numPages) return;
    setCurrentPage(page);
    if (activeTabId) {
      updateTabState(activeTabId, { currentPage: page });
    }
  };

  // Apply Highlight / Markup directly on selected text coordinates
  const handleApplyMarkup = (type: "highlight" | "underline" | "strikethrough") => {
    if (!selection) return;

    if (selection.rect) {
      handleAddAnnotation({
        pdfId: activeTabId,
        page: selection.rect.page,
        type,
        color: activeColor,
        coordinates: {
          x: selection.rect.x,
          y: selection.rect.y,
          w: selection.rect.w,
          h: selection.rect.h,
        },
        thickness: strokeThickness,
        opacity: type === "highlight" ? 0.35 : strokeOpacity,
      });
    }

    clearSelection();
  };

  // Apply Highlight directly with custom chosen color
  const handleApplyColoredHighlight = (color: string) => {
    if (!selection) return;

    if (selection.rect) {
      handleAddAnnotation({
        pdfId: activeTabId,
        page: selection.rect.page,
        type: "highlight",
        color: color,
        coordinates: {
          x: selection.rect.x,
          y: selection.rect.y,
          w: selection.rect.w,
          h: selection.rect.h,
        },
        thickness: strokeThickness,
        opacity: 0.35,
      });
      if (onTriggerNotification) {
        onTriggerNotification("Highlighted", `Applied color highlight on Page ${selection.rect.page}.`, "success");
      }
    }

    clearSelection();
  };

  // Create Sticky Note annotation directly pinned on the page
  const handleCreateStickyNote = () => {
    if (!selection) return;
    const noteText = prompt("Enter Sticky Note text:", selection.text || "");
    if (noteText !== null && noteText.trim().length > 0) {
      const pageNum = selection.rect ? selection.rect.page : currentPage;
      const x = selection.rect ? selection.rect.x : (selection.position ? selection.position.pageX : 50);
      const y = selection.rect ? selection.rect.y : (selection.position ? selection.position.pageY : 50);

      handleAddAnnotation({
        pdfId: activeTabId,
        page: pageNum,
        type: "sticky-note",
        color: "#fef08a",
        text: noteText.trim(),
        coordinates: {
          x: x,
          y: y,
          w: 28,
          h: 28,
        },
        opacity: 1,
      });

      // Also create a linked note item in StudyOS notes
      const newNote: Note = {
        id: `note-sticky-${Date.now()}`,
        title: `Sticky Note (Page ${pageNum})`,
        content: `📌 Sticky Note: ${noteText.trim()}\n\nContext: ${selection.text || "Pinned on document"}`,
        lastModified: new Date().toISOString(),
        pdfMockName: activeTab?.name,
        pdfPage: pageNum,
        topic: "Sticky Note",
      } as any;
      onUpdateState({
        notes: [newNote, ...(state.notes || [])],
      });

      if (onTriggerNotification) {
        onTriggerNotification("Sticky Note Pinned", `Added sticky note on Page ${pageNum}.`, "success");
      }
    }
    clearSelection();
  };

  // Generate and download a structured markdown report of retrieved context and AI insights
  const handleExportSummaryMarkdown = () => {
    const docName = activeTab?.name || "Document";
    const dateStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const relevantNotes = (state.notes || []).filter(
      (n: any) => n.pdfMockName === activeTab?.name || !n.pdfMockName
    );
    const relevantCards = (state.flashcards || []).filter(
      (c: any) => c.pdfMockName === activeTab?.name || !c.pdfMockName
    );
    const relevantFormulas = (state.formulas || []).filter(
      (f: any) => f.pdfMockName === activeTab?.name || !f.pdfMockName
    );
    const relevantAnnotations = (annotations || []).filter(
      (a: any) => a.pdfId === activeTabId
    );

    let md = `# StudyOS Synthesis & Insights Summary Report\n\n`;
    md += `**Document:** ${docName}\n`;
    md += `**Date:** ${dateStr}\n`;
    md += `**Total Pages:** ${numPages || 1}\n`;
    md += `**Active Page:** ${currentPage}\n`;
    md += `**Generated By:** StudyOS Local Knowledge Engine\n\n`;
    md += `---\n\n`;

    md += `## 1. Executive Summary & Context Overview\n\n`;
    md += `This structured summary compiles extracted context, semantic insights, annotations, and active recall items generated during study sessions for **${docName}**.\n\n`;

    // Notes section
    md += `## 2. Key Insights & Study Notes (${relevantNotes.length})\n\n`;
    if (relevantNotes.length === 0) {
      md += `*No notes recorded yet for this document.*\n\n`;
    } else {
      relevantNotes.forEach((n: any, idx: number) => {
        md += `### ${idx + 1}. ${n.title || "Untitled Note"} ${n.pdfPage ? `(Page ${n.pdfPage})` : ""}\n`;
        if (n.topic) md += `**Topic:** \`${n.topic}\`\n\n`;
        md += `${n.content}\n\n`;
      });
    }

    // Flashcards & Active Recall section
    md += `## 3. Active Recall Flashcards (${relevantCards.length})\n\n`;
    if (relevantCards.length === 0) {
      md += `*No flashcards created yet for this document.*\n\n`;
    } else {
      relevantCards.forEach((c: any, idx: number) => {
        md += `**Q${idx + 1}:** ${c.front || c.question}\n`;
        md += `> **A:** ${c.back || c.answer}\n\n`;
      });
    }

    // Formulas & Rules section
    if (relevantFormulas.length > 0) {
      md += `## 4. Key Formulas & Equations (${relevantFormulas.length})\n\n`;
      relevantFormulas.forEach((f: any, idx: number) => {
        md += `### ${idx + 1}. ${f.name || f.title}\n`;
        md += `$$\n${f.latex || f.formula || f.content}\n$$\n`;
        if (f.description) md += `${f.description}\n\n`;
      });
    }

    // Document Annotations & Sticky Notes
    md += `## 5. Document Annotations & Pinned Markers (${relevantAnnotations.length})\n\n`;
    if (relevantAnnotations.length === 0) {
      md += `*No annotations marked on this document.*\n\n`;
    } else {
      const highlights = relevantAnnotations.filter((a: any) => a.type === "highlight");
      const stickies = relevantAnnotations.filter((a: any) => a.type === "sticky-note");
      const others = relevantAnnotations.filter((a: any) => a.type !== "highlight" && a.type !== "sticky-note");

      if (stickies.length > 0) {
        md += `### Sticky Notes (${stickies.length})\n`;
        stickies.forEach((s: any) => {
          md += `- **Page ${s.page}:** ${s.text || "Pinned Note"}\n`;
        });
        md += `\n`;
      }

      if (highlights.length > 0) {
        md += `### Highlights (${highlights.length})\n`;
        highlights.forEach((h: any) => {
          md += `- Highlight on **Page ${h.page}** (Color: \`${h.color}\`)\n`;
        });
        md += `\n`;
      }

      if (others.length > 0) {
        md += `### Visual Markups (${others.length})\n`;
        others.forEach((o: any) => {
          md += `- **Page ${o.page}:** ${o.type} annotation (${o.color})\n`;
        });
        md += `\n`;
      }
    }

    md += `---\n`;
    md += `*Generated offline by StudyOS Desktop — Local-First Intelligent Study System*\n`;

    // Download as Markdown file
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeDocName = docName.replace(/[^a-zA-Z0-9_-]/g, "_");
    link.href = url;
    link.download = `${safeDocName}_Summary_Report_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onTriggerNotification) {
      onTriggerNotification(
        "Summary Exported",
        `Generated and downloaded markdown summary report for ${docName}.`,
        "success"
      );
    }
  };

  // Create study notes/cards/formulas from floating menu triggers
  const handleOpenCreationModal = (type: "note" | "card" | "formula") => {
    if (!selection) return;

    let croppedImage = undefined;
    if (selection.rect) {
      croppedImage = cropCanvas(selection.rect.page, selection.rect) || undefined;
    }

    setCreationModal({
      type,
      initialText: selection.text || (selection.rect ? `Extracted Rectangular Region on Page ${selection.rect.page}` : ""),
      rect: selection.rect,
      image: croppedImage,
    });
    clearSelection();
  };

  const handleSaveStudyResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creationModal) return;

    const form = e.currentTarget as HTMLFormElement;
    const text = (form.elements.namedItem("snippetText") as HTMLTextAreaElement).value;

    if (creationModal.type === "note") {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: `Snippet Page ${currentPage} - ${activeTab?.name.slice(0, 20)}`,
        content: text,
        lastModified: new Date().toISOString(),
        pdfMockName: activeTab?.name,
        pdfPage: currentPage,
        image: creationModal.image,
        coordinates: creationModal.rect,
      } as any;
      onUpdateState({
        notes: [newNote, ...(state.notes || [])],
      });
      if (onTriggerNotification) {
        onTriggerNotification("Note Extract Compiled", "Saved coordinates snippet into your StudyOS note logs.", "success");
      }
    } else if (creationModal.type === "card") {
      const back = (form.elements.namedItem("cardBack") as HTMLTextAreaElement).value;
      const newCard: Flashcard = {
        id: `card-${Date.now()}`,
        subject: state.subjects[0]?.id || "sub_1",
        front: text,
        back: back || "Write active recall answer here.",
        confidence: 1,
        difficulty: "Medium",
        topic: activeTab?.name.replace(".pdf", ""),
        pdfName: activeTab?.name,
        pdfPage: currentPage,
        image: creationModal.image,
        coordinates: creationModal.rect,
      } as any;
      onUpdateState({
        flashcards: [newCard, ...(state.flashcards || [])],
      });
      if (onTriggerNotification) {
        onTriggerNotification("Flashcard Created", "Added active-recall card directly into Study Hub deck.", "success");
      }
    } else if (creationModal.type === "formula") {
      const formulaTitle = (form.elements.namedItem("formulaTitle") as HTMLInputElement).value;
      const newFormula: FormulaItem = {
        id: `formula-${Date.now()}`,
        subjectId: state.subjects[0]?.id || "sub_1",
        subjectName: state.subjects[0]?.name || "General",
        category: "Formula",
        title: formulaTitle || "Formula / Shortcut Definition",
        content: text,
        pdfName: activeTab?.name,
        pdfPage: currentPage,
        image: creationModal.image,
        coordinates: creationModal.rect,
      } as any;
      onUpdateState({
        formulas: [newFormula, ...(state.formulas || [])],
      });
      if (onTriggerNotification) {
        onTriggerNotification("Formula Compiled", "Added scientific equation into local Formula Book.", "success");
      }
    }

    setCreationModal(null);
  };

  // Offline: cloud AI disabled — guide user to manual extract
  const [analyzingKnowledge, setAnalyzingKnowledge] = useState(false);
  const handleAutoGenerateFlashcards = async () => {
    if (!activeTab) return;
    setAnalyzingKnowledge(true);
    if (onTriggerNotification) {
      onTriggerNotification(
        "Offline Mode",
        "Cloud AI is disabled. Highlight PDF text to create flashcards locally.",
        "info"
      );
    }

    try {
      // Offline-only: cloud AI disabled — no remote compile, no state mutation
      if (onTriggerNotification) {
        onTriggerNotification(
          "Offline",
          "Use text selection on the PDF to create flashcards and notes locally.",
          "info"
        );
      }
    } catch (err: unknown) {
      console.error("Offline compile path error:", err);
      if (onTriggerNotification) {
        onTriggerNotification(
          "Notice",
          "Cloud AI is disabled in offline StudyOS.",
          "warning"
        );
      }
    } finally {
      setAnalyzingKnowledge(false);
    }
  };

  // Immediate smart selection popup on mouseup & active listeners block
  const handleMouseUpSelection = () => {
    if (typeof window === "undefined") return;
    if (activeTool !== "pan" && activeTool !== "highlight" && activeTool !== "underline" && activeTool !== "strikethrough") return;

    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const selectedText = sel.toString().trim();
      if (!selectedText) return;

      try {
        const range = sel.getRangeAt(0);
        const bounds = range.getBoundingClientRect();
        if (bounds.width === 0 || bounds.height === 0) return;

        // Determine actual page number
        let pageNum = currentPage;
        let node: HTMLElement | null = range.startContainer.parentElement;
        while (node) {
          if (node.hasAttribute && node.hasAttribute("data-page-num")) {
            const p = parseInt(node.getAttribute("data-page-num") || "");
            if (!isNaN(p)) {
              pageNum = p;
              break;
            }
          }
          node = node.parentElement;
        }

        // Relative coordinate parsing for highlighting
        let relativeX = bounds.left;
        let relativeY = bounds.top;
        if (node) {
          const nodeBounds = node.getBoundingClientRect();
          relativeX = bounds.left - nodeBounds.left;
          relativeY = bounds.top - nodeBounds.top;
        }

        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + window.scrollY;

        updateSelection(
          selectedText,
          { x: relativeX, y: relativeY, w: bounds.width, h: bounds.height, page: pageNum },
          { x, y, pageX: bounds.left + bounds.width / 2, pageY: bounds.top + window.scrollY }
        );
      } catch (err) {
        console.warn("Could not calculate selection position:", err);
      }
    }, 150); // within 150ms
  };

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUpSelection);

    // Escape listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Outside click dismiss listener
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".floating-selection-toolbar") || target.closest(".creation-modal") || target.closest(".modal")) {
        return;
      }
      if (window.getSelection()?.toString().trim() === "") {
        clearSelection();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);

    // Capture scrolling container events to auto-dismiss
    const handleScrollEvent = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.classList && target.classList.contains("overflow-y-auto")) {
        clearSelection();
      }
    };
    document.addEventListener("scroll", handleScrollEvent, true);

    return () => {
      document.removeEventListener("mouseup", handleMouseUpSelection);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("scroll", handleScrollEvent, true);
    };
  }, [activeTool, currentPage, selection]);

  const handleNextMatch = () => {
    const nextIdx = nextMatch();
    if (nextIdx !== -1 && searchResults[nextIdx]) {
      handleNavigateToPage(searchResults[nextIdx].page);
    }
  };

  const handlePrevMatch = () => {
    const prevIdx = prevMatch();
    if (prevIdx !== -1 && searchResults[prevIdx]) {
      handleNavigateToPage(searchResults[prevIdx].page);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 relative overflow-hidden flex-1 rounded-2xl border border-slate-200/50">
      {/* 1. HORIZONTAL TABS STRIP */}
      <PDFTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
      />

      {/* 2. READER WORKSPACE OR EMPTY DASHBOARD */}
      {tabs.length > 0 && activeTab ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          {/* Top toolbar */}
          <PDFToolbar
            currentPage={currentPage}
            numPages={numPages}
            zoom={zoom}
            activeTool={activeTool}
            activeColor={activeColor}
            bookmarks={activeTab.bookmarks || []}
            canUndo={canUndo}
            canRedo={canRedo}
            snapToPages={snapToPages}
            annotationBarOpen={annotationBarOpen}
            onToggleSnapToPages={() => {
              setSnapToPages(!snapToPages);
              onTriggerNotification?.("Page Snapping", !snapToPages ? "Snapping enabled." : "Snapping disabled.", "info");
            }}
            onToggleAnnotationBar={() => setAnnotationBarOpen(!annotationBarOpen)}
            onExportStudyGuide={() => setExportModalOpen(true)}
            onExportSummaryMarkdown={handleExportSummaryMarkdown}
            onOpenRAGStudio={() => setRagStudioOpen(true)}
            onPageChange={handleNavigateToPage}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onSetZoom={handleSetZoom}
            onToolSelect={setActiveTool}
            onColorSelect={setActiveColor}
            onToggleBookmark={handleToggleBookmark}
            onUndo={undo}
            onRedo={redo}
            onToggleSearch={() => {
              setSearchOpen(!searchOpen);
              if (!searchOpen) setSidebarOpen(true);
            }}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
            onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
            rightSidebarOpen={rightSidebarOpen}
          />

          {/* Main workspace arena splits Sidebar & Viewer */}
          <div className="flex flex-1 min-h-0 overflow-hidden relative">
            {/* Sidebar Shelf */}
             <PDFSidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              pdfDocument={pdfDocument}
              numPages={numPages}
              currentPage={currentPage}
              bookmarks={activeTab.bookmarks || []}
              searchResults={searchResults}
              isSearching={isSearching}
              notes={state.notes || []}
              flashcards={state.flashcards || []}
              formulas={state.formulas || []}
              activePdfName={activeTab.name}
              outline={outline}
              onNavigateToPage={handleNavigateToPage}
              onToggleBookmark={handleToggleBookmark}
              onSearch={(query) => executeSearch(pdfDocument, query)}
              onCreateNote={handleCreateNoteFromSidebar}
              onDeleteNote={(id) => {
                onUpdateState({
                  notes: (state.notes || []).filter((n) => n.id !== id),
                });
              }}
              onJumpToLocation={handleJumpToLocation}

              // Advanced search extensions
              searchQuery={searchQuery}
              caseSensitive={caseSensitive}
              setCaseSensitive={setCaseSensitive}
              wholeWord={wholeWord}
              setWholeWord={setWholeWord}
              isRegex={isRegex}
              setIsRegex={setIsRegex}
              currentMatchIndex={currentMatchIndex}
              setCurrentMatchIndex={setCurrentMatchIndex}
              searchHistory={searchHistory}
              onClearSearch={clearSearch}
              onNextMatch={handleNextMatch}
              onPrevMatch={handlePrevMatch}
            />

            {/* Document viewing stage */}
            {docLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 gap-2">
                <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
                <span className="text-sm font-semibold text-slate-500">Buffering document pages...</span>
              </div>
            ) : docError ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 gap-4 p-8 text-center">
                <div className="p-4 bg-pink-50 rounded-2xl border border-pink-100 max-w-md">
                  <span className="text-sm font-black text-pink-700 block mb-1">Document Load Error</span>
                  <p className="text-xs text-pink-600 leading-relaxed">{docError}</p>
                </div>
                <button
                  onClick={() => closeTab(activeTab.id)}
                  className="px-4 py-2 bg-slate-800 text-white font-extrabold text-xs rounded-xl cursor-pointer hover:bg-slate-900"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
                {/* Floating Annotation Bar overlay */}
                {annotationBarOpen && (
                  <AnnotationToolbar
                    activeTool={activeTool}
                    activeColor={activeColor}
                    onSelectTool={(t) => setActiveTool(t as any)}
                    onSelectColor={setActiveColor}
                    onClose={() => setAnnotationBarOpen(false)}
                    onClearAnnotations={clearAllAnnotations}
                  />
                )}

                <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
                  <PDFViewer
                    pdfDocument={pdfDocument}
                    numPages={numPages}
                    zoom={zoom}
                    rotation={0}
                    activeTool={activeTool}
                    activeColor={activeColor}
                    strokeThickness={strokeThickness}
                    strokeOpacity={strokeOpacity}
                    annotations={historyAnnotations}
                    currentPage={currentPage}
                    snapToPages={snapToPages}
                    onPageVisible={handlePageVisible}
                    onAddAnnotation={handleAddAnnotation}
                    onRemoveAnnotation={handleRemoveAnnotation}
                    searchQuery={searchQuery}
                    caseSensitive={caseSensitive}
                    wholeWord={wholeWord}
                    isRegex={isRegex}
                    onSelectionComplete={(rect, pos) => {
                      let extractedText = "";
                      try {
                        const pageContainer = document.querySelector(`[data-page-num="${rect.page}"]`);
                        if (pageContainer) {
                          const spans = pageContainer.querySelectorAll(".textLayer span");
                          const overlappingSpans: { text: string; left: number; top: number }[] = [];
                          
                          spans.forEach((span: any) => {
                            const left = parseFloat(span.style.left) || 0;
                            const top = parseFloat(span.style.top) || 0;
                            const fontSize = parseFloat(span.style.fontSize) || 12;
                            // Estimate width based on actual element width or text length
                            const width = span.offsetWidth || (span.textContent ? span.textContent.length * fontSize * 0.65 : 0);
                            const height = fontSize;

                            // Check overlap with selection rectangle
                            const xOverlap = Math.max(0, Math.min(left + width, rect.x + rect.w) - Math.max(left, rect.x));
                            const yOverlap = Math.max(0, Math.min(top + height, rect.y + rect.h) - Math.max(top, rect.y));

                            if (xOverlap > 0 && yOverlap > 0) {
                              overlappingSpans.push({
                                text: span.textContent || "",
                                left,
                                top
                              });
                            }
                          });

                          // Sort overlapping spans first by vertical position (line), then by horizontal position (column)
                          overlappingSpans.sort((a, b) => {
                            if (Math.abs(a.top - b.top) < 6) {
                              return a.left - b.left;
                            }
                            return a.top - b.top;
                          });

                          extractedText = overlappingSpans.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
                        }
                      } catch (err) {
                        console.warn("Error extracting text from selection rectangle:", err);
                      }

                      if (!extractedText) {
                        extractedText = "Extracted Crop Region (Page " + rect.page + ")";
                      }

                      updateSelection(extractedText, rect, pos);
                    }}
                  />

                  {/* Floating contextual crop selection toolbar */}
                  {selection && selection.position && (
                    <FloatingSelectionToolbar
                      x={selection.position.pageX}
                      y={selection.position.pageY}
                      selectedText={selection.text}
                      hasRect={!!selection.rect}
                      onApplyMarkup={handleApplyMarkup}
                      onApplyColoredHighlight={handleApplyColoredHighlight}
                      onAddStickyNote={handleCreateStickyNote}
                      onCreateNote={() => handleOpenCreationModal("note")}
                      onCreateFlashcard={() => handleOpenCreationModal("card")}
                      onCreateFormula={() => handleOpenCreationModal("formula")}
                      onCaptureRegion={handleCaptureRegion}
                      onToggleBookmark={handleToggleBookmark}
                      onCopyText={handleCopyText}
                      onCreateTask={handleToolbarCreateTask}
                      onAddTag={handleToolbarAddTag}
                      onAddToRevision={handleToolbarAddToRevision}
                      onCollectSelection={handleCollectSelection}
                      onClose={clearSelection}
                    />
                  )}

                  {/* Multi-Selection Bundle Floating Dock */}
                  {collectedSelections.length > 0 && (
                    <div className="absolute bottom-12 left-6 z-[45] flex items-center gap-3 bg-white p-3 rounded-2xl border border-purple-200 shadow-xl animate-bounce">
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-black text-slate-800">Multi-Selection Dock</span>
                        <span className="text-[10px] text-slate-500 font-bold">{collectedSelections.length} items collected</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleSaveCollectedBundle}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black rounded-lg transition-all cursor-pointer"
                        >
                          Save Bundle
                        </button>
                        <button
                          onClick={() => setCollectedSelections([])}
                          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                          title="Clear collection"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Status Bar */}
                <div className="h-7 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[10px] text-slate-500 font-bold shrink-0 select-none">
                  <div className="flex items-center gap-3">
                    <span>Page {currentPage} of {numPages || 1}</span>
                    <span className="text-slate-200">|</span>
                    <span>Zoom: {Math.round(zoom * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Reading Progress:</span>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                      <div
                        className="bg-purple-500 h-full transition-all duration-300"
                        style={{ width: `${numPages > 0 ? (currentPage / numPages) * 100 : 0}%` }}
                      />
                    </div>
                    <span>{numPages > 0 ? Math.round((currentPage / numPages) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Right Sidebar Shelf */}
            <PDFRightSidebar
              isOpen={rightSidebarOpen}
              onClose={() => setRightSidebarOpen(false)}
              currentPage={currentPage}
              notes={state.notes || []}
              flashcards={state.flashcards || []}
              formulas={state.formulas || []}
              annotations={historyAnnotations}
              tasks={state.tasks || []}
              bookmarks={activeTab.bookmarks || []}
              activePdfName={activeTab.name}
              searchResults={searchResults}
              isSearching={isSearching}
              onSearch={(query) => executeSearch(pdfDocument, query)}
              onNavigateToPage={handleNavigateToPage}
              onJumpToLocation={handleJumpToLocation}
              onCreateNote={handleCreateNoteFromSidebar}
              onDeleteNote={(id) => {
                onUpdateState({
                  notes: (state.notes || []).filter((n) => n.id !== id),
                });
              }}
              onCreateFlashcard={handleCreateFlashcardFromSidebar}
              onDeleteFlashcard={(id) => {
                onUpdateState({
                  flashcards: (state.flashcards || []).filter((fc) => fc.id !== id),
                });
              }}
              onCreateFormula={handleCreateFormulaFromSidebar}
              onDeleteFormula={(id) => {
                onUpdateState({
                  formulas: (state.formulas || []).filter((f) => f.id !== id),
                });
              }}
              onRemoveAnnotation={handleRemoveAnnotation}
              onToggleBookmark={handleToggleBookmark}
            />
          </div>
        </div>
      ) : (
        /* Empty Workspace Dashboard View */
        <div className="flex-1 overflow-y-auto p-8 w-full max-w-none space-y-8 select-none text-slate-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">StudyOS Workspace v9.0</h2>
              <p className="text-xs text-slate-500 mt-1">
                Your premium, distraction-free reading deck. Upload documents and capture notes, cards, or formulas instantly.
              </p>
            </div>
            <button
              onClick={scanWorkspaceFiles}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Refresh Directory
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`md:col-span-2 border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-4 transition-all relative min-h-[220px] ${
                dragActive
                  ? "border-purple-600 bg-purple-50/20 scale-[0.99]"
                  : "border-slate-300 hover:border-purple-400 bg-white"
              }`}
            >
              <input
                type="file"
                id="file-upload-input"
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
                {uploadingFile ? (
                  <Loader2 className="h-10 w-10 text-purple-600 animate-spin" />
                ) : (
                  <UploadCloud className="h-12 w-12 text-purple-600" />
                )}
                <div>
                  <span className="text-sm font-black text-slate-800">
                    {uploadingFile ? "Uploading to workspace..." : "Drag & Drop PDF study resources"}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select local syllabuses, reference books, or previous exams. Only PDF allowed.
                  </p>
                </div>
              </label>
            </div>

            {/* AI Smart study banner */}
            <div className="bg-purple-900 text-white rounded-3xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden min-h-[220px]">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="h-32 w-32" />
              </div>
              <div className="space-y-1.5 relative z-10">
                <span className="text-[9px] font-black uppercase text-purple-300 tracking-wider">AI Knowledge extraction</span>
                <h4 className="text-base font-black leading-tight">One-Click Syllabus Study Deck</h4>
                <p className="text-[10px] text-purple-200 leading-relaxed pt-1.5">
                  Our system scans textbook chapters to extract critical theorems, active-recall flashcard questions, and core study notes automatically.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-purple-300 pt-3 cursor-pointer hover:text-white group relative z-10">
                <span>Select a book file to start</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Local workspace files lists */}
            <div className="md:col-span-2 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Workspace books directory</span>
              {loadingFiles ? (
                <div className="flex items-center justify-center py-12 bg-white border border-slate-200/50 rounded-2xl gap-2 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                  <span className="text-xs font-semibold">Scanning local directories...</span>
                </div>
              ) : localFiles.length === 0 ? (
                <div className="p-8 bg-white border border-slate-100 rounded-3xl text-center text-xs text-slate-400">
                  Your directory is currently empty. Upload your first PDF resource above!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {localFiles.map((file) => (
                    <div
                      key={file.id}
                      onDoubleClick={() => handleOpenFile(file)}
                      className="p-3.5 bg-white hover:bg-purple-50/5 hover:border-purple-300 border border-slate-200/50 rounded-2xl transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-xs font-black text-slate-800 truncate block leading-tight">
                            {file.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block pt-0.5">{file.size}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenFile(file)}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 text-[10px] font-black rounded-lg transition-all"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent History Shelf */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Recent Study History</span>
              {recentFiles.length === 0 ? (
                <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center text-xs text-slate-400">
                  No reading history yet.
                </div>
              ) : (
                <div className="bg-white border border-slate-200/50 rounded-2xl p-4 divide-y divide-slate-100/60">
                  {recentFiles.slice(0, 4).map((fName, index) => {
                    // Match with localFiles if available to get ID
                    const matchedFile = localFiles.find((f) => f.name === fName);
                    return (
                      <div
                        key={index}
                        onClick={() => handleOpenFile(matchedFile || { id: fName, name: fName })}
                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-purple-600" />
                          <span className="text-[11px] font-semibold text-slate-700 truncate group-hover:text-slate-800">
                            {fName}
                          </span>
                        </div>
                        <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. ASSET CREATION COMPILATION DIALOG */}
      {creationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <form
            onSubmit={handleSaveStudyResource}
            className="w-full max-w-md bg-white border border-slate-200 shadow-2xl rounded-3xl overflow-hidden select-none text-slate-700 animate-scaleUp"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Compile Extract to StudyOS {creationModal.type}
              </span>
              <button
                type="button"
                onClick={() => setCreationModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  {creationModal.type === "formula" ? "Scientific / Textbook Content" : "Extracted Snippet text"}
                </label>
                <textarea
                  name="snippetText"
                  rows={4}
                  defaultValue={creationModal.initialText}
                  className="w-full text-xs p-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono leading-relaxed bg-slate-50"
                  required
                />
              </div>

              {creationModal.type === "card" && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Active-Recall Answer (Card Back)
                  </label>
                  <textarea
                    name="cardBack"
                    rows={3}
                    placeholder="Provide the answer, key steps, or explanations here..."
                    className="w-full text-xs p-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold bg-white"
                    required
                  />
                </div>
              )}

              {creationModal.type === "formula" && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Formula Identifier / Description
                  </label>
                  <input
                    type="text"
                    name="formulaTitle"
                    placeholder="e.g., Dijkstra's Complexity, Euler's Theorem"
                    className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-purple-500 font-bold bg-white"
                    required
                  />
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreationModal(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-500 font-extrabold text-[11px] rounded-xl cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[11px] rounded-xl cursor-pointer transition-colors"
              >
                Compile Study Resource
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Export Study Guide Modal */}
      <ExportStudyGuideModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        pdfTitle={activeTab ? activeTab.name : "StudyOS Document"}
        notes={state.notes || []}
        flashcards={state.flashcards || []}
        formulas={state.formulas || []}
        bookmarks={activeTab?.bookmarks || []}
        annotations={historyAnnotations}
        numPages={numPages}
        userName={(state as any).userProfile?.name}
      />

      {/* RAG Book Studio Modal */}
      <RAGStudioModal
        isOpen={ragStudioOpen}
        onClose={() => setRagStudioOpen(false)}
        activePdfName={activeTab ? activeTab.name : "Study Document"}
        currentPage={currentPage}
        onNavigateToPage={handleNavigateToPage}
        onJumpToLocation={handleJumpToLocation}
        onTriggerNotification={onTriggerNotification}
      />
    </div>
  );
};
