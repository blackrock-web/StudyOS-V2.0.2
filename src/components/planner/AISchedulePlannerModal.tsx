import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
  Send,
  Sliders,
  Check,
  Settings,
} from 'lucide-react';
import { db } from '../../services/db';
import {
  aiScheduleService,
  ScheduleConstraints,
  GeneratedScheduleResult,
} from '../../services/aiScheduleService';
import { DailyCommitment } from '../../types';

export interface AISchedulePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate?: string;
  onApplied?: () => void;
  onOpenDailySetup?: () => void;
}

export const AISchedulePlannerModal: React.FC<AISchedulePlannerModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  onApplied,
  onOpenDailySetup,
}) => {
  const dateStr = targetDate || new Date().toISOString().split('T')[0] || '';

  // Constraints State
  const [studyHours, setStudyHours] = useState(6);
  const [collegeOption, setCollegeOption] = useState<
    'no_college' | 'full_day' | 'half_day' | 'custom_college'
  >('no_college');
  const [customCollegeStart, setCustomCollegeStart] = useState('10:00');
  const [customCollegeEnd, setCustomCollegeEnd] = useState('16:00');
  const [breakMins, setBreakMins] = useState(15);
  const [maxBlockMins, setMaxBlockMins] = useState(75);
  const [morningSlot, setMorningSlot] = useState<'6-9' | '7-9' | 'custom'>('6-9');
  const [commitments, setCommitments] = useState<DailyCommitment[]>([]);
  const [newCommTitle, setNewCommTitle] = useState('');
  const [newCommStart, setNewCommStart] = useState('17:00');
  const [newCommEnd, setNewCommEnd] = useState('18:00');

  // Schedule Result & NL State
  const [scheduleResult, setScheduleResult] = useState<GeneratedScheduleResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [nlCommand, setNlCommand] = useState('');
  const [isProcessingNl, setIsProcessingNl] = useState(false);
  const [nlFeedback, setNlFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'constraints'>('schedule');

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setNlFeedback(null);
    try {
      const constraints: ScheduleConstraints = {
        targetDate: dateStr,
        examId: db.getActiveExamId(),
        availableStudyHours: studyHours,
        collegeOption,
        customCollegeStart: collegeOption === 'custom_college' ? customCollegeStart : undefined,
        customCollegeEnd: collegeOption === 'custom_college' ? customCollegeEnd : undefined,
        commitments,
        morningSlot,
        breakPreferenceMinutes: breakMins,
        maxContinuousFocusMinutes: maxBlockMins,
      };

      const result = await aiScheduleService.generateDailySchedule(constraints);
      setScheduleResult(result);
      setActiveTab('schedule');
    } catch {
      /* ignore */
    } finally {
      setIsGenerating(false);
    }
  }, [dateStr, studyHours, collegeOption, customCollegeStart, customCollegeEnd, commitments, morningSlot, breakMins, maxBlockMins]);

  useEffect(() => {
    if (isOpen) {
      const existingAvail = db.getDailyAvailability(dateStr);
      if (existingAvail) {
        const opt = existingAvail.collegeOption;
        if (opt === 'morning_college' || opt === 'afternoon_college') {
          setCollegeOption('half_day');
        } else if (opt === 'full_college') {
          setCollegeOption('full_day');
        } else if (opt === 'custom_college') {
          setCollegeOption('custom_college');
        } else {
          setCollegeOption('no_college');
        }
        if (existingAvail.customCollegeStart) setCustomCollegeStart(existingAvail.customCollegeStart);
        if (existingAvail.customCollegeEnd) setCustomCollegeEnd(existingAvail.customCollegeEnd);
        setCommitments(existingAvail.commitments || []);
      }
      handleGenerate();
    }
  }, [isOpen, dateStr, handleGenerate]);

  // Keyboard accessibility
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleExecuteNlCommand = async (commandToRun?: string) => {
    const cmd = (commandToRun || nlCommand).trim();
    if (!cmd || !scheduleResult) return;

    setIsProcessingNl(true);
    setNlFeedback(null);
    try {
      const res = await aiScheduleService.executeNaturalLanguageScheduleEdit(
        cmd,
        scheduleResult.slots,
        dateStr
      );

      setScheduleResult({
        ...scheduleResult,
        slots: res.slots,
        hasConflict: !!res.conflictWarning,
        conflictReason: res.conflictWarning,
      });

      setNlFeedback(res.explanation);
      setNlCommand('');
    } catch {
      setNlFeedback('Could not process natural language instruction.');
    } finally {
      setIsProcessingNl(false);
    }
  };

  const handleAddCommitment = () => {
    if (!newCommTitle.trim()) return;
    setCommitments([
      ...commitments,
      {
        id: `comm-${Date.now()}`,
        title: newCommTitle.trim(),
        startTime: newCommStart,
        endTime: newCommEnd,
      },
    ]);
    setNewCommTitle('');
  };

  const handleRemoveCommitment = (id: string) => {
    setCommitments(commitments.filter((c) => c.id !== id));
  };

  const handleDeleteSlot = (slotId: string) => {
    if (!scheduleResult) return;
    setScheduleResult({
      ...scheduleResult,
      slots: scheduleResult.slots.filter((s) => s.id !== slotId),
    });
  };

  const handleApply = () => {
    if (!scheduleResult) return;
    aiScheduleService.applyScheduleToDatabase(dateStr, scheduleResult.slots);
    if (onApplied) onApplied();
    onClose();
  };

  const activeExamId = db.getActiveExamId();
  const currentExamSubs = db.getCurrentExamSubjects(activeExamId);
  const sub1 = currentExamSubs[0] || 'Core Subject';
  const sub2 = currentExamSubs[1] || currentExamSubs[0] || 'Revision';

  const promptChips = [
    `⚡ Prioritize ${sub1} today`,
    `🎯 Focus on pending ${sub2} lectures`,
    '💼 I have college/work from 2 PM to 5 PM',
    '⏳ I only have 4 hours today',
    '☕ Add a 20-minute break after deep study',
    `🔄 Schedule high-priority ${sub1} revision`,
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-planner-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5 animate-fadeIn"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="ai-planner-modal-title" className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>AI Planner</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                  {dateStr}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                AI schedule engine optimizes lectures, syllabus topics, and breaks with conflict prevention.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Launch Daily Setup button if provided */}
            {onOpenDailySetup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDailySetup();
                }}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open Daily Setup"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Daily Setup</span>
              </button>
            )}

            {/* View Switcher */}
            <div className="flex bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'schedule'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Timetable
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('constraints')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === 'constraints'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Constraints
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              aria-label="Close AI Planner Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {activeTab === 'constraints' ? (
            /* CONSTRAINTS TAB */
            <div className="space-y-6">
              {/* Daily Target Study Hours */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <label htmlFor="ai-study-hours-slider" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Available Daily Study Time
                  </label>
                  <span className="text-base font-black text-indigo-600 font-mono">
                    {studyHours} Hours
                  </span>
                </div>
                <input
                  id="ai-study-hours-slider"
                  type="range"
                  min={1}
                  max={14}
                  step={0.5}
                  value={studyHours}
                  onChange={(e) => setStudyHours(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>1 hr (Light)</span>
                  <span>6 hrs (Standard)</span>
                  <span>14 hrs (Intense Exam Prep)</span>
                </div>
              </div>

              {/* College / Work Schedule */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-teal-600" />
                  College & Work Commitments
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'no_college', label: 'No College / Day Off' },
                    { id: 'full_day', label: 'Full Day (9AM-5PM)' },
                    { id: 'half_day', label: 'Half Day (9AM-1:30PM)' },
                    { id: 'custom_college', label: 'Custom Hours' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCollegeOption(opt.id as any)}
                      className={`p-2.5 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                        collegeOption === opt.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {collegeOption === 'custom_college' && (
                  <div className="flex items-center space-x-3 pt-2">
                    <div className="flex-1">
                      <span className="text-xs text-slate-500 font-medium block mb-1">Start Time</span>
                      <input
                        type="time"
                        value={customCollegeStart}
                        onChange={(e) => setCustomCollegeStart(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-bold"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-slate-500 font-medium block mb-1">End Time</span>
                      <input
                        type="time"
                        value={customCollegeEnd}
                        onChange={(e) => setCustomCollegeEnd(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Focus Block & Break Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label htmlFor="ai-focus-duration-select" className="text-xs font-bold text-slate-700">
                    Max Continuous Focus Duration
                  </label>
                  <select
                    id="ai-focus-duration-select"
                    value={maxBlockMins}
                    onChange={(e) => setMaxBlockMins(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold cursor-pointer"
                  >
                    <option value={45}>45 Minutes (Short Sprints)</option>
                    <option value={60}>60 Minutes (Standard)</option>
                    <option value={75}>75 Minutes (Deep Lecture)</option>
                    <option value={90}>90 Minutes (Intensive Practice)</option>
                  </select>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label htmlFor="ai-break-preference-select" className="text-xs font-bold text-slate-700">
                    Break Preference
                  </label>
                  <select
                    id="ai-break-preference-select"
                    value={breakMins}
                    onChange={(e) => setBreakMins(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold cursor-pointer"
                  >
                    <option value={10}>10 Minutes (Quick Water/Stretch)</option>
                    <option value={15}>15 Minutes (Optimal Recharge)</option>
                    <option value={30}>30 Minutes (Relaxed Recovery)</option>
                  </select>
                </div>
              </div>

              {/* Commitments */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Fixed Commitments (Doctor, Gym, Appointments)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Commitment title..."
                    value={newCommTitle}
                    onChange={(e) => setNewCommTitle(e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                  />
                  <input
                    type="time"
                    value={newCommStart}
                    onChange={(e) => setNewCommStart(e.target.value)}
                    className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={newCommEnd}
                    onChange={(e) => setNewCommEnd(e.target.value)}
                    className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCommitment}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {commitments.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {commitments.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs"
                      >
                        <span className="font-bold text-slate-800">
                          {c.title} ({c.startTime} - {c.endTime})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCommitment(c.id)}
                          className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGenerating ? 'Synthesizing Optimal Schedule...' : 'Regenerate Timetable'}</span>
              </button>
            </div>
          ) : (
            /* TIMETABLE TAB */
            <div className="space-y-6">
              {/* Natural-Language Schedule Command Bar */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Natural Language Schedule Editor
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nlCommand}
                    onChange={(e) => setNlCommand(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExecuteNlCommand()}
                    placeholder='Type a command: "Give me more physics today", "I have work 6-8 PM", "Only 2 hours today"...'
                    className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleExecuteNlCommand()}
                    disabled={isProcessingNl || !nlCommand.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Apply</span>
                  </button>
                </div>

                {/* Prompt suggestion chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {promptChips.map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleExecuteNlCommand(chip.replace(/^[^\w]+/, ''))}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white hover:bg-indigo-50 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {nlFeedback && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-fadeIn font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{nlFeedback}</span>
                  </div>
                )}
              </div>

              {/* Conflict Callout if any */}
              {scheduleResult?.hasConflict && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start space-x-2.5 animate-fadeIn">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Feasibility Notice</span>
                    <span>{scheduleResult.conflictReason}</span>
                  </div>
                </div>
              )}

              {/* Schedule Metrics Summary Bar */}
              {scheduleResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-bold block">Total Planned Study</span>
                    <span className="text-base font-black text-indigo-600 font-mono">
                      {Math.floor(scheduleResult.totalPlannedMinutes / 60)}h {scheduleResult.totalPlannedMinutes % 60}m
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-bold block">Total Break / Rest</span>
                    <span className="text-base font-black text-amber-600 font-mono">
                      {scheduleResult.totalBreakMinutes}m
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-bold block">Work & Commitments</span>
                    <span className="text-base font-black text-teal-600 font-mono">
                      {Math.floor(scheduleResult.totalWorkMinutes / 60)}h {scheduleResult.totalWorkMinutes % 60}m
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-bold block">Feasibility Score</span>
                    <span className="text-base font-black text-emerald-600 font-mono">
                      {scheduleResult.feasibilityScore}%
                    </span>
                  </div>
                </div>
              )}

              {/* Slot Cards List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>Generated Schedule Timeline</span>
                  <span>{scheduleResult?.slots.length || 0} Slots Planned</span>
                </div>

                {scheduleResult?.slots.map((slot) => {
                  const isBreak = slot.type === 'Break';
                  const isWork = slot.type === 'College' || slot.type === 'Commitment';

                  return (
                    <div
                      key={slot.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isBreak
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : isWork
                          ? 'bg-slate-100 border-slate-200 text-slate-700'
                          : 'bg-white border-slate-200 shadow-2xs hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        {/* Time box */}
                        <div className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700 shrink-0">
                          {slot.startTime} - {slot.endTime}
                        </div>

                        {/* Title & Subject */}
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isBreak
                                  ? 'bg-amber-200 text-amber-900'
                                  : isWork
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {slot.subject}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {slot.title}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Duration & Delete */}
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {slot.durationMinutes}m
                        </span>
                        {!slot.isProtected && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Remove Slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'schedule' ? 'constraints' : 'schedule')}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{activeTab === 'schedule' ? 'Adjust Constraints' : 'View Timetable'}</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply to Planner</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISchedulePlannerModal;
