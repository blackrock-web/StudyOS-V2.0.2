import React, { useState } from 'react';
import {
  Upload,
  FileCode2,
  FileText,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Download,
} from 'lucide-react';
import { QuestionMCQ } from '../../types';
import { db } from '../../services/db';
import { GlassCard } from '../shared/GlassCard';
import { ImportReviewModal } from './ImportReviewModal';
import { getAllSubjectOptions } from '../../data/subjectRegistry';

interface QuestionImportWorkspaceProps {
  onQuestionsImported: (questions: QuestionMCQ[]) => void;
  onShowNotification: (msg: string, title?: string) => void;
}

const SAMPLE_JSON_TEMPLATE = `[
  {
    "question": "What is the time complexity of building a heap from an unsorted array of n elements using the bottom-up Heapify approach?",
    "options": [
      "O(n log n)",
      "O(n)",
      "O(log n)",
      "O(n^2)"
    ],
    "correctAnswer": "B",
    "explanation": "Building a heap using bottom-up heapify runs in linear time O(n) because sum of (h * n / 2^(h+1)) asymptotically converges to O(n).",
    "subject": "Algorithms",
    "topic": "Heaps and Priority Queues",
    "difficulty": "Medium",
    "marks": 2,
    "year": "2024"
  },
  {
    "question": "Which of the following scheduling algorithms can cause starvation (indefinite blocking)?",
    "options": [
      "First Come First Served (FCFS)",
      "Round Robin (RR)",
      "Shortest Job First (SJF / SRTF)",
      "Both FCFS and Round Robin"
    ],
    "correctAnswer": "C",
    "explanation": "Shortest Job First / Shortest Remaining Time First prioritizes short bursts, causing long CPU-burst processes to starve if short jobs continuously arrive.",
    "subject": "Operating Systems",
    "topic": "CPU Scheduling",
    "difficulty": "Easy",
    "marks": 1,
    "year": "2023"
  }
]`;

export const QuestionImportWorkspace: React.FC<QuestionImportWorkspaceProps> = ({
  onQuestionsImported,
  onShowNotification,
}) => {
  const [mode, setMode] = useState<'json' | 'text'>('json');
  const [jsonInput, setJsonInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>(() => {
    const subs = db.getCurrentExamSubjects();
    return subs.length > 0 ? subs : ['General Studies'];
  });
  const [defaultSubject, setDefaultSubject] = useState<string>(() => {
    const subs = db.getCurrentExamSubjects();
    return subs[0] || 'General Studies';
  });
  const [defaultDifficulty, setDefaultDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [defaultMarks, setDefaultMarks] = useState(1);

  React.useEffect(() => {
    const refreshSubjects = () => {
      const subs = db.getCurrentExamSubjects();
      const finalSubs = subs.length > 0 ? subs : ['General Studies'];
      setAvailableSubjects(finalSubs);
      if (!subs.includes(defaultSubject)) {
        setDefaultSubject(finalSubs[0] || 'General Studies');
      }
    };
    window.addEventListener('studyos_active_exam_changed', refreshSubjects);
    window.addEventListener('studyos_exams_updated', refreshSubjects);
    window.addEventListener('studyos_syllabus_updated', refreshSubjects);
    return () => {
      window.removeEventListener('studyos_active_exam_changed', refreshSubjects);
      window.removeEventListener('studyos_exams_updated', refreshSubjects);
      window.removeEventListener('studyos_syllabus_updated', refreshSubjects);
    };
  }, [defaultSubject]);

  // Staged questions for review modal
  const [stagedQuestions, setStagedQuestions] = useState<QuestionMCQ[] | null>(null);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (file.name.endsWith('.json')) {
        setMode('json');
        setJsonInput(content);
        onShowNotification(`Loaded JSON file: ${file.name}`, 'File Read');
      } else {
        setMode('text');
        setTextInput(content);
        onShowNotification(`Loaded text file: ${file.name}`, 'File Read');
      }
    };
    reader.readAsText(file);
  };

  // Heuristic PDF/Text parser
  const parseRawTextQuestions = (raw: string): QuestionMCQ[] => {
    const parsed: QuestionMCQ[] = [];
    // Split by Question patterns like "Q1.", "Q 1.", "1.", "Question 1:"
    const blocks = raw.split(/(?:^|\n)(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\)])\s*/i).filter((b) => b.trim().length > 10);

    blocks.forEach((block, idx) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      let questionText = '';
      const options: string[] = [];
      let correctAnswer = 'A';
      let explanation = '';

      let inOptions = false;
      let inExplanation = false;

      lines.forEach((line) => {
        // Check for Ans / Answer
        const ansMatch = line.match(/(?:Ans(?:wer)?|Correct\s*Option)\s*[\:\-\=]\s*([A-D])/i);
        if (ansMatch && ansMatch[1]) {
          correctAnswer = ansMatch[1].toUpperCase();
          return;
        }

        // Check for Explanation / Solution
        if (/^(?:Exp(?:lanation)?|Solution|Reason)\s*[\:\-]/i.test(line)) {
          inExplanation = true;
          explanation = line.replace(/^(?:Exp(?:lanation)?|Solution|Reason)\s*[\:\-]\s*/i, '');
          return;
        }

        if (inExplanation) {
          explanation += ' ' + line;
          return;
        }

        // Check for Option pattern (A), (B), A., B), etc.
        const optMatch = line.match(/^[\(\[]?([A-D])[\)\]\.\:]\s*(.+)$/i);
        if (optMatch && optMatch[2]) {
          inOptions = true;
          options.push(optMatch[2].trim());
          return;
        }

        if (!inOptions) {
          questionText += (questionText ? ' ' : '') + line;
        }
      });

      // Ensure minimum 4 options fallback if none parsed cleanly
      const finalOpts = options.length >= 2 ? options : ['Option A', 'Option B', 'Option C', 'Option D'];

      if (questionText.trim()) {
        parsed.push({
          id: `imp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          question: questionText.trim(),
          questionText: questionText.trim(),
          options: finalOpts,
          correctAnswer,
          explanation: explanation.trim() || undefined,
          subject: defaultSubject,
          difficulty: defaultDifficulty,
          marks: defaultMarks,
          type: 'MCQ',
        });
      }
    });

    return parsed;
  };

  // Submit and stage handler
  const handleStageAndReview = () => {
    try {
      if (mode === 'json') {
        if (!jsonInput.trim()) {
          onShowNotification('Please enter or paste valid JSON data.', 'Input Empty');
          return;
        }
        const data = JSON.parse(jsonInput);
        const arr = Array.isArray(data) ? data : [data];

        const mapped: QuestionMCQ[] = arr.map((item: any, idx: number) => {
          const qText = item.question || item.questionText || item.title || 'Untitled Question';
          return {
            id: item.id || `imp-json-${Date.now()}-${idx}`,
            question: qText,
            questionText: qText,
            options: Array.isArray(item.options) ? item.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: item.correctAnswer || item.answer || 'A',
            explanation: item.explanation || item.solution || '',
            subject: item.subject || defaultSubject,
            topic: item.topic || undefined,
            difficulty: item.difficulty || defaultDifficulty,
            marks: item.marks || defaultMarks,
            year: item.year || undefined,
            type: item.type || 'MCQ',
          };
        });

        if (mapped.length === 0) {
          onShowNotification('No valid questions found in JSON.', 'Validation Warning');
          return;
        }

        setStagedQuestions(mapped);
      } else {
        if (!textInput.trim()) {
          onShowNotification('Please paste question text or OCR text from PDF.', 'Input Empty');
          return;
        }
        const parsed = parseRawTextQuestions(textInput);
        if (parsed.length === 0) {
          onShowNotification('Could not detect question patterns. Please verify format (e.g. Q1. ... (A) ... Ans: B).', 'Parsing Failed');
          return;
        }
        setStagedQuestions(parsed);
      }
    } catch (err: any) {
      onShowNotification(`Error parsing data: ${err.message || 'Invalid JSON syntax'}`, 'Syntax Error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Introduction Card */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black shadow-md">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                JSON & PDF Question Ingestion Engine
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Seamlessly import batch test series, standard PYQ question collections, or OCR snippets into your local offline database.
              </p>
            </div>
          </div>

          <label className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs">
            <Upload className="w-4 h-4" />
            <span>Upload File (.json / .txt)</span>
            <input type="file" accept=".json,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Source Mode Toggle */}
        <div className="flex items-center gap-2 border-b border-purple-100/80 pt-2">
          <button
            onClick={() => setMode('json')}
            className={`px-4 py-2 border-b-2 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === 'json' ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Structured JSON Ingestion</span>
          </button>
          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 border-b-2 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === 'text' ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>PDF / Text OCR Parser</span>
          </button>
        </div>
      </GlassCard>

      {/* Main Workspace Card */}
      <GlassCard className="p-6 space-y-6">
        {/* Defaults configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Default Fallback Subject</label>
            <select
              value={defaultSubject}
              onChange={(e) => setDefaultSubject(e.target.value)}
              className="w-full p-2 rounded-xl border border-[#E7E0F8] bg-white font-bold text-slate-800"
            >
              {availableSubjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Default Difficulty</label>
            <select
              value={defaultDifficulty}
              onChange={(e) => setDefaultDifficulty(e.target.value as any)}
              className="w-full p-2 rounded-xl border border-[#E7E0F8] bg-white font-bold text-slate-800"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Default Marks</label>
            <input
              type="number"
              min={1}
              max={5}
              value={defaultMarks}
              onChange={(e) => setDefaultMarks(parseInt(e.target.value) || 1)}
              className="w-full p-2 rounded-xl border border-[#E7E0F8] bg-white font-mono font-bold text-slate-800"
            />
          </div>
        </div>

        {/* JSON Mode Form */}
        {mode === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4 text-purple-600" />
                <span>Paste Question Array JSON</span>
              </label>
              <button
                onClick={() => {
                  setJsonInput(SAMPLE_JSON_TEMPLATE);
                  onShowNotification('Loaded sample GATE question JSON template', 'Template Loaded');
                }}
                className="text-xs text-purple-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Load Sample GATE Template
              </button>
            </div>

            <textarea
              rows={12}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Paste JSON array here..."
              className="w-full p-4 rounded-2xl border border-purple-200 bg-slate-900 text-purple-200 font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        )}

        {/* Text / PDF OCR Mode Form */}
        {mode === 'text' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Paste Text / PDF Content</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Supports "Q1. ... (A) ... (B) ... (C) ... (D) ... Ans: B ... Exp: ..."
              </span>
            </div>

            <textarea
              rows={12}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste text from PDF or question paper here... Example:&#10;Q1. What is the time complexity of QuickSort average case?&#10;A) O(n)&#10;B) O(n log n)&#10;C) O(n^2)&#10;D) O(log n)&#10;Ans: B&#10;Exp: Average case partitioning recurrence T(n) = 2T(n/2) + O(n) resolves to O(n log n)."
              className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => {
              setJsonInput('');
              setTextInput('');
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Clear Editor
          </button>
          <button
            onClick={handleStageAndReview}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black shadow-md shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Stage & Review Questions</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </GlassCard>

      {/* Review Modal Staged */}
      {stagedQuestions && (
        <ImportReviewModal
          stagedQuestions={stagedQuestions}
          onCancel={() => setStagedQuestions(null)}
          onConfirm={(approved) => {
            setStagedQuestions(null);
            onQuestionsImported(approved);
          }}
        />
      )}
    </div>
  );
};
