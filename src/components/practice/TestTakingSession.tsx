import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Flag,
  RotateCcw,
  Sparkles,
  Award,
  X,
  Check,
} from 'lucide-react';
import { QuestionMCQ } from '../../types';
import { GlassCard } from '../shared/GlassCard';

interface TestTakingSessionProps {
  test: {
    id: string;
    title: string;
    durationMinutes: number;
    negativeMarking: boolean;
    questions: QuestionMCQ[];
  };
  onCancel: () => void;
  onFinish: (result: {
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
  }) => void;
  onShowNotification: (msg: string, title?: string) => void;
}

export const TestTakingSession: React.FC<TestTakingSessionProps> = ({
  test,
  onCancel,
  onFinish,
  onShowNotification,
}) => {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(
    () => new Set([test.questions[0]?.id || ''])
  );
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Timer state
  const totalSeconds = (test.durationMinutes || 30) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTestAuto();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const currentQ = test.questions[currentQIndex];

  const handleSelectOption = (optLabel: string) => {
    if (!currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optLabel,
    }));
  };

  const handleClearResponse = () => {
    if (!currentQ) return;
    setUserAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQ.id];
      return next;
    });
  };

  const handleToggleReview = () => {
    if (!currentQ) return;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) next.delete(currentQ.id);
      else next.add(currentQ.id);
      return next;
    });
  };

  const handleJumpToQuestion = (idx: number) => {
    if (idx < 0 || idx >= test.questions.length) return;
    setCurrentQIndex(idx);
    const targetQ = test.questions[idx];
    if (targetQ) {
      setVisitedQuestions((prev) => new Set(prev).add(targetQ.id));
    }
  };

  // Calculations for submit
  const calculateResult = () => {
    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    test.questions.forEach((q) => {
      const qMarks = q.marks || 1;
      totalMarks += qMarks;
      const userAns = userAnswers[q.id];

      if (!userAns) {
        unansweredCount++;
      } else {
        const isCorrect =
          userAns.toUpperCase() === q.correctAnswer?.toUpperCase() ||
          userAns.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();

        if (isCorrect) {
          correctCount++;
          score += qMarks;
        } else {
          incorrectCount++;
          if (test.negativeMarking) {
            score -= qMarks === 1 ? 0.33 : 0.66;
          }
        }
      }
    });

    const finalScore = Math.max(0, Math.round(score * 100) / 100);
    const accuracy =
      correctCount + incorrectCount > 0
        ? Math.round((correctCount / (correctCount + incorrectCount)) * 100)
        : 0;

    const timeSpentSeconds = totalSeconds - secondsRemaining;

    return {
      testId: test.id,
      testTitle: test.title,
      questions: test.questions,
      userAnswers,
      durationMinutes: test.durationMinutes,
      timeSpentSeconds,
      score: finalScore,
      totalMarks,
      correctCount,
      incorrectCount,
      unansweredCount,
      accuracy,
    };
  };

  const handleSubmitTestAuto = () => {
    onShowNotification('Time is up! Submitting your test automatically...', 'Time Expired');
    const res = calculateResult();
    onFinish(res);
  };

  const handleConfirmSubmit = () => {
    setShowSubmitModal(false);
    const res = calculateResult();
    onFinish(res);
  };

  // Format time MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLowTime = secondsRemaining < 300; // less than 5 mins

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Test Header */}
      <GlassCard className="p-4 bg-white flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700 font-bold">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-tight">{test.title}</h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold mt-0.5">
              <span>{test.questions.length} Questions</span>
              <span>•</span>
              <span>{test.negativeMarking ? 'Standard Negative Marking (-0.33 / -0.66)' : 'No Negative Marking'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Live Countdown Clock */}
          <div className={`px-3.5 py-1.5 rounded-2xl border font-mono font-black text-sm flex items-center gap-2 ${
            isLowTime ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse' : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}>
            <Clock className="w-4 h-4" />
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            Submit Test
          </button>

          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Exit Test"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </GlassCard>

      {/* Main Examination View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left 3 cols: Active Question Canvas */}
        <div className="lg:col-span-3 space-y-4">
          {currentQ ? (
            <GlassCard className="p-6 bg-white space-y-6 shadow-sm min-h-[480px] flex flex-col justify-between">
              <div className="space-y-4">
                {/* Question Info Bar */}
                <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-black font-mono">
                      Question {currentQIndex + 1} of {test.questions.length}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-100">
                      {currentQ.subject}
                    </span>
                    {currentQ.topic && (
                      <span className="text-xs font-bold text-slate-500">• {currentQ.topic}</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-mono font-bold text-slate-600">
                      Marks: <strong className="text-slate-900">+{currentQ.marks || 1}</strong>
                      {test.negativeMarking && (
                        <span className="text-rose-600 ml-1">
                          (-{ (currentQ.marks || 1) === 1 ? '0.33' : '0.66' })
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Question Text */}
                <div className="text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap py-2">
                  {currentQ.questionText || currentQ.question}
                </div>

                {/* Options List */}
                <div className="space-y-2.5 pt-2">
                  {currentQ.options && currentQ.options.length > 0 ? (
                    currentQ.options.map((opt, oIdx) => {
                      const optLabel = String.fromCharCode(65 + oIdx);
                      const isSelected = userAnswers[currentQ.id] === optLabel || userAnswers[currentQ.id] === opt;

                      return (
                        <div
                          key={oIdx}
                          onClick={() => handleSelectOption(optLabel)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                            isSelected
                              ? 'bg-purple-50 border-purple-400 text-purple-950 font-black shadow-xs ring-2 ring-purple-300/60'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-semibold'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {optLabel}
                          </div>
                          <span className="text-xs flex-1">{opt}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Enter Numerical Value (NAT)</label>
                      <input
                        type="text"
                        value={userAnswers[currentQ.id] || ''}
                        onChange={(e) => handleSelectOption(e.target.value)}
                        placeholder="Type numerical answer..."
                        className="w-48 p-2.5 rounded-xl border border-purple-300 font-mono font-bold text-sm bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Nav Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleToggleReview}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      markedForReview.has(currentQ.id)
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{markedForReview.has(currentQ.id) ? 'Marked for Review' : 'Mark for Review'}</span>
                  </button>

                  {userAnswers[currentQ.id] && (
                    <button
                      onClick={handleClearResponse}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 cursor-pointer"
                    >
                      Clear Response
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleJumpToQuestion(currentQIndex - 1)}
                    disabled={currentQIndex === 0}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  {currentQIndex < test.questions.length - 1 ? (
                    <button
                      onClick={() => handleJumpToQuestion(currentQIndex + 1)}
                      className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Save & Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSubmitModal(true)}
                      className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Final Submit</span>
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          ) : (
            <div className="p-8 text-center bg-white rounded-3xl">No question selected</div>
          )}
        </div>

        {/* Right 1 col: Question Status Palette */}
        <div className="space-y-4">
          <GlassCard className="p-4 bg-white space-y-4">
            <h4 className="text-xs font-black text-slate-900 border-b border-purple-100 pb-2 uppercase tracking-wider">
              Question Palette
            </h4>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block shrink-0" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shrink-0" />
                <span>Review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-600 inline-block shrink-0" />
                <span>Current</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-200 inline-block shrink-0" />
                <span>Unvisited</span>
              </div>
            </div>

            {/* Question Number Buttons Grid */}
            <div className="grid grid-cols-5 gap-2 pt-2">
              {test.questions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.id];
                const isReview = markedForReview.has(q.id);
                const isCurrent = idx === currentQIndex;
                const isVisited = visitedQuestions.has(q.id);

                let btnStyle = 'bg-slate-100 text-slate-600 border-slate-200';
                if (isCurrent) {
                  btnStyle = 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-300';
                } else if (isReview) {
                  btnStyle = 'bg-amber-500 text-white border-amber-600';
                } else if (isAnswered) {
                  btnStyle = 'bg-emerald-600 text-white border-emerald-700';
                } else if (isVisited) {
                  btnStyle = 'bg-slate-200 text-slate-800 border-slate-300';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`h-9 rounded-xl text-xs font-mono font-black border transition-all cursor-pointer ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Quick stats summary */}
            <div className="pt-3 border-t border-slate-100 text-[11px] space-y-1 font-bold text-slate-600">
              <div className="flex justify-between">
                <span>Total Answered:</span>
                <span className="text-emerald-700 font-mono font-black">{Object.keys(userAnswers).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Marked for Review:</span>
                <span className="text-amber-700 font-mono font-black">{markedForReview.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Unanswered:</span>
                <span className="text-slate-500 font-mono font-black">{test.questions.length - Object.keys(userAnswers).length}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full bg-white p-6 rounded-3xl shadow-2xl space-y-5 animate-scaleUp">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">Confirm Test Submission</h3>
              <p className="text-xs text-slate-500">
                Are you ready to submit your test? Here is your current attempt summary:
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2 font-bold">
              <div className="flex justify-between text-slate-700">
                <span>Total Questions:</span>
                <span className="font-mono">{test.questions.length}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Answered Questions:</span>
                <span className="font-mono">{Object.keys(userAnswers).length}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Marked for Review:</span>
                <span className="font-mono">{markedForReview.size}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>Unanswered / Left Blank:</span>
                <span className="font-mono">{test.questions.length - Object.keys(userAnswers).length}</span>
              </div>
              <div className="flex justify-between text-purple-700 pt-2 border-t border-slate-200">
                <span>Time Remaining:</span>
                <span className="font-mono">{formatTime(secondsRemaining)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Resume Test
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                Confirm & Submit
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
