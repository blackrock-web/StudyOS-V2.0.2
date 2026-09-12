import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Clock,
  Award,
  Layers,
  CheckCircle2,
  Sliders,
  Filter,
} from 'lucide-react';
import { QuestionMCQ, GeneratedTestSeries } from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { getAllSubjectOptions } from '../../data/subjectRegistry';

interface TestGeneratorModalProps {
  questions: QuestionMCQ[];
  onClose: () => void;
  onGenerated: (series: GeneratedTestSeries) => void;
  onShowNotification: (msg: string, title?: string) => void;
}

export const TestGeneratorModal: React.FC<TestGeneratorModalProps> = ({
  questions,
  onClose,
  onGenerated,
  onShowNotification,
}) => {
  const [title, setTitle] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [questionCount, setQuestionCount] = useState<number>(15);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [negativeMarking, setNegativeMarking] = useState<boolean>(true);

  // Quick preset handlers
  const handlePresetSelect = (preset: 'quick' | 'sectional' | 'subject' | 'mock') => {
    if (preset === 'quick') {
      setTitle('Quick 10-Question Sprint Quiz');
      setQuestionCount(10);
      setDurationMinutes(15);
      setSelectedDifficulty('All');
    } else if (preset === 'sectional') {
      setTitle('Sectional Speed Test');
      setQuestionCount(20);
      setDurationMinutes(30);
      setSelectedDifficulty('Medium');
    } else if (preset === 'subject') {
      setTitle(`${selectedSubject !== 'All Subjects' ? selectedSubject : 'Core'} Subject Test`);
      setQuestionCount(30);
      setDurationMinutes(60);
      setSelectedDifficulty('All');
    } else if (preset === 'mock') {
      setTitle('Full Length Grand Mock Test');
      setQuestionCount(65);
      setDurationMinutes(180);
      setSelectedSubject('All Subjects');
      setSelectedDifficulty('All');
    }
  };

  const handleGenerate = () => {
    // Filter matching pool
    let pool = questions.filter((q) => {
      const matchSub = selectedSubject === 'All Subjects' || q.subject === selectedSubject;
      const matchDiff = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;
      return matchSub && matchDiff;
    });

    // If pool is smaller than questionCount, expand with remaining questions
    if (pool.length < questionCount) {
      const remaining = questions.filter((q) => !pool.some((p) => p.id === q.id));
      pool = [...pool, ...remaining];
    }

    if (pool.length === 0) {
      onShowNotification('Question bank is empty. Please import or add questions first.', 'No Questions Available');
      return;
    }

    // Shuffle pool
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length));

    const totalMarks = selectedQuestions.reduce((acc, q) => acc + (q.marks || 1), 0);

    const newSeries: GeneratedTestSeries = {
      id: `series-${Date.now()}`,
      title: title.trim() || `${selectedSubject} Practice Test`,
      subject: selectedSubject,
      totalQuestions: selectedQuestions.length,
      durationMinutes,
      totalMarks,
      difficulty: selectedDifficulty,
      negativeMarking,
      questions: selectedQuestions,
      createdAt: new Date().toISOString(),
      completed: false,
    };

    onGenerated(newSeries);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <GlassCard className="max-w-xl w-full p-6 bg-white space-y-6 shadow-2xl rounded-3xl animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-purple-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white font-black shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Generate Custom Test Series</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Automatically curate customized tests from your local question bank.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase text-slate-400 block tracking-wider">Quick Format Presets</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handlePresetSelect('quick')}
              className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-900 text-xs font-bold text-center transition-all cursor-pointer"
            >
              <div className="font-black">10 Qs Sprint</div>
              <div className="text-[10px] text-purple-600 font-normal">15 Mins</div>
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('sectional')}
              className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-900 text-xs font-bold text-center transition-all cursor-pointer"
            >
              <div className="font-black">20 Qs Sectional</div>
              <div className="text-[10px] text-indigo-600 font-normal">30 Mins</div>
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('subject')}
              className="p-2.5 rounded-xl border border-pink-200 bg-pink-50/60 hover:bg-pink-100 text-pink-900 text-xs font-bold text-center transition-all cursor-pointer"
            >
              <div className="font-black">30 Qs Subject</div>
              <div className="text-[10px] text-pink-600 font-normal">60 Mins</div>
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect('mock')}
              className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-900 text-xs font-bold text-center transition-all cursor-pointer"
            >
              <div className="font-black">65 Qs Full Mock</div>
              <div className="text-[10px] text-emerald-600 font-normal">180 Mins</div>
            </button>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4 text-xs font-medium">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Test Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Algorithms Dynamic Programming & Graphs Mock"
              className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Target Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white font-bold text-slate-800"
              >
                <option value="All Subjects">All Subjects (Mixed Full Syllabus)</option>
                {getAllSubjectOptions().map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Difficulty Distribution</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white font-bold text-slate-800"
              >
                <option value="All">Balanced Mixed Difficulties</option>
                <option value="Easy">Easy (Foundation / Conceptual)</option>
                <option value="Medium">Medium (Standard GATE Level)</option>
                <option value="Hard">Hard (Advanced / Multi-Concept)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Number of Questions</label>
              <input
                type="number"
                min={5}
                max={100}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 10))}
                className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white font-mono font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Time Limit (Minutes)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 30))}
                className="w-full p-2.5 rounded-xl border border-[#E7E0F8] bg-white font-mono font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/50 border border-purple-100">
            <div>
              <div className="font-bold text-slate-900 text-xs">Standard Negative Marking</div>
              <div className="text-[10px] text-slate-500 font-medium">Deduct 1/3 marks for 1-mark and 2/3 for 2-mark incorrect MCQs</div>
            </div>
            <input
              type="checkbox"
              checked={negativeMarking}
              onChange={(e) => setNegativeMarking(e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-purple-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-xs font-black shadow-md shadow-purple-500/20 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate & Save Test</span>
          </button>
        </div>
      </GlassCard>
    </div>
  );
};
