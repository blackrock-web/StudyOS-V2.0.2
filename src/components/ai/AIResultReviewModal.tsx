import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Copy,
  ExternalLink,
  Check,
  Save,
  X,
  FileText,
  Layers,
  HelpCircle,
  Brain,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  AIGenerationType,
  AIReviewEventPayload,
  FlashcardResult,
  NotesResult,
  QuizResult,
  MindMapResult,
  FormulaSheetResult,
  parseTextToNotes,
  parseTextToFlashcards,
  parseTextToQuiz,
  parseTextToSummary,
  parseTextToMindMap,
  parseTextToFormulaSheet,
  getActiveProvider,
} from '../../services/aiProvider';
import { db, safeDispatch } from '../../services/db';
import { contentEngine } from '../../services/contentEngine';
import { GlassCard } from '../shared/GlassCard';

export const AIResultReviewModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<AIReviewEventPayload | null>(null);

  // Raw text & copy state
  const [rawText, setRawText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showNotice, setShowNotice] = useState(true);

  // Editable Parsed States
  const [notesData, setNotesData] = useState<NotesResult | null>(null);
  const [flashcardsData, setFlashcardsData] = useState<FlashcardResult[]>([]);
  const [quizData, setQuizData] = useState<QuizResult | null>(null);
  const [summaryData, setSummaryData] = useState<string>('');
  const [mindMapData, setMindMapData] = useState<MindMapResult | null>(null);
  const [formulaData, setFormulaData] = useState<FormulaSheetResult | null>(null);

  // Saving state & notice
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  useEffect(() => {
    // Check if browser notice was dismissed previously
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('studyos_browser_convenience_notice_seen');
      if (dismissed === 'true') {
        setShowNotice(false);
      }
    }

    const handleTrigger = (e: CustomEvent<AIReviewEventPayload>) => {
      const data = e.detail;
      setPayload(data);
      setRawText(data.sourceText || '');
      setSaveSuccessMsg('');

      // Initialize structured state based on payload or parsing
      if (data.generationType === 'notes') {
        setNotesData(data.parsedResult || parseTextToNotes(data.sourceText, data.options));
      } else if (data.generationType === 'flashcards') {
        setFlashcardsData(data.parsedResult || parseTextToFlashcards(data.sourceText, data.options));
      } else if (data.generationType === 'quiz') {
        setQuizData(data.parsedResult || parseTextToQuiz(data.sourceText, data.options));
      } else if (data.generationType === 'summary') {
        setSummaryData(data.parsedResult || parseTextToSummary(data.sourceText));
      } else if (data.generationType === 'mindmap') {
        setMindMapData(data.parsedResult || parseTextToMindMap(data.sourceText, data.options));
      } else if (data.generationType === 'formulasheet') {
        setFormulaData(data.parsedResult || parseTextToFormulaSheet(data.sourceText, data.options));
      }

      setIsOpen(true);
    };

    window.addEventListener('studyos_trigger_ai_review' as any, handleTrigger);
    return () => {
      window.removeEventListener('studyos_trigger_ai_review' as any, handleTrigger);
    };
  }, []);

  if (!isOpen || !payload) return null;

  const isBrowserProvider = payload.providerId === 'browser';

  const handleCopyPrompt = async () => {
    if (payload.preparedPrompt) {
      try {
        await navigator.clipboard.writeText(payload.preparedPrompt);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      } catch (e) {
        console.warn('Failed to copy prompt', e);
      }
    }
  };

  const handleReParse = () => {
    if (payload.generationType === 'notes') {
      setNotesData(parseTextToNotes(rawText, payload.options));
    } else if (payload.generationType === 'flashcards') {
      setFlashcardsData(parseTextToFlashcards(rawText, payload.options));
    } else if (payload.generationType === 'quiz') {
      setQuizData(parseTextToQuiz(rawText, payload.options));
    } else if (payload.generationType === 'summary') {
      setSummaryData(parseTextToSummary(rawText));
    } else if (payload.generationType === 'mindmap') {
      setMindMapData(parseTextToMindMap(rawText, payload.options));
    } else if (payload.generationType === 'formulasheet') {
      setFormulaData(parseTextToFormulaSheet(rawText, payload.options));
    }
  };

  const handleDismissNotice = () => {
    setShowNotice(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('studyos_browser_convenience_notice_seen', 'true');
    }
  };

  const handleSaveToStudyOS = () => {
    const subjectName = payload.options?.subject || 'General Study';
    const chapterName = payload.options?.chapter || 'AI Generated';

    try {
      if (payload.generationType === 'notes' && notesData) {
        const title = notesData.title || 'AI Generated Note';
        const body = `${notesData.summary ? `> ${notesData.summary}\n\n` : ''}${notesData.detailedContent}`;
        db.saveScratchpadNote({
          title,
          content: body,
        });
        contentEngine.createItem({
          type: 'note',
          title,
          body,
          tags: ['AI-Generated', 'Note', subjectName],
          metadata: {
            subject: subjectName,
            chapter: chapterName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }, 'AIEngine');
      } else if (payload.generationType === 'flashcards' && flashcardsData.length > 0) {
        flashcardsData.forEach((fc, idx) => {
          const cardId = `ai-fc-${Date.now()}-${idx}`;
          db.addFlashcard({
            id: cardId,
            subject: fc.subject || subjectName,
            chapter: fc.chapter || chapterName,
            front: fc.front,
            back: fc.back,
            category: fc.category || 'Flashcard',
            formula: fc.formula || '',
            nextReviewDate: new Date().toISOString().split('T')[0],
            intervalDays: 1,
            easeFactor: 2.5,
            repetitions: 0,
            confidence: 3,
          });
          contentEngine.createItem({
            id: cardId,
            type: 'flashcard',
            title: fc.front,
            body: fc.back,
            tags: ['AI-Generated', 'SRS', fc.subject || subjectName].filter(Boolean) as string[],
            metadata: {
              subject: fc.subject || subjectName,
              chapter: fc.chapter || chapterName,
              category: fc.category || 'Flashcard',
              formula: fc.formula || '',
              nextReviewDate: new Date().toISOString().split('T')[0],
              intervalDays: 1,
              easeFactor: 2.5,
              repetitions: 0,
              confidence: 3,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }, 'AIEngine');
        });
      } else if (payload.generationType === 'quiz' && quizData) {
        db.addResource({
          id: `res-quiz-${Date.now()}`,
          title: quizData.title,
          subjectId: quizData.subject || subjectName,
          type: 'Practice',
          fileSize: `${quizData.questions.length} Questions`,
          createdDate: new Date().toISOString().split('T')[0]!,
          updatedDate: new Date().toISOString().split('T')[0]!,
          examId: db.getActiveExamId(),
          isFavorite: false,
          tags: ['AI-Generated', 'Quiz'],
          content: JSON.stringify(quizData.questions),
        });
        contentEngine.createItem({
          type: 'question_bank',
          title: quizData.title,
          body: JSON.stringify(quizData.questions),
          tags: ['AI-Generated', 'Quiz', quizData.subject || subjectName],
          metadata: {
            subject: quizData.subject || subjectName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }, 'AIEngine');
      } else if (payload.generationType === 'summary' && summaryData) {
        const title = `Summary: ${payload.options?.topic || subjectName}`;
        db.saveScratchpadNote({
          title,
          content: summaryData,
        });
        contentEngine.createItem({
          type: 'note',
          title,
          body: summaryData,
          tags: ['AI-Generated', 'Summary', subjectName],
          metadata: {
            subject: subjectName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }, 'AIEngine');
      } else if (payload.generationType === 'mindmap' && mindMapData) {
        db.addResource({
          id: `res-mm-${Date.now()}`,
          title: mindMapData.title,
          subjectId: mindMapData.subject || subjectName,
          type: 'Notes',
          fileSize: 'Structured Concept',
          createdDate: new Date().toISOString().split('T')[0]!,
          updatedDate: new Date().toISOString().split('T')[0]!,
          examId: db.getActiveExamId(),
          isFavorite: false,
          tags: ['AI-Generated', 'MindMap'],
          content: JSON.stringify(mindMapData.root),
        });
      } else if (payload.generationType === 'formulasheet' && formulaData) {
        db.addResource({
          id: `res-fs-${Date.now()}`,
          title: formulaData.title,
          subjectId: formulaData.subject || subjectName,
          type: 'Formula',
          fileSize: `${formulaData.items.length} Formulas`,
          createdDate: new Date().toISOString().split('T')[0]!,
          updatedDate: new Date().toISOString().split('T')[0]!,
          examId: db.getActiveExamId(),
          isFavorite: false,
          tags: ['AI-Generated', 'Formulas'],
          content: JSON.stringify(formulaData.items),
        });
      }

      safeDispatch(new CustomEvent('studyos_db_updated'));
      setSaveSuccessMsg('Successfully reviewed and saved content to StudyOS!');

      setTimeout(() => {
        setIsOpen(false);
      }, 1200);
    } catch (e) {
      console.error('Failed saving AI result:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <GlassCard className="w-full max-w-4xl bg-white border border-purple-100 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">
                  AI Content Review & Import
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 capitalize">
                  {payload.generationType}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                  {isBrowserProvider ? 'Browser Convenience' : 'Manual Import'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review, modify, and confirm content before saving it to your StudyOS database.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice for Browser Convenience */}
        {isBrowserProvider && showNotice && (
          <div className="mx-5 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Browser Convenience Instructions & One-Time Notice</span>
              </div>
              <button
                onClick={handleDismissNotice}
                className="text-amber-700 hover:text-amber-900 underline text-[11px]"
              >
                Got it (Don't show again)
              </button>
            </div>
            <p className="text-amber-800/90 leading-relaxed">
              Your prompt has been formatted and copied to your clipboard. Open your preferred AI assistant web chat below, paste the prompt, then copy its output back into the text box below. No automated scraping or secret key is required.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button
                onClick={handleCopyPrompt}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1.5 shadow-sm"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPrompt ? 'Copied Prompt!' : 'Copy Prompt'}
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Paste / Edit Raw AI Response */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-600" />
                Raw AI Response / Paste Input
              </label>
              <button
                onClick={handleReParse}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1"
              >
                Re-Parse Structured Preview
              </button>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
              }}
              placeholder="Paste generated response text or JSON here..."
              rows={4}
              className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Structured Live Preview & Editor */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              Structured Content Review
            </h4>

            {/* NOTES REVIEW */}
            {payload.generationType === 'notes' && notesData && (
              <div className="space-y-3 p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Note Title</label>
                  <input
                    type="text"
                    value={notesData.title}
                    onChange={(e) => setNotesData({ ...notesData, title: e.target.value })}
                    className="w-full mt-1 p-2 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Executive Summary</label>
                  <textarea
                    value={notesData.summary}
                    onChange={(e) => setNotesData({ ...notesData, summary: e.target.value })}
                    rows={2}
                    className="w-full mt-1 p-2 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600">Detailed Notes Content (Markdown)</label>
                  <textarea
                    value={notesData.detailedContent}
                    onChange={(e) => setNotesData({ ...notesData, detailedContent: e.target.value })}
                    rows={6}
                    className="w-full mt-1 p-2 text-xs font-mono bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* FLASHCARDS REVIEW */}
            {payload.generationType === 'flashcards' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {flashcardsData.length} Flashcard(s) Parsed
                  </span>
                  <button
                    onClick={() =>
                      setFlashcardsData([
                        ...flashcardsData,
                        { front: 'New Term', back: 'New Explanation', category: 'Flashcard' },
                      ])
                    }
                    className="px-2.5 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Card
                  </button>
                </div>

                {flashcardsData.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">
                    No flashcards parsed yet. Paste Q&A text above and click Re-Parse.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {flashcardsData.map((card, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-purple-700">Card #{idx + 1}</span>
                          <button
                            onClick={() => setFlashcardsData(flashcardsData.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 font-medium">Front (Question / Term)</label>
                            <input
                              type="text"
                              value={card.front}
                              onChange={(e) => {
                                const next = [...flashcardsData];
                                if (next[idx]) next[idx].front = e.target.value;
                                setFlashcardsData(next);
                              }}
                              className="w-full mt-0.5 p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-medium">Back (Answer / Explanation)</label>
                            <input
                              type="text"
                              value={card.back}
                              onChange={(e) => {
                                const next = [...flashcardsData];
                                if (next[idx]) next[idx].back = e.target.value;
                                setFlashcardsData(next);
                              }}
                              className="w-full mt-0.5 p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* QUIZ REVIEW */}
            {payload.generationType === 'quiz' && quizData && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={quizData.title}
                  onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                  className="w-full p-2 text-xs font-bold bg-white border border-slate-200 rounded-xl"
                  placeholder="Quiz Title"
                />
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {quizData.questions.map((q, qIdx) => (
                    <div key={q.id || qIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="font-bold text-slate-700">Question {qIdx + 1}</div>
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => {
                          const next = { ...quizData };
                          next.questions[qIdx].question = e.target.value;
                          setQuizData(next);
                        }}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                      />
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-1.5">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correctAnswerIndex === optIdx}
                              onChange={() => {
                                const next = { ...quizData };
                                next.questions[qIdx].correctAnswerIndex = optIdx;
                                setQuizData(next);
                              }}
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const next = { ...quizData };
                                next.questions[qIdx].options[optIdx] = e.target.value;
                                setQuizData(next);
                              }}
                              className="w-full p-1 bg-white border border-slate-200 rounded-md text-[11px]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUMMARY REVIEW */}
            {payload.generationType === 'summary' && (
              <textarea
                value={summaryData}
                onChange={(e) => setSummaryData(e.target.value)}
                rows={5}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            )}

            {/* MINDMAP REVIEW */}
            {payload.generationType === 'mindmap' && mindMapData && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <input
                  type="text"
                  value={mindMapData.root.label}
                  onChange={(e) =>
                    setMindMapData({
                      ...mindMapData,
                      root: { ...mindMapData.root, label: e.target.value },
                    })
                  }
                  className="w-full p-2 font-bold bg-white border border-slate-200 rounded-lg"
                />
                <div className="pl-4 border-l-2 border-purple-300 space-y-1.5 mt-2">
                  {(mindMapData.root.children || []).map((child, cIdx) => (
                    <div key={child.id || cIdx} className="flex items-center gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
                      <input
                        type="text"
                        value={child.label}
                        onChange={(e) => {
                          const next = { ...mindMapData };
                          if (next.root.children && next.root.children[cIdx]) {
                            next.root.children[cIdx].label = e.target.value;
                          }
                          setMindMapData(next);
                        }}
                        className="w-full p-1 bg-white border border-slate-200 rounded-md text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FORMULASHEET REVIEW */}
            {payload.generationType === 'formulasheet' && formulaData && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {formulaData.items.map((item, fIdx) => (
                  <div key={fIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const next = { ...formulaData };
                        next.items[fIdx].title = e.target.value;
                        setFormulaData(next);
                      }}
                      className="w-1/3 p-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                    />
                    <input
                      type="text"
                      value={item.formula}
                      onChange={(e) => {
                        const next = { ...formulaData };
                        next.items[fIdx].formula = e.target.value;
                        setFormulaData(next);
                      }}
                      className="w-2/3 p-1.5 bg-white border border-slate-200 rounded-lg font-mono text-purple-700 font-bold"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-semibold">
              <Check className="w-4 h-4 text-emerald-600" />
              {saveSuccessMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveToStudyOS}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-500/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            Save to StudyOS
          </button>
        </div>
      </GlassCard>
    </div>
  );
};
