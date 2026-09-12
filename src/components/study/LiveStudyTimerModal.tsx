import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  X,
  Flame,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  FileText,
  Volume2,
  VolumeX,
  AlertCircle,
  BarChart2,
} from 'lucide-react';
import { db } from '../../services/db';
import { analyticsService } from '../../services/analyticsService';
import { activityEventService } from '../../services/activityEventService';

interface LiveStudyTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
  initialTaskTitle?: string;
  initialTaskId?: string;
  initialPlannedMinutes?: number;
  initialType?: string;
  onSessionCompleted?: (summary: { durationMinutes: number; remainingHours: number; subject: string }) => void;
}

export const LiveStudyTimerModal: React.FC<LiveStudyTimerModalProps> = ({
  isOpen,
  onClose,
  initialSubject,
  initialTaskTitle,
  initialTaskId,
  initialPlannedMinutes = 60,
  initialType = 'Study Session',
  onSessionCompleted,
}) => {
  const [subject, setSubject] = useState(initialSubject || '');
  const [taskTitle, setTaskTitle] = useState(initialTaskTitle || 'Deep Study Session');
  const [plannedMinutes, setPlannedMinutes] = useState(initialPlannedMinutes);
  const [type, setType] = useState(initialType);
  const [sessionNotes, setSessionNotes] = useState('');

  const [isRunning, setIsRunning] = useState(true);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [autoPausedNotice, setAutoPausedNotice] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<{
    logged: boolean;
    durationMinutes: number;
    remainingHours: number;
    subjectCompleted: boolean;
    nextSubject?: string;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // References to keep event listeners synchronized without stale closures
  const isRunningRef = useRef(isRunning);
  const secondsElapsedRef = useRef(secondsElapsed);
  const lastSyncedSecondsRef = useRef(0);
  const subjectRef = useRef(subject);
  const taskTitleRef = useRef(taskTitle);
  const typeRef = useRef(type);
  const taskIdRef = useRef(initialTaskId);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    secondsElapsedRef.current = secondsElapsed;
  }, [secondsElapsed]);

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    taskTitleRef.current = taskTitle;
  }, [taskTitle]);

  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  useEffect(() => {
    taskIdRef.current = initialTaskId;
  }, [initialTaskId]);

  useEffect(() => {
    if (isOpen) {
      const subs = db.getCurrentExamSubjects();
      setAvailableSubjects(subs);
      if (!initialSubject && subs.length > 0) {
        const focusPlan = db.getFocusModePlan();
        setSubject(focusPlan.subjectName || subs[0]);
      } else if (initialSubject) {
        setSubject(initialSubject);
      }
      if (initialTaskTitle) setTaskTitle(initialTaskTitle);
      if (initialPlannedMinutes) setPlannedMinutes(initialPlannedMinutes);
      if (initialType) setType(initialType);

      setSecondsElapsed(0);
      lastSyncedSecondsRef.current = 0;
      setIsRunning(true);
      setCompletionResult(null);
      setSessionNotes('');
      setAutoPausedNotice(null);
    }
  }, [isOpen, initialSubject, initialTaskTitle, initialPlannedMinutes, initialType]);

  // Main 1-second interval ticker
  useEffect(() => {
    if (isOpen && isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isRunning]);

  // Save partial or full study time to analytics & database
  const syncProgressToAnalytics = useCallback((reason: string) => {
    const unloggedSeconds = secondsElapsedRef.current - lastSyncedSecondsRef.current;
    if (unloggedSeconds >= 10) {
      const unloggedMins = Math.max(1, Math.round(unloggedSeconds / 60));
      const curSubject = subjectRef.current || 'General Studies';
      const curTitle = taskTitleRef.current || 'Focus Session';

      try {
        db.recordActualStudySession({
          subject: curSubject,
          topic: curTitle,
          durationMinutes: unloggedMins,
          notes: `${reason} (Auto-sync)`,
          type: typeRef.current,
          taskId: taskIdRef.current,
        });

        analyticsService.logEvent({
          type: 'focus_ended',
          subject: curSubject,
          topic: curTitle,
          durationMinutes: unloggedMins,
          details: {
            taskId: taskIdRef.current,
            reason,
            autoSync: true,
          },
        });

        activityEventService.logEvent({
          module: 'focus',
          action: 'auto_sync',
          title: `Focus Sprint on ${curSubject}`,
          subject: curSubject,
          topic: curTitle,
          durationMinutes: unloggedMins,
          details: {
            reason,
            taskId: taskIdRef.current,
          },
        });
      } catch (err) {
        console.error('Failed to sync study analytics automatically:', err);
      }

      lastSyncedSecondsRef.current = secondsElapsedRef.current;
    }
  }, []);

  // Minimization / Window Hidden / Window Close Auto-Pause & Auto-Sync
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        if (isRunningRef.current) {
          setIsRunning(false);
          syncProgressToAnalytics('App Minimized / Backgrounded');
          setAutoPausedNotice('Timer paused and study time automatically updated to analytics when application was minimized.');
        }
      }
    };

    const handleWindowBlur = () => {
      // If window blurs and is hidden, pause & log
      if (document.hidden && isRunningRef.current) {
        setIsRunning(false);
        syncProgressToAnalytics('Window Blurred / Minimized');
        setAutoPausedNotice('Timer paused & analytics saved while window was inactive.');
      }
    };

    const handleBeforeUnload = () => {
      syncProgressToAnalytics('Application Exit');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOpen, syncProgressToAnalytics]);

  if (!isOpen) return null;

  const plannedSeconds = Math.max(1, plannedMinutes * 60);
  const progressPercent = Math.min(100, Math.round((secondsElapsed / plannedSeconds) * 100));

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTogglePlay = () => {
    if (!isRunning) {
      setAutoPausedNotice(null);
    } else {
      syncProgressToAnalytics('Manual Pause');
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setSecondsElapsed(0);
    lastSyncedSecondsRef.current = 0;
    setAutoPausedNotice(null);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      modalContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleFinishSession = () => {
    setIsRunning(false);
    const minutesSpent = Math.max(1, Math.round(secondsElapsed / 60));
    const curSubject = subject || 'General Studies';
    const curTitle = taskTitle || 'Deep Study Session';

    const result = db.recordActualStudySession({
      subject: curSubject,
      topic: curTitle,
      durationMinutes: minutesSpent,
      notes: sessionNotes,
      type,
      taskId: initialTaskId,
    });

    try {
      analyticsService.logEvent({
        type: 'focus_ended',
        subject: curSubject,
        topic: curTitle,
        durationMinutes: minutesSpent,
        details: {
          taskId: initialTaskId,
          completed: true,
          notes: sessionNotes,
        },
      });

      activityEventService.logEvent({
        module: 'focus',
        action: 'session_completed',
        title: `Finished focus sprint on ${curSubject}`,
        subject: curSubject,
        topic: curTitle,
        durationMinutes: minutesSpent,
        details: {
          taskId: initialTaskId,
          completed: true,
        },
      });
    } catch (e) {
      console.error(e);
    }

    setCompletionResult({
      logged: true,
      durationMinutes: minutesSpent,
      remainingHours: result.remainingHours,
      subjectCompleted: result.subjectCompleted,
      nextSubject: result.nextSubject,
    });

    if (onSessionCompleted) {
      onSessionCompleted({
        durationMinutes: minutesSpent,
        remainingHours: result.remainingHours,
        subject: curSubject,
      });
    }
  };

  return (
    <div
      ref={modalContainerRef}
      id="live-study-timer-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 flex flex-col">
        {/* Light Theme Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-2xl bg-purple-100 text-purple-700">
              <Flame className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-black text-slate-900">Focus Timer</h3>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Distraction-Free Sprint • Auto-saves to Analytics on Minimize
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute' : 'Unmute'}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleFullscreen}
              title="Fullscreen"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Auto-Paused on Minimize Notification Banner */}
        {autoPausedNotice && !completionResult && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 flex items-center justify-between text-xs font-bold animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{autoPausedNotice}</span>
            </div>
            <button
              type="button"
              onClick={handleTogglePlay}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] shadow-xs cursor-pointer"
            >
              Resume Timer
            </button>
          </div>
        )}

        {/* Content Body */}
        {completionResult ? (
          <div className="p-8 text-center space-y-6 bg-white">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">
                Focus Session Completed & Verified!
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                You logged <strong className="text-purple-700 font-black">{completionResult.durationMinutes} minutes</strong> of active study time for <strong className="text-slate-900">{subject}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Remaining Subject Hours</span>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {completionResult.remainingHours} hrs
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Analytics Status</span>
                <p className="text-sm font-black text-emerald-700 mt-1 flex items-center justify-center gap-1">
                  <BarChart2 className="w-4 h-4" /> Updated
                </p>
              </div>
            </div>

            {completionResult.subjectCompleted && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 max-w-md mx-auto text-left">
                <div className="flex items-center space-x-2 font-black">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <span>Target Hours Achieved!</span>
                </div>
                <p className="text-xs mt-1 text-amber-800 font-medium">
                  Congratulations! You have completed all required focus hours for {subject}.
                  {completionResult.nextSubject
                    ? ` Focus Mode has automatically advanced to the next subject: ${completionResult.nextSubject}.`
                    : ''}
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full max-w-xs py-3 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-sm transition-all shadow-md shadow-purple-600/25 cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="p-6 md:p-8 space-y-6 bg-white">
            {/* Subject and Title Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Subject (Active Exam Syllabus)
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                >
                  {availableSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Topic / Task Description
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Chapter 3: Dynamic Programming PYQs"
                  className="w-full py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Timer Display in Pure Light Theme */}
            <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-3xl border border-purple-100 relative overflow-hidden">
              <div className="text-6xl md:text-7xl font-mono font-black tracking-tight text-slate-900 tabular-nums">
                {formatTime(secondsElapsed)}
              </div>

              <div className="flex items-center space-x-2 mt-3 text-xs font-bold text-slate-500">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Planned: {plannedMinutes} mins</span>
                <span>•</span>
                <span>{progressPercent}% completed</span>
              </div>

              {/* Progress Line */}
              <div className="w-64 h-2.5 bg-slate-200 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Quick Session Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span>Session Key Takeaways / Notes</span>
              </label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Log formulas derived, tricky doubts, or question numbers solved..."
                rows={2}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white resize-none transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center space-x-4 pt-2">
              <button
                type="button"
                onClick={handleReset}
                title="Reset Timer"
                className="p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleTogglePlay}
                className={`py-3.5 px-8 rounded-2xl font-black text-sm flex items-center space-x-2 shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/25'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" />
                    <span>Pause Session</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Resume Session</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleFinishSession}
                className="py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete & Log</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
