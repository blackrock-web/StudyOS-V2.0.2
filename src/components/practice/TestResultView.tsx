import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  XCircle,
  HelpCircle,
  Bookmark,
  Check,
  X,
  ChevronRight,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';
import { QuestionMCQ } from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { db } from '../../services/db';

interface TestResultViewProps {
  result: {
    testId: string;
    testTitle: string;
    questions: QuestionMCQ[];
    userAnswers: Record<string, string>;
    durationMinutes: number;
    timeSpentSeconds: number;
    score: number;
    totalMarks: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    accuracy: number;
  };
  onBackToHub: () => void;
  onRetakeTest: () => void;
  onShowNotification: (msg: string, title?: string) => void;
}

export const TestResultView: React.FC<TestResultViewProps> = ({
  result,
  onBackToHub,
  onRetakeTest,
  onShowNotification,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'correct' | 'unanswered'>('all');
  const [loggedMistakes, setLoggedMistakes] = useState<Set<string>>(new Set());

  // Subject-wise performance grouping
  const subjectBreakdown = React.useMemo(() => {
    const map: Record<string, { total: number; correct: number; marks: number; scored: number }> = {};

    result.questions.forEach((q) => {
      const sub = q.subject || 'General';
      if (!map[sub]) {
        map[sub] = { total: 0, correct: 0, marks: 0, scored: 0 };
      }
      const qMarks = q.marks || 1;
      map[sub].total++;
      map[sub].marks += qMarks;

      const userAns = result.userAnswers[q.id];
      if (userAns && (userAns.toUpperCase() === q.correctAnswer?.toUpperCase() || userAns.trim() === q.correctAnswer?.trim())) {
        map[sub].correct++;
        map[sub].scored += qMarks;
      }
    });

    return map;
  }, [result]);

  const handleLogToMistakeNotebook = (q: QuestionMCQ, userAns: string) => {
    const qText = q.questionText || q.question || 'Practice Question';
    db.addMistake({
      id: `mistake-${Date.now()}-${q.id}`,
      question: qText,
      questionTitle: qText,
      subject: q.subject,
      topic: q.topic || 'General',
      userChoice: userAns || 'Left Blank',
      wrongAnswerGiven: userAns || 'Left Blank',
      correctChoice: q.correctAnswer || 'A',
      correctAnswer: q.correctAnswer || 'A',
      reason: q.explanation || 'Reviewed conceptual flaw during test analysis.',
      errorReason: 'Conceptual Error',
      solutionExplanation: q.explanation || '',
      date: new Date().toISOString().split('T')[0] || '',
      dateAdded: new Date().toISOString().split('T')[0] || '',
      status: 'Unresolved',
      revisionCount: 0,
      goldenRule: 'Review underlying theorem and formula application before re-attempt.',
    });

    setLoggedMistakes((prev) => new Set(prev).add(q.id));
    onShowNotification(`Logged Q into Mistake Notebook for ${q.subject}`, 'Mistake Saved');
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const filteredQuestions = result.questions.filter((q) => {
    const userAns = result.userAnswers[q.id];
    const isCorrect = userAns && (userAns.toUpperCase() === q.correctAnswer?.toUpperCase() || userAns.trim() === q.correctAnswer?.trim());

    if (filterMode === 'correct') return isCorrect;
    if (filterMode === 'incorrect') return userAns && !isCorrect;
    if (filterMode === 'unanswered') return !userAns;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <GlassCard className="p-6 space-y-4 bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 border border-purple-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToHub}
              className="p-2 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 transition-all cursor-pointer"
              title="Back to Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Attempt Completed
                </span>
                <span className="text-xs text-slate-500 font-medium">Time Taken: {formatTime(result.timeSpentSeconds)}</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">{result.testTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRetakeTest}
              className="px-4 py-2 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake Test</span>
            </button>
            <button
              onClick={onBackToHub}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              Done & Return
            </button>
          </div>
        </div>

        {/* Big Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
            <div className="text-[10px] font-extrabold uppercase text-slate-400">Total Score</div>
            <div className="text-2xl font-black font-mono text-purple-700 mt-1">
              {result.score} <span className="text-sm font-bold text-slate-400">/ {result.totalMarks}</span>
            </div>
            <div className="text-[10px] font-bold text-purple-600 mt-0.5">
              {Math.round((result.score / Math.max(1, result.totalMarks)) * 100)}% Marks Scored
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-xs">
            <div className="text-[10px] font-extrabold uppercase text-slate-400">Accuracy</div>
            <div className="text-2xl font-black font-mono text-emerald-600 mt-1">{result.accuracy}%</div>
            <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
              {result.correctCount} Correct / {result.correctCount + result.incorrectCount} Attempted
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-rose-100 shadow-xs">
            <div className="text-[10px] font-extrabold uppercase text-slate-400">Incorrect MCQs</div>
            <div className="text-2xl font-black font-mono text-rose-600 mt-1">{result.incorrectCount}</div>
            <div className="text-[10px] font-bold text-rose-600 mt-0.5">Negative marks applied</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs">
            <div className="text-[10px] font-extrabold uppercase text-slate-400">Unanswered</div>
            <div className="text-2xl font-black font-mono text-slate-600 mt-1">{result.unansweredCount}</div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">Left blank</div>
          </div>
        </div>
      </GlassCard>

      {/* Subject-Wise Performance Radar */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-600" />
          <span>Subject-Wise Performance Breakdown</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(subjectBreakdown).map(([sub, data]) => {
            const pct = Math.round((data.correct / Math.max(1, data.total)) * 100);
            return (
              <div key={sub} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900">{sub}</span>
                  <span className="font-mono font-bold text-purple-700">{data.correct}/{data.total} Correct ({pct}%)</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Detailed Solutions Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-600" />
            <span>Question-by-Question Solution Analysis</span>
          </h3>

          {/* Solution Filters */}
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterMode === 'all' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              All ({result.questions.length})
            </button>
            <button
              onClick={() => setFilterMode('incorrect')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterMode === 'incorrect' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200'
              }`}
            >
              Incorrect ({result.incorrectCount})
            </button>
            <button
              onClick={() => setFilterMode('correct')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterMode === 'correct' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-200'
              }`}
            >
              Correct ({result.correctCount})
            </button>
            <button
              onClick={() => setFilterMode('unanswered')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterMode === 'unanswered' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Unanswered ({result.unansweredCount})
            </button>
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => {
            const userAns = result.userAnswers[q.id];
            const isCorrect = userAns && (userAns.toUpperCase() === q.correctAnswer?.toUpperCase() || userAns.trim() === q.correctAnswer?.trim());
            const isLogged = loggedMistakes.has(q.id);

            return (
              <GlassCard
                key={q.id}
                className={`p-5 space-y-4 border-l-4 ${
                  !userAns
                    ? 'border-l-slate-400'
                    : isCorrect
                    ? 'border-l-emerald-500'
                    : 'border-l-rose-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md font-mono">
                      Q{idx + 1}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {q.subject}
                    </span>
                    {q.topic && <span className="text-[10px] font-bold text-slate-500">• {q.topic}</span>}
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      !userAns
                        ? 'bg-slate-100 text-slate-600'
                        : isCorrect
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {!userAns ? 'Left Blank' : isCorrect ? 'Correct (+1)' : 'Incorrect (-0.33)'}
                    </span>
                  </div>

                  {!isCorrect && (
                    <button
                      onClick={() => handleLogToMistakeNotebook(q, userAns || '')}
                      disabled={isLogged}
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isLogged
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isLogged ? 'Saved to Mistakes' : 'Log to Mistake Book'}</span>
                    </button>
                  )}
                </div>

                {/* Question */}
                <div className="text-xs font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {q.questionText || q.question}
                </div>

                {/* Options Review */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => {
                      const optLabel = String.fromCharCode(65 + oIdx);
                      const isCorrectChoice = q.correctAnswer === optLabel || q.correctAnswer === opt;
                      const isUserChoice = userAns === optLabel || userAns === opt;

                      let style = 'bg-slate-50 border-slate-200 text-slate-700';
                      if (isCorrectChoice) {
                        style = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold';
                      } else if (isUserChoice && !isCorrectChoice) {
                        style = 'bg-rose-50 border-rose-400 text-rose-950 font-bold';
                      }

                      return (
                        <div key={oIdx} className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${style}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-black font-mono">{optLabel}.</span>
                            <span>{opt}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {isUserChoice && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-white/80 border">
                                Your Pick
                              </span>
                            )}
                            {isCorrectChoice && (
                              <Check className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 text-xs space-y-1">
                    <span className="font-extrabold uppercase text-[10px] text-purple-700 block">
                      Detailed Solution & Concept:
                    </span>
                    <p className="text-[11px] font-medium text-slate-800 leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};
