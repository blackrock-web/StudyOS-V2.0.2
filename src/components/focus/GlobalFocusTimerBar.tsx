import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  X,
  Maximize2,
  Clock,
  Sparkles,
  BookOpen,
  Volume2,
  Flame,
  Award,
} from 'lucide-react';
import { focusTimerService, FocusTimerEngineState } from '../../services/focusTimerService';
import { db } from '../../services/db';

interface GlobalFocusTimerBarProps {
  onOpenFullModal?: () => void;
  onOpenLauncher?: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const GlobalFocusTimerBar: React.FC<GlobalFocusTimerBarProps> = ({ onOpenFullModal, onOpenLauncher }) => {
  const [timerState, setTimerState] = useState<FocusTimerEngineState>(() => focusTimerService.getState());
  const [activeWorkspaceExamId, setActiveWorkspaceExamId] = useState<string>(() => db.getActiveExamId());

  useEffect(() => {
    const unsub = focusTimerService.subscribe((s) => setTimerState(s));
    const handleExamChange = () => setActiveWorkspaceExamId(db.getActiveExamId());
    window.addEventListener('studyos_active_exam_changed', handleExamChange);
    return () => {
      unsub();
      window.removeEventListener('studyos_active_exam_changed', handleExamChange);
    };
  }, []);

  if (timerState.status === 'idle' || timerState.status === 'completed' || timerState.status === 'cancelled') {
    return null;
  }

  const isRunning = timerState.status === 'running';
  const totalSecs = Math.max(1, timerState.plannedDurationSecs);
  const elapsedSecs = Math.min(totalSecs, timerState.accumulatedElapsedSecs);
  const progressPercent = Math.min(100, Math.max(0, (elapsedSecs / totalSecs) * 100));

  const subject = timerState.activeSubject || timerState.activeLecture?.subject || 'Focus Session';
  const title = timerState.activeLecture?.title || `${subject} Deep Work`;

  const sessionExamId = timerState.examId || timerState.activeLecture?.examId;
  const allExams = db.getExams();
  const sessionExam = allExams.find((e) => e.id === sessionExamId);
  const isDifferentFromActiveExam = Boolean(sessionExamId && sessionExamId !== activeWorkspaceExamId);

  const handleExpand = () => {
    if (onOpenLauncher) {
      onOpenLauncher();
    } else if (onOpenFullModal) {
      onOpenFullModal();
    }
  };

  return (
    <div className="focus-launcher-container fixed bottom-0 left-0 right-0 z-50 bg-white/95 border-t border-purple-200/80 shadow-2xl backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 animate-fadeIn text-slate-900 transition-all">
      {/* Left: Status & Lecture Details */}
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Pulsing indicator */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-3 h-3 rounded-full ${
              isRunning ? 'bg-emerald-400 animate-ping opacity-75' : 'bg-amber-400'
            }`}
          />
          <div
            className={`absolute w-2.5 h-2.5 rounded-full ${
              isRunning ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        </div>

        {/* Badge & Title */}
        <div className="flex items-center space-x-2 truncate">
          {sessionExam && (
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                isDifferentFromActiveExam
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                  : 'bg-purple-100 text-purple-800 border border-purple-200'
              }`}
              title={isDifferentFromActiveExam ? `This focus timer is permanently bound to "${sessionExam.title}"` : `Exam: ${sessionExam.title}`}
            >
              <Award className="w-3 h-3" />
              <span>{sessionExam.title}</span>
              {isDifferentFromActiveExam && <span className="text-[9px] font-extrabold text-amber-700">(Running)</span>}
            </span>
          )}

          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
            {subject}
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-800 truncate max-w-[180px] sm:max-w-[300px] md:max-w-[420px]">
            {title}
          </span>
          {timerState.activeLecture?.priority && (
            <span
              className={`hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-black rounded ${
                timerState.activeLecture.priority === 'High'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}
            >
              {timerState.activeLecture.priority}
            </span>
          )}
        </div>
      </div>

      {/* Center: Countdown & Progress bar */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="flex items-center space-x-1.5 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
          <Clock className={`w-4 h-4 ${isRunning ? 'text-indigo-600 animate-pulse' : 'text-slate-500'}`} />
          <span className="font-mono text-base sm:text-lg font-black text-indigo-700 tracking-wider">
            {formatTime(timerState.secondsLeft)}
          </span>
        </div>

        {/* Mini progress bar */}
        <div className="hidden md:flex flex-col w-28 gap-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-mono font-bold">
            <span>{Math.round(progressPercent)}%</span>
            <span>{Math.round(totalSecs / 60)}m</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center space-x-1.5 shrink-0">
        {/* Play / Pause */}
        <button
          onClick={() => focusTimerService.toggleTimer()}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer ${
            isRunning
              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
              : 'bg-emerald-600 text-white font-bold hover:bg-emerald-700'
          }`}
          title={isRunning ? 'Pause Timer' : 'Resume Timer'}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? 'Pause' : 'Resume'}</span>
        </button>

        {/* Complete / Finish */}
        <button
          onClick={() => focusTimerService.completeSession(true)}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm cursor-pointer"
          title="Complete Lecture Session"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Finish</span>
        </button>

        {/* Expand Modal / Launcher */}
        {(onOpenLauncher || onOpenFullModal) && (
          <button
            onClick={handleExpand}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Expand Full Focus Canvas"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        {/* Cancel */}
        <button
          onClick={() => {
            if (window.confirm('Cancel active focus session? Partial time will be logged.')) {
              focusTimerService.cancelSession();
            }
          }}
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          title="Cancel Session"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
