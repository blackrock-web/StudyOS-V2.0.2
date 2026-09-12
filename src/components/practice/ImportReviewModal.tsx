import React, { useState } from 'react';
import {
  Check,
  X,
  AlertCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { QuestionMCQ } from '../../types';
import { GlassCard } from '../shared/GlassCard';

interface ImportReviewModalProps {
  stagedQuestions: QuestionMCQ[];
  onConfirm: (approved: QuestionMCQ[]) => void;
  onCancel: () => void;
}

export const ImportReviewModal: React.FC<ImportReviewModalProps> = ({
  stagedQuestions,
  onConfirm,
  onCancel,
}) => {
  const [questions, setQuestions] = useState<QuestionMCQ[]>(stagedQuestions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(stagedQuestions.map((q) => q.id))
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const handleDelete = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleUpdateField = (id: string, field: keyof QuestionMCQ | string, val: any) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        if (field === 'question' || field === 'questionText') {
          return { ...q, question: val, questionText: val };
        }
        return { ...q, [field]: val };
      })
    );
  };

  const handleApproveSelected = () => {
    const approved = questions.filter((q) => selectedIds.has(q.id));
    onConfirm(approved);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <GlassCard className="max-w-4xl w-full max-h-[90vh] bg-white p-6 rounded-3xl shadow-2xl flex flex-col space-y-4 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Review & Validate Extracted Questions</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Review questions parsed from your JSON/PDF source. Edit text, verify correct answer keys, and select questions to store in the question bank.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/60 border border-purple-100 text-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-purple-700 font-bold hover:bg-purple-50 cursor-pointer"
            >
              {selectedIds.size === questions.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="font-extrabold text-slate-700">
              {selectedIds.size} of {questions.length} questions selected for approval
            </span>
          </div>
        </div>

        {/* Scrollable Questions Review List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          {questions.map((q, idx) => {
            const isSelected = selectedIds.has(q.id);
            const isEditing = editingId === q.id;

            return (
              <div
                key={q.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isSelected ? 'bg-white border-purple-200 shadow-xs' : 'bg-slate-50 opacity-60 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(q.id)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-black text-purple-700 font-mono bg-purple-100 px-2 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{q.subject}</span>
                    {q.topic && <span className="text-xs text-slate-500">• {q.topic}</span>}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingId(isEditing ? null : q.id)}
                      className="text-xs text-purple-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditing ? 'Done Editing' : 'Edit'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                {isEditing ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Question Text</label>
                      <textarea
                        rows={2}
                        value={q.questionText || q.question || ''}
                        onChange={(e) => handleUpdateField(q.id, 'question', e.target.value)}
                        className="w-full p-2 border rounded-xl font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx}>
                          <label className="block text-slate-600 font-bold mb-0.5">
                            Option {String.fromCharCode(65 + oIdx)}
                          </label>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const nextOpts = [...q.options];
                              nextOpts[oIdx] = e.target.value;
                              handleUpdateField(q.id, 'options', nextOpts);
                            }}
                            className="w-full p-1.5 border rounded-xl text-xs font-medium"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Correct Answer</label>
                        <select
                          value={q.correctAnswer}
                          onChange={(e) => handleUpdateField(q.id, 'correctAnswer', e.target.value)}
                          className="w-full p-1.5 border rounded-xl font-bold bg-white text-xs"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Difficulty</label>
                        <select
                          value={q.difficulty}
                          onChange={(e) => handleUpdateField(q.id, 'difficulty', e.target.value)}
                          className="w-full p-1.5 border rounded-xl font-bold bg-white text-xs"
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Marks</label>
                        <input
                          type="number"
                          value={q.marks || 1}
                          onChange={(e) => handleUpdateField(q.id, 'marks', parseInt(e.target.value) || 1)}
                          className="w-full p-1.5 border rounded-xl font-bold font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Explanation</label>
                      <textarea
                        rows={2}
                        value={q.explanation || ''}
                        onChange={(e) => handleUpdateField(q.id, 'explanation', e.target.value)}
                        className="w-full p-2 border rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <p className="font-bold text-slate-900 leading-relaxed">{q.questionText || q.question}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const optLabel = String.fromCharCode(65 + oIdx);
                        const isCorrect = q.correctAnswer === optLabel || q.correctAnswer === opt;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-xl border flex items-center gap-2 ${
                              isCorrect ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900' : 'bg-slate-50/50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {optLabel}
                            </span>
                            <span className="text-[11px] truncate">{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <p className="text-[11px] text-slate-500 pt-1 italic">
                        <span className="font-bold not-italic text-purple-700">Exp:</span> {q.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-purple-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            Cancel Import
          </button>
          <button
            onClick={handleApproveSelected}
            disabled={selectedIds.size === 0}
            className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-purple-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Approve & Ingest {selectedIds.size} Questions</span>
          </button>
        </div>
      </GlassCard>
    </div>
  );
};
