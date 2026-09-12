import React from "react";
import { X, Download, Printer, BookOpen, Brain, Calculator, Bookmark, Sparkles, Image, CheckCircle2 } from "lucide-react";
import { Note, Flashcard, FormulaItem } from "../../types";
import { PDFAnnotation } from "./types/annotation";

interface ExportStudyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfTitle: string;
  notes: Note[];
  flashcards: Flashcard[];
  formulas: FormulaItem[];
  bookmarks: number[];
  annotations: PDFAnnotation[];
  numPages: number;
  userName?: string;
}

export const ExportStudyGuideModal: React.FC<ExportStudyGuideModalProps> = ({
  isOpen,
  onClose,
  pdfTitle,
  notes,
  flashcards,
  formulas,
  bookmarks,
  annotations,
  numPages,
  userName = "Offline Scholar",
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const filteredNotes = notes.filter((n) => !(n as any).pdfName || (n as any).pdfName === pdfTitle);
  const filteredCards = flashcards.filter((f) => !(f as any).pdfName || (f as any).pdfName === pdfTitle);
  const filteredFormulas = formulas.filter((fm) => !(fm as any).pdfName || (fm as any).pdfName === pdfTitle);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header bar (Hidden in print) */}
        <div className="print:hidden px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Compiled Study Guide Generator</h2>
              <p className="text-xs text-slate-400">Export document ledger, notes, flashcards & formulae as a print-ready PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 bg-white text-slate-800 print:p-0 print:overflow-visible">
          {/* Cover Header */}
          <div className="border-b-2 border-purple-600 pb-6 mb-8 flex justify-between items-start">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider mb-2">
                StudyOS V11.0 Master Ledger
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{pdfTitle || "Untitled Document"}</h1>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                Compiled for <span className="text-slate-800 font-bold">{userName}</span> • {numPages} Pages Cataloged
              </p>
            </div>
            <div className="text-right text-xs font-mono text-slate-400">
              <div>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
              <div>Offline Backup ID: #{Math.floor(100000 + Math.random() * 900000)}</div>
            </div>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 mb-1">
                <BookOpen className="h-3.5 w-3.5" />
                <span>Notes Logged</span>
              </div>
              <div className="text-xl font-black text-purple-900">{filteredNotes.length}</div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-1">
                <Brain className="h-3.5 w-3.5" />
                <span>Flashcards</span>
              </div>
              <div className="text-xl font-black text-emerald-900">{filteredCards.length}</div>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 mb-1">
                <Calculator className="h-3.5 w-3.5" />
                <span>Formulae</span>
              </div>
              <div className="text-xl font-black text-blue-900">{filteredFormulas.length}</div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-1">
                <Bookmark className="h-3.5 w-3.5" />
                <span>Bookmarks</span>
              </div>
              <div className="text-xl font-black text-amber-900">{bookmarks.length}</div>
            </div>
          </div>

          {/* SECTION 1: NOTES LOG */}
          <div className="mb-10">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-black text-slate-900">1. Document Notes & Key Takeaways</h2>
            </div>

            {filteredNotes.length === 0 ? (
              <p className="text-xs italic text-slate-400">No notes captured for this document yet.</p>
            ) : (
              <div className="space-y-4">
                {filteredNotes.map((note, idx) => (
                  <div key={note.id || idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-extrabold text-sm text-slate-900">{note.title}</div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                        Page {(note as any).pdfPage || (note as any).page || 1}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{note.content}</div>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {note.tags.map((t) => (
                          <span key={t} className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: FLASHCARDS DECK */}
          <div className="mb-10">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
              <Brain className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-black text-slate-900">2. Active Recall Flashcards Deck</h2>
            </div>

            {filteredCards.length === 0 ? (
              <p className="text-xs italic text-slate-400">No flashcards compiled for this document.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredCards.map((card, idx) => (
                  <div key={card.id || idx} className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/30">
                    <div className="text-[10px] font-black text-emerald-700 uppercase mb-1">
                      Q{idx + 1} • Page {(card as any).pdfPage || (card as any).page || 1}
                    </div>
                    <div className="font-bold text-xs text-slate-900 mb-2">{card.front}</div>
                    <div className="pt-2 border-t border-emerald-200/50 text-xs text-slate-700 bg-white/80 p-2 rounded-lg">
                      <span className="font-extrabold text-emerald-800">Answer: </span>
                      {card.back}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: FORMULAE & DEFINITIONS */}
          <div className="mb-10">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
              <Calculator className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-900">3. Formula & Equation Reference Book</h2>
            </div>

            {filteredFormulas.length === 0 ? (
              <p className="text-xs italic text-slate-400">No equations cataloged.</p>
            ) : (
              <div className="space-y-3">
                {filteredFormulas.map((formula, idx) => (
                  <div key={formula.id || idx} className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div className="font-extrabold text-sm text-slate-900">{formula.title}</div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                        Page {(formula as any).pdfPage || (formula as any).page || 1}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-sm font-bold rounded-lg overflow-x-auto">
                      {(formula as any).expression || formula.content}
                    </div>
                    {((formula as any).explanation || (formula as any).description) && (
                      <div className="text-xs text-slate-600 italic">{(formula as any).explanation || (formula as any).description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-6 border-t border-slate-200 text-center text-xs text-slate-400 font-mono">
            Generated autonomously by StudyOS V11.0 Offline Engine • Zero Cloud Dependency
          </div>
        </div>
      </div>
    </div>
  );
};
