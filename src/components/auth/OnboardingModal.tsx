import React, { useState } from 'react';
import { Sparkles, BookOpen, Layers, CheckCircle2, Calendar, Target, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/auth';
import { db } from '../../services/db';

interface OnboardingModalProps {
  onComplete: () => void;
  onShowNotification: (msg: string, title?: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, onShowNotification }) => {
  const currentUser = authService.getCurrentUser();
  const [fullName, setFullName] = useState<string>(currentUser.fullName || '');
  const [examType, setExamType] = useState<'GATE' | 'CUSTOM'>('GATE');
  const [customExamName, setCustomExamName] = useState<string>('Custom Exam Preparation');
  const [targetDate, setTargetDate] = useState<string>('2027-02-07');
  const [dailyHours, setDailyHours] = useState<number>(6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      onShowNotification('Please enter your name', 'Onboarding');
      return;
    }

    const finalTarget = examType === 'GATE' ? 'GATE 2027 CS & DA' : customExamName.trim() || 'Custom Exam';

    // Update user profile
    authService.updateUserProfile({
      fullName: fullName.trim(),
      studyTarget: finalTarget,
      targetExamType: examType,
      targetExamDate: targetDate,
      dailyGoalHours: dailyHours,
      isOnboarded: true,
      streakDays: 0,
    });

    // Initialize workspace
    db.initializeExamWorkspace(examType, targetDate, dailyHours);

    onShowNotification(`Workspace initialized for ${finalTarget}!`, 'AManager Onboarding');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto select-none">
      <div className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl border border-purple-200/80 my-8 text-slate-800">
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-black border border-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Welcome to AManager
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configure Your Workspace</h2>
          <p className="text-xs font-medium text-slate-500 max-w-md mx-auto">
            100% offline personal exam management app. Select your target exam to initialize your workspace with 0% initial progress.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Full Name */}
          <div>
            <label className="text-xs font-black text-slate-700 block mb-1.5 uppercase tracking-wide">
              Your Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Smith"
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          {/* 2. Exam Type Selection */}
          <div>
            <label className="text-xs font-black text-slate-700 block mb-2 uppercase tracking-wide">
              Select Your Target Exam
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* GATE Option */}
              <button
                type="button"
                onClick={() => {
                  setExamType('GATE');
                  setTargetDate('2027-02-07');
                }}
                className={`p-4 rounded-2xl text-left border transition-all relative ${
                  examType === 'GATE'
                    ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-500 ring-2 ring-purple-500/30 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-purple-200'
                }`}
              >
                {examType === 'GATE' && (
                  <CheckCircle2 className="w-5 h-5 text-purple-600 absolute top-3 right-3" />
                )}
                <div className="p-2 rounded-xl bg-purple-600 text-white w-fit mb-2">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">GATE CS & DA 2027</h4>
                <p className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                  Preloads complete 15-subject PW canonical syllabus & lecture planner with 0% starting progress.
                </p>
              </button>

              {/* Custom Exam Option */}
              <button
                type="button"
                onClick={() => setExamType('CUSTOM')}
                className={`p-4 rounded-2xl text-left border transition-all relative ${
                  examType === 'CUSTOM'
                    ? 'bg-gradient-to-br from-pink-50 to-purple-50 border-pink-500 ring-2 ring-pink-500/30 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-pink-200'
                }`}
              >
                {examType === 'CUSTOM' && (
                  <CheckCircle2 className="w-5 h-5 text-pink-600 absolute top-3 right-3" />
                )}
                <div className="p-2 rounded-xl bg-pink-600 text-white w-fit mb-2">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Custom Exam</h4>
                <p className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                  Empty workspace. Create your custom subjects, chapters, lectures, timetable, and goals from scratch.
                </p>
              </button>
            </div>
          </div>

          {/* If Custom, input custom exam name */}
          {examType === 'CUSTOM' && (
            <div>
              <label className="text-xs font-black text-slate-700 block mb-1.5 uppercase tracking-wide">
                Custom Exam Name
              </label>
              <input
                type="text"
                value={customExamName}
                onChange={(e) => setCustomExamName(e.target.value)}
                placeholder="e.g. UPSC CSE / CAT / JEE / USMLE"
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-bold text-sm focus:ring-2 focus:ring-pink-500 focus:outline-none"
              />
            </div>
          )}

          {/* 3. Target Date & Daily Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-slate-700 block mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" /> Target Exam Date
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 block mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" /> Daily Target Hours
              </label>
              <input
                type="number"
                min={1}
                max={18}
                required
                value={dailyHours}
                onChange={(e) => setDailyHours(parseInt(e.target.value) || 6)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Features note */}
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 flex items-center gap-3 text-xs font-medium text-slate-600">
            <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
            <span>
              All data is stored locally in offline database. 0% starting stats with no fake demo analytics.
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-98 transition-all"
          >
            Launch Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
