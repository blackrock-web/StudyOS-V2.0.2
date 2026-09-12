import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  BookOpen,
  Sparkles,
  Layers,
  CheckCircle2,
  Search,
  Plus,
  Zap,
  Download,
  Eye,
  Crop,
  Bookmark,
  Highlighter,
  MessageSquare,
  BookmarkPlus,
  HelpCircle,
  FileCode,
  Camera,
  Link,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Filter,
  Tag,
  Share2,
  Brain,
} from 'lucide-react';
import { db } from '../../services/db';
import { PDFDocumentItem, PDFCaptureItem, PDFCaptureType, Flashcard, ExamItem } from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { RAGStudioPanel } from './RAGStudioPanel';

interface PDFKnowledgeEngineProps {
  onShowNotification: (msg: string, title?: string) => void;
}

export const PDFKnowledgeEngine: React.FC<PDFKnowledgeEngineProps> = ({
  onShowNotification,
}) => {
  const [pdfs, setPDFs] = useState<PDFDocumentItem[]>(db.getPDFs());
  const [selectedPDF, setSelectedPDF] = useState<PDFDocumentItem | null>(pdfs[0] || null);
  const [captures, setCaptures] = useState<PDFCaptureItem[]>(db.getPDFCaptures());
  const [exams, setExams] = useState<ExamItem[]>(db.getExams());

  // Workspace View Mode: 'reader' | 'captures' | 'hierarchy' | 'rag-book'
  const [activeTab, setActiveTab] = useState<'reader' | 'captures' | 'hierarchy' | 'rag-book'>('reader');

  // Reader Controls
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isSnipToolActive, setIsSnipToolActive] = useState<boolean>(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [captureFilterType, setCaptureFilterType] = useState<string>('all');

  // Rectangle Selection Mouse States
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Capture Creation Modal State
  const [showCaptureModal, setShowCaptureModal] = useState<boolean>(false);
  const [captureType, setCaptureType] = useState<PDFCaptureType>('highlight');
  const [capturedText, setCapturedText] = useState<string>('');
  const [annotationText, setAnnotationText] = useState<string>('');
  const [captureColor, setCaptureColor] = useState<string>('purple');

  // Hierarchical Link Pickers
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>('');
  const [selectedChapterName, setSelectedChapterName] = useState<string>('');
  const [selectedTopicName, setSelectedTopicName] = useState<string>('');

  useEffect(() => {
    const handleCaptureUpdate = () => setCaptures(db.getPDFCaptures());
    window.addEventListener('studyos_pdf_captures_updated', handleCaptureUpdate);
    return () => window.removeEventListener('studyos_pdf_captures_updated', handleCaptureUpdate);
  }, []);

  const selectedExamObj = exams.find((e) => e.id === selectedExamId);

  // --- FILE UPLOAD HANDLER ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsProcessingUpload(true);

    setTimeout(() => {
      if (!file) {
        setIsProcessingUpload(false);
        return;
      }
      const newPdf: PDFDocumentItem = {
        id: 'pdf-' + Date.now(),
        title: file.name,
        subject: 'Uploaded Study Material',
        fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        pageCount: Math.floor(Math.random() * 50) + 12,
        readProgressPages: 1,
        readingTimeMinutes: 5,
        indexedChapters: ['Chapter 1: Principles', 'Chapter 2: Core Theorems', 'Chapter 3: Solved Examples'],
        notesExtractedCount: 0,
        flashcardsExtractedCount: 0,
        uploadedAt: new Date().toISOString().split('T')[0] || '',
        contentSnippet: `Offline Document: ${file.name}. Full text OCR indexing enabled for offline snippet selection and flashcard generation.`,
      };

      db.addPDF(newPdf);
      const updatedPDFs = db.getPDFs();
      setPDFs(updatedPDFs);
      setSelectedPDF(newPdf);
      setCurrentPage(1);
      setIsProcessingUpload(false);
      onShowNotification(`PDF "${file.name}" loaded into offline knowledge engine!`, 'PDF Reader');
    }, 1000);
  };

  // --- RECTANGLE SELECTION MOUSE EVENTS ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSnipToolActive || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsSelecting(true);
    setSelectionStart({ x, y });
    setCurrentSelection({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionStart || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = currentX - selectionStart.x;
    const height = currentY - selectionStart.y;

    setCurrentSelection({
      x: width < 0 ? currentX : selectionStart.x,
      y: height < 0 ? currentY : selectionStart.y,
      w: Math.abs(width),
      h: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !currentSelection) return;
    setIsSelecting(false);

    // Only open capture modal if rect is at least 15x15 px
    if (currentSelection.w > 15 && currentSelection.h > 15) {
      setCapturedText(`Captured region [${Math.round(currentSelection.w)}x${Math.round(currentSelection.h)}px] on Page ${currentPage} of ${selectedPDF?.title || 'PDF'}`);
      setAnnotationText('');
      if (exams[0]) {
        setSelectedExamId(exams[0].id);
        const sub = exams[0].subjects?.[0];
        if (sub) {
          setSelectedSubjectName(sub.name);
          const chap = sub.chapters?.[0];
          if (chap) {
            setSelectedChapterName(chap.name);
            const top = chap.topics?.[0];
            if (top) {
              setSelectedTopicName(top.name);
            }
          }
        }
      }
      setShowCaptureModal(true);
    } else {
      setCurrentSelection(null);
    }
  };

  // --- SAVE CAPTURE ITEM ---
  const handleSaveCapture = () => {
    if (!selectedPDF) return;

    const newCapture: PDFCaptureItem = {
      id: 'cap-' + Date.now(),
      pdfId: selectedPDF.id,
      pdfTitle: selectedPDF.title,
      pageNumber: currentPage,
      type: captureType,
      rectBounds: currentSelection ? { x: currentSelection.x, y: currentSelection.y, width: currentSelection.w, height: currentSelection.h } : undefined,
      capturedText: capturedText || `Snippet from page ${currentPage}`,
      annotationText: annotationText,
      color: captureColor,
      examId: selectedExamId,
      examTitle: selectedExamObj?.title,
      subjectName: selectedSubjectName,
      chapterName: selectedChapterName,
      topicName: selectedTopicName,
      createdAt: new Date().toISOString(),
    };

    db.addPDFCapture(newCapture);
    setCaptures(db.getPDFCaptures());

    // If flashcard, also add to Spaced Repetition engine!
    if (captureType === 'flashcard') {
      const flashcard: Flashcard = {
        id: 'fc-pdf-' + Date.now(),
        subject: selectedSubjectName || selectedPDF.subject,
        chapter: selectedChapterName || selectedPDF.title,
        front: capturedText || `Formula/Concept from Page ${currentPage}`,
        back: annotationText || 'Extracted from PDF Snip',
        category: 'Flashcard',
        nextReviewDate: new Date().toISOString().split('T')[0] || '',
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 0,
        confidence: 3,
      };
      db.addFlashcard(flashcard);
    }

    onShowNotification(`Saved ${captureType.replace('_', ' ')} capture linked to ${selectedTopicName || 'General Topic'}!`, 'PDF Knowledge Workspace');
    setShowCaptureModal(false);
    setCurrentSelection(null);
  };

  const handleDeleteCapture = (id: string) => {
    db.deletePDFCapture(id);
    setCaptures(db.getPDFCaptures());
    onShowNotification('Capture deleted', 'PDF Reader');
  };

  const filteredCaptures = captures.filter((c) => {
    if (captureFilterType === 'all') return true;
    return c.type === captureFilterType;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-[#1e1b4b] font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-wider">
              PRIMARY KNOWLEDGE WORKSPACE
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              100% OFFLINE READER
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight mt-1">
            <FileText className="w-6 h-6 text-purple-600" /> Offline PDF Knowledge Engine
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Read PDFs, select custom rectangle snips, and automatically generate linked flashcards, formulas, and notes (Exam → Subject → Chapter → Topic).
          </p>
        </div>

        {/* Top Controls & Import PDF */}
        <div className="flex items-center space-x-3 shrink-0">
          <label className="cursor-pointer px-4 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:opacity-95 text-white flex items-center gap-2 shadow-md">
            <Upload className="w-4 h-4" />
            <span>{isProcessingUpload ? 'Processing...' : 'Upload PDF'}</span>
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={isProcessingUpload} />
          </label>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between border-b border-purple-100 pb-2">
        <div className="flex items-center space-x-2 bg-purple-50/80 p-1 rounded-2xl border border-purple-200">
          <button
            onClick={() => setActiveTab('reader')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'reader'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" /> PDF Reader & Snip Canvas
          </button>
          <button
            onClick={() => setActiveTab('captures')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'captures'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Crop className="w-4 h-4" /> All Captures & Highlights ({captures.length})
          </button>
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'hierarchy'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link className="w-4 h-4" /> Linked Hierarchy (Exam → Topic)
          </button>
          <button
            onClick={() => setActiveTab('rag-book')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'rag-book'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-700 bg-purple-100/70 hover:bg-purple-200/80'
            }`}
          >
            <Brain className="w-4 h-4" /> RAG Book Studio
          </button>
        </div>
      </div>

      {/* TAB 1: PDF READER & RECTANGLE SNIP CANVAS */}
      {activeTab === 'reader' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* PDF Documents Sidebar */}
          <GlassCard className="p-4 space-y-4 lg:col-span-1 h-fit">
            <h2 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center justify-between border-b border-purple-100 pb-2">
              <span>PDF Library ({pdfs.length})</span>
            </h2>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar">
              {pdfs.map((pdf) => {
                const isSelected = selectedPDF?.id === pdf.id;
                return (
                  <div
                    key={pdf.id}
                    onClick={() => {
                      setSelectedPDF(pdf);
                      setCurrentPage(1);
                      setCurrentSelection(null);
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                      isSelected
                        ? 'bg-purple-100/90 border-purple-300 ring-2 ring-purple-500/30 shadow-xs'
                        : 'bg-white/80 border-purple-100 hover:border-purple-200'
                    }`}
                  >
                    <div className="font-extrabold text-xs text-slate-900 truncate">{pdf.title}</div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{pdf.pageCount} Pages</span>
                      <span>{pdf.fileSize}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Active PDF Viewer & Snip Tool Canvas */}
          <GlassCard className="p-6 space-y-4 lg:col-span-3 flex flex-col justify-between min-h-[600px] relative">
            {selectedPDF ? (
              <>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-purple-50/90 p-3 rounded-2xl border border-purple-200">
                  {/* Snip Tool Toggle */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsSnipToolActive(!isSnipToolActive)}
                      className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                        isSnipToolActive
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white ring-2 ring-rose-400'
                          : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      <Crop className="w-4 h-4" />
                      {isSnipToolActive ? 'Snip Tool ACTIVE (Drag to select)' : 'Enable Snip Tool'}
                    </button>
                    {isSnipToolActive && (
                      <span className="text-[10px] text-rose-700 font-bold bg-rose-100 px-2.5 py-1 rounded-lg animate-pulse">
                        Click & Drag box over text/formula/diagram
                      </span>
                    )}
                  </div>

                  {/* Page Controls & Zoom */}
                  <div className="flex items-center space-x-3 text-xs font-extrabold text-slate-700">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1.5 rounded-lg bg-white border border-purple-200 disabled:opacity-40 hover:bg-purple-100"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Page <span className="text-purple-700 font-black">{currentPage}</span> of {selectedPDF.pageCount}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(selectedPDF.pageCount, p + 1))}
                      disabled={currentPage >= selectedPDF.pageCount}
                      className="p-1.5 rounded-lg bg-white border border-purple-200 disabled:opacity-40 hover:bg-purple-100"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="h-4 w-px bg-purple-200" />

                    <button
                      onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                      className="p-1.5 rounded-lg bg-white border border-purple-200 hover:bg-purple-100"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-xs text-purple-700">{zoomLevel}%</span>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                      className="p-1.5 rounded-lg bg-white border border-purple-200 hover:bg-purple-100"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Simulated Interactive PDF Page Canvas */}
                <div className="flex-1 flex justify-center items-center py-4 bg-slate-900/5 rounded-2xl overflow-auto border border-purple-100 p-4">
                  <div
                    ref={canvasContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                    className={`relative bg-white shadow-2xl border border-slate-300 w-[680px] min-h-[850px] p-10 font-serif select-none transition-transform ${
                      isSnipToolActive ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                  >
                    {/* Simulated PDF Document Page Content */}
                    <div className="space-y-6 text-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] font-sans text-slate-400 uppercase font-bold">
                        <span>{selectedPDF.subject}</span>
                        <span>Page {currentPage} of {selectedPDF.pageCount}</span>
                      </div>

                      <h2 className="text-xl font-bold font-sans text-slate-900 tracking-tight">
                        {selectedPDF.indexedChapters[(currentPage - 1) % selectedPDF.indexedChapters.length] || 'Chapter Overview'}
                      </h2>

                      <p className="text-sm leading-relaxed">
                        In computer systems and formal algorithm design, the asymptotic bounds define the worst-case, average-case, and best-case execution bounds. Consider the recurrence relation:
                      </p>

                      <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl font-mono text-center text-sm font-bold text-purple-950">
                        T(n) = 2T(n/2) + O(n log n)  ⟹  T(n) = Θ(n log² n)
                      </div>

                      <p className="text-sm leading-relaxed">
                        By applying Case 2 of the Master Theorem with k=1, the tight bound yields quadratic logarithmic expansion. Below is the structured theorem proof and memory latency spectrum diagram.
                      </p>

                      <div className="p-6 bg-slate-100 border border-slate-300 rounded-xl text-center space-y-2 font-sans">
                        <div className="text-xs font-bold uppercase text-slate-500">Diagram / Diagramatic Snippet Area</div>
                        <div className="text-sm font-extrabold text-slate-700">Cache Coherence Protocols (MESI / MOESI States)</div>
                        <div className="w-full h-24 bg-gradient-to-r from-purple-100 via-pink-100 to-amber-100 rounded-lg flex items-center justify-center text-xs font-mono font-bold text-slate-600">
                          [ Interactive Canvas Region - Select Box to Snip Diagram ]
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 italic font-sans pt-4 border-t border-slate-200">
                        {selectedPDF.contentSnippet}
                      </p>
                    </div>

                    {/* Rectangle Selection Overlay Box */}
                    {currentSelection && (
                      <div
                        style={{
                          left: `${currentSelection.x}px`,
                          top: `${currentSelection.y}px`,
                          width: `${currentSelection.w}px`,
                          height: `${currentSelection.h}px`,
                        }}
                        className="absolute border-2 border-dashed border-rose-500 bg-rose-500/20 pointer-events-none rounded-sm shadow-lg flex items-center justify-center"
                      >
                        <span className="text-[10px] font-mono font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded shadow-xs">
                          {Math.round(currentSelection.w)}x{Math.round(currentSelection.h)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-slate-400">
                <BookOpen className="w-12 h-12 mx-auto text-purple-300 mb-2" />
                <p className="font-bold text-sm">No PDF Selected</p>
                <p className="text-xs text-slate-500">Select a document from the left library or upload a new PDF.</p>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* TAB 2: CAPTURES & HIGHLIGHTS GRID */}
      {activeTab === 'captures' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-purple-50/80 p-3 rounded-2xl border border-purple-200">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
              <Filter className="w-4 h-4 text-purple-600" />
              <span>Filter by Capture Type:</span>
              <select
                value={captureFilterType}
                onChange={(e) => setCaptureFilterType(e.target.value)}
                className="p-1.5 bg-white border border-purple-300 rounded-xl font-bold text-xs focus:outline-none"
              >
                <option value="all">All Captures ({captures.length})</option>
                <option value="highlight">Highlights</option>
                <option value="annotation">Annotations</option>
                <option value="bookmark">Bookmarks</option>
                <option value="flashcard">Flashcards</option>
                <option value="revision_note">Revision Notes</option>
                <option value="formula_note">Formula Notes</option>
                <option value="screenshot">Screenshots</option>
                <option value="linked_note">Linked Notes</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCaptures.map((cap) => (
              <GlassCard key={cap.id} className="p-4 space-y-3 relative group">
                <div className="flex items-start justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                    {cap.type.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => handleDeleteCapture(cap.id)}
                    className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="font-extrabold text-xs text-slate-900 border-b border-purple-100 pb-2">
                  {cap.pdfTitle} • Page {cap.pageNumber}
                </div>

                <p className="text-xs text-slate-700 font-mono bg-purple-50/60 p-2.5 rounded-xl border border-purple-100">
                  "{cap.capturedText}"
                </p>

                {cap.annotationText && (
                  <p className="text-xs text-purple-900 font-semibold italic">
                    Note: {cap.annotationText}
                  </p>
                )}

                {cap.examTitle && (
                  <div className="text-[10px] font-extrabold text-slate-500 bg-slate-100 p-1.5 rounded-lg flex items-center gap-1">
                    <Link className="w-3 h-3 text-purple-600 shrink-0" />
                    <span>{cap.examTitle} ➔ {cap.subjectName} ➔ {cap.chapterName} ➔ {cap.topicName}</span>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HIERARCHICAL KNOWLEDGE MAP */}
      {activeTab === 'hierarchy' && (
        <GlassCard className="p-6 space-y-4">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-purple-100 pb-2">
            <Link className="w-5 h-5 text-purple-600" /> Hierarchical Knowledge Base (Exam ➔ Subject ➔ Chapter ➔ Topic)
          </h2>

          <div className="space-y-4">
            {exams.map((exam) => (
              <div key={exam.id} className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-3">
                <div className="flex items-center justify-between font-black text-sm text-purple-950">
                  <span>{exam.title} ({exam.code})</span>
                  <span className="text-xs bg-purple-200 px-2.5 py-0.5 rounded-full">{exam.category}</span>
                </div>

                <div className="pl-4 space-y-2 border-l-2 border-purple-300">
                  {exam.subjects.map((subj) => (
                    <div key={subj.id} className="space-y-1.5">
                      <div className="text-xs font-extrabold text-slate-800">Subject: {subj.name}</div>
                      <div className="pl-4 space-y-1">
                        {subj.chapters.map((chap) => (
                          <div key={chap.id} className="text-xs font-medium text-slate-600">
                            Chapter: {chap.name}
                            <div className="pl-4 flex flex-wrap gap-1.5 pt-1">
                              {chap.topics.map((top) => (
                                <span key={top.id} className="text-[10px] font-bold px-2 py-0.5 bg-white border border-purple-200 rounded-md text-purple-700">
                                  Topic: {top.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* TAB 4: RAG BOOK KNOWLEDGE STUDIO WORKBENCH */}
      {activeTab === 'rag-book' && (
        <GlassCard className="p-0 overflow-hidden border-purple-200 shadow-md">
          <div className="h-[750px] flex flex-col bg-white">
            <RAGStudioPanel
              activePdfName={selectedPDF?.title || 'Active Document'}
              currentPage={currentPage}
              onNavigateToPage={(page) => {
                setCurrentPage(page);
                setActiveTab('reader');
              }}
              onTriggerNotification={(title, msg) => onShowNotification(msg, title)}
            />
          </div>
        </GlassCard>
      )}

      {/* RECTANGLE CAPTURE MODAL */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 border border-purple-200 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-purple-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Crop className="w-5 h-5 text-rose-600" /> Save Captured Rectangle Snip
              </h3>
              <button onClick={() => setShowCaptureModal(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-extrabold text-slate-700">Capture Action Type:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  {[
                    { id: 'highlight', label: 'Highlight', icon: Highlighter },
                    { id: 'annotation', label: 'Annotation', icon: MessageSquare },
                    { id: 'bookmark', label: 'Bookmark', icon: Bookmark },
                    { id: 'flashcard', label: 'Flashcard', icon: Sparkles },
                    { id: 'revision_note', label: 'Revision Note', icon: FileText },
                    { id: 'formula_note', label: 'Formula Note', icon: Zap },
                    { id: 'screenshot', label: 'Screenshot', icon: Camera },
                    { id: 'linked_note', label: 'Linked Note', icon: Link },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSel = captureType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCaptureType(item.id as PDFCaptureType)}
                        className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          isSel
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-purple-50 text-slate-700 hover:bg-purple-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700">Captured Text / Prompt:</label>
                <textarea
                  value={capturedText}
                  onChange={(e) => setCapturedText(e.target.value)}
                  rows={2}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700">Annotation / Solution Note:</label>
                <input
                  type="text"
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  placeholder="Enter custom note or formula answer..."
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-purple-200 rounded-xl text-xs font-sans focus:outline-none"
                />
              </div>

              {/* Hierarchical Mapping Pickers */}
              <div className="p-3 bg-purple-50/80 rounded-2xl border border-purple-200 space-y-2">
                <div className="text-[11px] font-black uppercase text-purple-700 flex items-center gap-1">
                  <Link className="w-3.5 h-3.5" /> Link To Hierarchy (Exam ➔ Subject ➔ Chapter ➔ Topic)
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">Exam:</label>
                    <select
                      value={selectedExamId}
                      onChange={(e) => {
                        setSelectedExamId(e.target.value);
                        const ex = exams.find((x) => x.id === e.target.value);
                        if (ex && ex.subjects && ex.subjects.length > 0) {
                          const sub = ex.subjects[0];
                          if (sub) {
                            setSelectedSubjectName(sub.name);
                            const chap = sub.chapters?.[0];
                            if (chap) {
                              setSelectedChapterName(chap.name);
                              const top = chap.topics?.[0];
                              if (top) {
                                setSelectedTopicName(top.name);
                              }
                            }
                          }
                        }
                      }}
                      className="w-full p-1.5 bg-white border border-purple-300 rounded-lg text-xs font-bold"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500">Subject:</label>
                    <select
                      value={selectedSubjectName}
                      onChange={(e) => setSelectedSubjectName(e.target.value)}
                      className="w-full p-1.5 bg-white border border-purple-300 rounded-lg text-xs font-bold"
                    >
                      {selectedExamObj?.subjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-purple-100">
              <button
                type="button"
                onClick={() => setShowCaptureModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCapture}
                className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md"
              >
                Save Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
