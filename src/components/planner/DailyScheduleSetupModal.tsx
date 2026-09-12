import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sun,
  BookOpen,
  Send,
  Zap,
  Target,
  Sliders,
  Check,
} from 'lucide-react';
import { db } from '../../services/db';
import {
  CollegeOption,
  DailyCommitment,
  AutoScheduleResult,
  ExamItem,
  TaskItem,
} from '../../types';
import { aiScheduleService } from '../../services/aiScheduleService';
import { getAllSubjectOptions } from '../../data/subjectRegistry';

export interface DailyScheduleSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate?: string;
  initialExamId?: string;
  initialSubject?: string;
  onScheduleCreated?: (result?: any) => void;
  onScheduleGenerated?: (result?: AutoScheduleResult) => void;
}

export const DailyScheduleSetupModal: React.FC<DailyScheduleSetupModalProps> = ({
  isOpen,
  onClose,
  targetDate,
  initialExamId,
  initialSubject,
  onScheduleCreated,
  onScheduleGenerated,
}) => {
  // Target Date
  const defaultDateStr = targetDate || new Date().toISOString().split('T')[0] || '';
  const [dateStr, setDateStr] = useState<string>(defaultDateStr);

  // Dynamic Exam List
  const [exams, setExams] = useState<ExamItem[]>(() => db.getExams());
  const [selectedExamId, setSelectedExamId] = useState<string>(
    () => initialExamId || db.getActiveExamId()
  );

  // Dynamic Subjects based on selected exam
  const availableSubjects = useMemo(() => {
    const subs = db.getCurrentExamSubjects(selectedExamId);
    return subs.length > 0 ? subs : getAllSubjectOptions(selectedExamId);
  }, [selectedExamId]);

  // Selected Focus / Target Subject for the day
  const [selectedSubject, setSelectedSubject] = useState<string>(
    () => initialSubject || availableSubjects[0] || 'General Studies'
  );

  // Available Study Time (Hours & Minutes)
  const [studyHours, setStudyHours] = useState<number>(3.5);

  // Main Goal
  const [mainGoal, setMainGoal] = useState<'mixed' | 'revision' | 'new_topics' | 'practice_test'>(
    'mixed'
  );

  // Prioritization Toggles
  const [prioritizeLectures, setPrioritizeLectures] = useState<boolean>(true);
  const [prioritizeWeakTopics, setPrioritizeWeakTopics] = useState<boolean>(true);
  const [prioritizePendingSyllabus, setPrioritizePendingSyllabus] = useState<boolean>(true);
  const [prioritizeExamPrep, setPrioritizeExamPrep] = useState<boolean>(false);

  // College & Work Commitments
  const [collegeOption, setCollegeOption] = useState<CollegeOption>('no_college');
  const [customCollegeStart, setCustomCollegeStart] = useState('10:00');
  const [customCollegeEnd, setCustomCollegeEnd] = useState('16:00');
  const [collegeSlots, setCollegeSlots] = useState<
    Array<{ id: string; title: string; start: string; end: string }>
  >([{ id: 'slot-1', title: 'College Lecture Slot 1', start: '10:00', end: '13:00' }]);
  const [newSlotTitle, setNewSlotTitle] = useState('');
  const [newSlotStart, setNewSlotStart] = useState('14:00');
  const [newSlotEnd, setNewSlotEnd] = useState('16:00');

  // Morning Slot Preference
  const [morningSlot, setMorningSlot] = useState<'6-9' | '7-9' | 'custom'>('6-9');

  // Additional Commitments
  const [commitments, setCommitments] = useState<DailyCommitment[]>([]);
  const [newCommitmentTitle, setNewCommitmentTitle] = useState('');
  const [newCommitmentStart, setNewCommitmentStart] = useState('17:00');
  const [newCommitmentEnd, setNewCommitmentEnd] = useState('18:00');

  // Natural Language fast input
  const [nlInput, setNlInput] = useState('');
  const [isProcessingNl, setIsProcessingNl] = useState(false);
  const [nlFeedback, setNlFeedback] = useState<string | null>(null);

  // Output Result Preview
  const [scheduleResult, setScheduleResult] = useState<AutoScheduleResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync state on open or when initial props change
  useEffect(() => {
    if (isOpen) {
      const activeId = initialExamId || db.getActiveExamId();
      setSelectedExamId(activeId);
      const allExams = db.getExams();
      setExams(allExams);

      const subs = db.getCurrentExamSubjects(activeId);
      const validSubs = subs.length > 0 ? subs : getAllSubjectOptions(activeId);
      if (initialSubject && validSubs.includes(initialSubject)) {
        setSelectedSubject(initialSubject);
      } else {
        setSelectedSubject(validSubs[0] || 'General Studies');
      }

      const currentDate = targetDate || new Date().toISOString().split('T')[0] || '';
      setDateStr(currentDate);

      const existingAvail = db.getDailyAvailability(currentDate);
      if (existingAvail) {
        setCollegeOption(existingAvail.collegeOption);
        if (existingAvail.customCollegeStart) setCustomCollegeStart(existingAvail.customCollegeStart);
        if (existingAvail.customCollegeEnd) setCustomCollegeEnd(existingAvail.customCollegeEnd);
        setMorningSlot(existingAvail.morningSlot);
        setCommitments(existingAvail.commitments || []);
      }
      setScheduleResult(null);
      setNlFeedback(null);
      setNlInput('');
    }
  }, [isOpen, targetDate, initialExamId, initialSubject]);

  // When selected exam changes, update subject list and ensure selectedSubject is valid
  const handleExamChange = (newExamId: string) => {
    setSelectedExamId(newExamId);
    const subs = db.getCurrentExamSubjects(newExamId);
    const validSubs = subs.length > 0 ? subs : getAllSubjectOptions(newExamId);
    if (!validSubs.includes(selectedSubject)) {
      setSelectedSubject(validSubs[0] || 'General Studies');
    }
  };

  // Keyboard accessibility: Escape to close
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

  const handleAddCollegeSlot = () => {
    if (!newSlotStart || !newSlotEnd) return;
    const title = newSlotTitle.trim() || `College Slot ${collegeSlots.length + 1}`;
    setCollegeSlots([
      ...collegeSlots,
      { id: `cslot-${Date.now()}`, title, start: newSlotStart, end: newSlotEnd },
    ]);
    setNewSlotTitle('');
  };

  const handleRemoveCollegeSlot = (id: string) => {
    setCollegeSlots(collegeSlots.filter((s) => s.id !== id));
  };

  const handleAddCommitment = () => {
    if (!newCommitmentTitle.trim()) return;
    const newComm: DailyCommitment = {
      id: `comm-${Date.now()}`,
      title: newCommitmentTitle.trim(),
      startTime: newCommitmentStart,
      endTime: newCommitmentEnd,
    };
    setCommitments([...commitments, newComm]);
    setNewCommitmentTitle('');
  };

  const handleRemoveCommitment = (id: string) => {
    setCommitments(commitments.filter((c) => c.id !== id));
  };

  // Natural Language Scheduling Command
  const handleExecuteNl = async () => {
    if (!nlInput.trim()) return;
    setIsProcessingNl(true);
    setNlFeedback(null);
    try {
      const res = await aiScheduleService.parseAndExecuteNaturalLanguageCommand(nlInput.trim(), {
        forceConfirm: false,
      });
      if (res.success) {
        setNlFeedback(res.explanation || 'Schedule adjusted according to your command.');
        setNlInput('');
        // Refresh schedule
        const newRes = db.generateDailySchedule(dateStr);
        setScheduleResult(newRes);
        if (onScheduleCreated) onScheduleCreated(newRes);
        if (onScheduleGenerated) onScheduleGenerated(newRes);
      } else {
        setNlFeedback(res.explanation || 'Could not understand instruction.');
      }
    } catch {
      setNlFeedback('Error processing natural language schedule.');
    } finally {
      setIsProcessingNl(false);
    }
  };

  // Generate & Save Schedule
  const handleCreateSchedule = () => {
    setIsGenerating(true);
    try {
      // Merge college slots into commitments if multi-slot custom college is selected
      const allCommitments = [...commitments];
      if (collegeOption === 'custom_college' && collegeSlots.length > 1) {
        collegeSlots.slice(1).forEach((slot) => {
          allCommitments.push({
            id: slot.id,
            title: slot.title,
            startTime: slot.start,
            endTime: slot.end,
          });
        });
      }

      const firstSlot = collegeSlots[0];
      const cStart =
        collegeOption === 'custom_college'
          ? firstSlot?.start || customCollegeStart
          : undefined;
      const cEnd =
        collegeOption === 'custom_college'
          ? firstSlot?.end || customCollegeEnd
          : undefined;

      // Save availability record to DB
      db.saveDailyAvailability({
        date: dateStr,
        collegeOption,
        customCollegeStart: cStart,
        customCollegeEnd: cEnd,
        morningSlot,
        commitments: allCommitments,
        specialPriority:
          mainGoal === 'revision'
            ? 'revision'
            : mainGoal === 'practice_test'
            ? 'practice_test'
            : 'focus_subject',
        specialSubjectName: selectedSubject,
      });

      // Generate daily schedule
      const result = db.generateDailySchedule(dateStr);
      setScheduleResult(result);

      if (onScheduleGenerated) {
        onScheduleGenerated(result);
      }
      if (onScheduleCreated) {
        onScheduleCreated(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAndClose = () => {
    if (scheduleResult) {
      aiScheduleService.applyScheduleToDatabase(dateStr, scheduleResult.slots, selectedExamId);
    }
    if (onScheduleCreated) {
      onScheduleCreated(scheduleResult);
    }
    onClose();
  };

  const activeExamObj = exams.find((e) => e.id === selectedExamId);

  // Formatted date string for header display
  const formattedDateTitle = useMemo(() => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      /* ignore */
    }
    return dateStr;
  }, [dateStr]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-setup-modal-title"
      className="daily-setup-ai-planner fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-5 animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="daily-setup-modal-title" className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Daily Setup</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                  {dateStr}
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Configure your exam targets, availability, and preferences to auto-generate a conflict-free study schedule.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close Daily Setup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 text-xs sm:text-sm">
          {/* Result Preview Screen */}
          {scheduleResult ? (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start space-x-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-sm text-emerald-900">Feasible Daily Schedule Ready</h4>
                  <p className="text-xs text-emerald-800 mt-1 font-medium">
                    Allocated {Math.round((scheduleResult.totalPlannedMinutes / 60) * 10) / 10} hours of study time for {selectedSubject} under {activeExamObj?.title || 'Active Exam'}.
                  </p>
                </div>
              </div>

              {scheduleResult.hasConflict && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold">Schedule Overlap Alert</span>
                    <p className="font-medium">{scheduleResult.conflictReason}</p>
                  </div>
                </div>
              )}

              {/* Timeline Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Generated Schedule Timeline</span>
                  <span className="font-mono text-indigo-600">{scheduleResult.slots.length} Slots</span>
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  {scheduleResult.slots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`p-3.5 flex items-center justify-between text-xs ${
                        slot.isProtected
                          ? 'bg-slate-50 text-slate-500 font-medium'
                          : 'bg-white text-slate-900 font-bold'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-slate-500 w-24">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <span className="truncate max-w-[280px] sm:max-w-md">{slot.title}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 ${
                          slot.type === 'Break'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : slot.type === 'College'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {slot.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleResult(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                >
                  ← Reconfigure Setup
                </button>
                <button
                  type="button"
                  onClick={handleApplyAndClose}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Apply Schedule to Planner
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Natural Language Quick Bar */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="daily-setup-nl-input" className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Quick Natural Language Scheduler</span>
                  </label>
                  <span className="text-[10px] font-medium text-indigo-600">e.g. "Schedule CPU Scheduling tomorrow at 6 PM for 1 hour"</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="daily-setup-nl-input"
                    type="text"
                    value={nlInput}
                    onChange={(e) => setNlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleExecuteNl();
                    }}
                    placeholder="Type study instructions or quick schedule request..."
                    className="flex-1 px-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleExecuteNl}
                    disabled={isProcessingNl || !nlInput.trim()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isProcessingNl ? 'Parsing...' : 'Apply'}</span>
                  </button>
                </div>
                {nlFeedback && (
                  <p className="text-xs font-bold text-indigo-900 bg-white/80 p-2 rounded-lg border border-indigo-100">
                    {nlFeedback}
                  </p>
                )}
              </div>

              {/* Grid 1: Date, Exam, Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Target Date */}
                <div className="space-y-1.5">
                  <label htmlFor="daily-setup-date-input" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Date</span>
                  </label>
                  <input
                    id="daily-setup-date-input"
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs"
                  />
                </div>

                {/* Exam Dropdown */}
                <div className="space-y-1.5">
                  <label htmlFor="daily-setup-exam-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Exam</span>
                  </label>
                  <select
                    id="daily-setup-exam-select"
                    value={selectedExamId}
                    onChange={(e) => handleExamChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title || ex.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject Dropdown (Strictly dynamic from selected exam's syllabus) */}
                <div className="space-y-1.5">
                  <label htmlFor="daily-setup-subject-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Subject ({availableSubjects.length})</span>
                  </label>
                  <select
                    id="daily-setup-subject-select"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden shadow-2xs"
                  >
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 2: Available Study Time & Main Goal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Available Study Time */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="daily-setup-study-hours-slider" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>Available Study Time</span>
                    </label>
                    <span className="text-xs font-black text-indigo-600 font-mono px-2 py-0.5 bg-white rounded-lg border border-indigo-100">
                      {Math.floor(studyHours)}h {Math.round((studyHours % 1) * 60)}m
                    </span>
                  </div>
                  <input
                    id="daily-setup-study-hours-slider"
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={studyHours}
                    onChange={(e) => setStudyHours(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>1 hour</span>
                    <span>3.5 hours</span>
                    <span>6 hours</span>
                    <span>12 hours</span>
                  </div>
                </div>

                {/* Main Planning Goal */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span>Main Study Goal</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'mixed', label: 'Mixed Learning' },
                      { id: 'revision', label: 'Revision Sprint' },
                      { id: 'new_topics', label: 'New Topics' },
                      { id: 'practice_test', label: 'Practice & PYQs' },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setMainGoal(g.id as any)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                          mainGoal === g.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prioritization Badges */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Prioritization Criteria</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrioritizeLectures(!prioritizeLectures)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      prioritizeLectures
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-black'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>Upcoming Lectures</span>
                    {prioritizeLectures && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrioritizeWeakTopics(!prioritizeWeakTopics)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      prioritizeWeakTopics
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-black'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>Weak Topics</span>
                    {prioritizeWeakTopics && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrioritizePendingSyllabus(!prioritizePendingSyllabus)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      prioritizePendingSyllabus
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-black'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>Pending Syllabus</span>
                    {prioritizePendingSyllabus && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrioritizeExamPrep(!prioritizeExamPrep)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      prioritizeExamPrep
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-black'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>Exam Preparation</span>
                    {prioritizeExamPrep && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                </div>
              </div>

              {/* College & Work Hours */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>College & Work Hours Today</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'no_college', label: 'No College (Free)' },
                    { id: 'morning_college', label: 'Morning (10am-1pm)' },
                    { id: 'afternoon_college', label: 'Afternoon (2pm-6pm)' },
                    { id: 'full_college', label: 'Full Day (9am-5pm)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCollegeOption(opt.id as CollegeOption)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                        collegeOption === opt.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Protected Slots Notice */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs flex items-center space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-medium">
                  Protected Timetable: Breakfast (09:00-10:00 AM), Leisure (06:00-07:00 PM), and Dinner (09:00-10:00 PM) are protected and never overwritten.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!scheduleResult && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSchedule}
              disabled={isGenerating}
              className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? 'Generating...' : 'Create Schedule'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyScheduleSetupModal;
