import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, Flame, CheckCircle, Coffee, Clock, Settings2, FastForward, CheckCircle2, Volume2, VolumeX, Sparkles, MessageSquare, Bell, Gamepad2 } from 'lucide-react';
import { db } from '../../services/db';
import { GlassCard } from '../shared/GlassCard';
import { workspaceStateService } from '../../services/workspaceStateService';
import { pomodoroTimerService, PomodoroTimerState } from '../../services/pomodoroTimerService';
import { studyCoachService } from '../../services/studyCoachService';
import { PostSessionReflectionModal } from './PostSessionReflectionModal';
import { BrainGameContainer } from './BrainGameContainer';

interface PomodoroTimerWidgetProps {
  onSessionComplete?: (type: string, minutes: number) => void;
  compact?: boolean;
  activeTab?: string;
}

export const PomodoroTimerWidget: React.FC<PomodoroTimerWidgetProps> = ({
  onSessionComplete,
  compact = false,
  activeTab = 'dashboard',
}) => {
  const [timerState, setTimerState] = useState<PomodoroTimerState>(() => pomodoroTimerService.getState());
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [isExitingBreak, setIsExitingBreak] = useState<boolean>(false);
  const [focusInput, setFocusInput] = useState<number>(timerState.focusMinutes);
  const [breakInput, setBreakInput] = useState<number>(timerState.breakMinutes);
  const [autoResumeFocus, setAutoResumeFocus] = useState<boolean>(() => {
    return db.getSettings().pomodoroBreakConfig?.autoResumeStudy ?? true;
  });
  const [breakTab, setBreakTab] = useState<'recommendations' | 'game'>(() => {
    const cfg = db.getSettings().pomodoroBreakConfig;
    return cfg?.autoLaunchGames ? 'game' : 'recommendations';
  });

  // Study Coach States
  const [coachBanner, setCoachBanner] = useState<{ text: string; type: string } | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => db.getSettings().studyCoachConfig?.muted ?? false);
  const [reflectionModalMins, setReflectionModalMins] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = pomodoroTimerService.subscribe((newState) => {
      setTimerState(newState);
    });
    const unsubBanner = studyCoachService.subscribeBanner((banner) => {
      setCoachBanner(banner);
    });

    const handleOpenReflection = (e: any) => {
      if (e.detail?.durationMins) {
        setReflectionModalMins(e.detail.durationMins);
      }
    };

    window.addEventListener('studyos_open_post_session_modal', handleOpenReflection);

    return () => {
      unsubscribe();
      unsubBanner();
      window.removeEventListener('studyos_open_post_session_modal', handleOpenReflection);
    };
  }, []);

  const { mode, isRunning, secondsLeft, targetDurationSecs, completedSessions, focusMinutes, breakMinutes } = timerState;

  const applyPreset = (focusMins: number, breakMins: number) => {
    pomodoroTimerService.setDurations(focusMins, breakMins);
    setFocusInput(focusMins);
    setBreakInput(breakMins);
  };

  const handleModeChange = (newMode: 'focus' | 'shortBreak' | 'longBreak') => {
    if (newMode === 'shortBreak' || newMode === 'longBreak') {
      workspaceStateService.captureSnapshot(activeTab);
      setIsExitingBreak(false);
      pomodoroTimerService.setMode(newMode);
    } else {
      pomodoroTimerService.setMode('focus');
      workspaceStateService.restoreSnapshot();
    }
  };

  const handleSkipBreak = () => {
    setIsExitingBreak(true);
    setTimeout(() => {
      setIsExitingBreak(false);
      pomodoroTimerService.skipBreak();
      studyCoachService.cancelReminders();
      if (onSessionComplete) {
        onSessionComplete('Break Skipped. Study Workspace Restored.', 0);
      }
    }, 280);
  };

  const toggleMuteCoach = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    const settings = db.getSettings();
    db.setSettings({
      ...settings,
      studyCoachConfig: {
        ...(settings.studyCoachConfig || {
          enabled: true,
          volume: 85,
          muted: false,
          repeatIntervalMinutes: 5,
          welcomeOnStart: true,
          encourageOnFinish: true,
        }),
        muted: nextMute,
      },
    });
    if (nextMute) {
      studyCoachService.stopAudio();
    }
  };

  const toggleTimer = () => pomodoroTimerService.toggleTimer();
  const resetTimer = () => pomodoroTimerService.resetTimer();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const percentProgress = Math.round(((targetDurationSecs - secondsLeft) / (targetDurationSecs || 1)) * 100);

  if (compact) {
    return (
      <>
        <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-md border border-purple-200/80 rounded-xl px-3 py-1.5 shadow-xs">
          <Clock className="w-4 h-4 text-purple-600" />
          <span className="font-mono text-xs font-black text-slate-900">{formatTime(secondsLeft)}</span>
          <button
            onClick={toggleTimer}
            className={`p-1 rounded-lg text-white text-xs font-bold bg-gradient-to-r ${
              mode === 'focus' ? 'from-purple-600 to-pink-600' : 'from-emerald-500 to-teal-600'
            } hover:opacity-90 shadow-xs`}
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            onClick={toggleMuteCoach}
            className={`p-1 rounded-lg font-bold text-xs ${isMuted ? 'text-slate-400' : 'text-purple-700 hover:bg-purple-100'}`}
            title={isMuted ? 'Unmute Offline Study Coach' : 'Mute Offline Study Coach'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {reflectionModalMins && (
          <PostSessionReflectionModal
            durationMins={reflectionModalMins}
            onClose={() => setReflectionModalMins(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <GlassCard className="p-5 relative overflow-hidden flex flex-col justify-between select-none">
        {/* Background Subtle Ambient Glow */}
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-100 rounded-full blur-2xl pointer-events-none opacity-60" />

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Pomodoro Study Engine</h3>
                <p className="text-[11px] text-slate-500 font-medium">Offline Study Coach Mentor Voice Reminders</p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={toggleMuteCoach}
                className={`p-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 shadow-2xs transition-all cursor-pointer ${
                  isMuted ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                }`}
                title={isMuted ? 'Study Coach Muted' : 'Study Coach Active'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-purple-600" />}
                <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Coach On'}</span>
              </button>
              <span className="text-[11px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-purple-600" /> {completedSessions}
              </span>
            </div>
          </div>

          {/* Presets Bar */}
          <div className="flex items-center justify-between bg-slate-100/90 p-1.5 rounded-2xl mb-3 text-[11px] font-extrabold">
            <button
              onClick={() => applyPreset(25, 5)}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                focusMinutes === 25 && breakMinutes === 5 ? 'bg-white text-purple-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              25/5
            </button>
            <button
              onClick={() => applyPreset(50, 10)}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                focusMinutes === 50 && breakMinutes === 10 ? 'bg-white text-purple-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              50/10
            </button>
            <button
              onClick={() => applyPreset(60, 10)}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                focusMinutes === 60 && breakMinutes === 10 ? 'bg-white text-purple-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              60/10
            </button>
            <button
              onClick={() => applyPreset(90, 15)}
              className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                focusMinutes === 90 && breakMinutes === 15 ? 'bg-white text-purple-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              90/15
            </button>
            <button
              onClick={() => setShowCustomModal(true)}
              className="p-1 rounded-lg hover:bg-white text-purple-700 font-black flex items-center cursor-pointer"
              title="Custom Timer Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100/80 p-1 rounded-xl mb-3 text-xs font-extrabold">
            <button
              onClick={() => handleModeChange('focus')}
              className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                mode === 'focus' ? 'bg-white text-purple-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {focusMinutes}m Study
            </button>
            <button
              onClick={() => handleModeChange('shortBreak')}
              className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                mode === 'shortBreak' ? 'bg-white text-emerald-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {breakMinutes}m Break
            </button>
            <button
              onClick={() => handleModeChange('longBreak')}
              className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                mode === 'longBreak' ? 'bg-white text-purple-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Long Break
            </button>
          </div>

          {/* COACH REMINDER BANNER (If Active) */}
          {coachBanner && (
            <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold shadow-md flex items-start justify-between gap-2 animate-fadeIn">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-purple-200">Study Coach Voice Reminder</div>
                  <p className="text-xs font-medium leading-snug">{coachBanner.text}</p>
                </div>
              </div>
              <button
                onClick={() => studyCoachService.dismissBanner()}
                className="text-white/80 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Timer Display */}
          <div className="text-center py-1">
            <div className="text-4xl font-black font-mono tracking-wider text-slate-900 mb-2">
              {formatTime(secondsLeft)}
            </div>
            <div className="w-full bg-slate-100/80 rounded-full h-2.5 overflow-hidden mb-3 border border-purple-100">
              <div
                className={`h-full transition-all duration-300 ${
                  mode === 'focus' ? 'bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e]' : 'bg-gradient-to-r from-emerald-500 to-teal-600'
                }`}
                style={{ width: `${percentProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={toggleTimer}
              className={`flex-1 py-2.5 px-4 rounded-xl text-white font-black text-xs flex items-center justify-center space-x-2 shadow-md hover:opacity-95 active:scale-98 transition-all cursor-pointer ${
                mode === 'focus' ? 'bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e]' : 'bg-gradient-to-r from-emerald-500 to-teal-600'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4" /> <span>Pause Cycle</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> <span>Start {mode === 'focus' ? 'Focus' : 'Break'} Cycle</span>
                </>
              )}
            </button>
            <button
              onClick={resetTimer}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => pomodoroTimerService.startBreakStopwatch()}
            className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Coffee className="w-3.5 h-3.5 text-emerald-600" />
            <span>Take Break (Stopwatch Mode)</span>
          </button>
        </div>

        {/* FULL SCREEN BREAK MODE OVERLAY (PORTAL AT ROOT BODY) - PROJECT THEME */}
        {(mode === 'shortBreak' || mode === 'longBreak') &&
          createPortal(
            <div
              className={`fixed inset-0 z-[99999] top-0 left-0 w-screen h-screen bg-gradient-to-br from-[#fdf2f8] via-[#f5f3ff] to-[#f0f9ff] text-slate-900 backdrop-blur-3xl flex flex-col justify-between p-6 sm:p-10 font-sans select-none overflow-y-auto ${
                isExitingBreak ? 'animate-breakExit' : 'animate-breakEnter'
              }`}
            >
              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border border-purple-200/80 bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-md shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
                    <Coffee className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-0.5 rounded-full shadow-2xs">
                        Full-Screen Recovery Rest
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">• Workspace Paused</span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                      {mode === 'shortBreak' ? 'Short Recovery Break' : 'Long Recharging Break'}
                    </h2>
                  </div>
                </div>

                {/* Countdown & Session Info */}
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {timerState.breakStopwatchActive ? 'Break Stopwatch Elapsed' : 'Break Timer Remaining'}
                    </div>
                    <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-600 tracking-wider drop-shadow-xs">
                      {timerState.breakStopwatchActive
                        ? formatTime(timerState.breakElapsedSecs || 0)
                        : formatTime(secondsLeft)}
                    </div>
                  </div>

                  <div className="text-right border-l border-purple-200/80 pl-4 sm:pl-6 hidden md:block">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Completed Sessions</div>
                    <div className="text-xl sm:text-2xl font-mono font-black text-purple-700">
                      Session #{completedSessions + 1}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!timerState.breakStopwatchActive && (
                      <button
                        onClick={toggleTimer}
                        className={`p-3 rounded-2xl text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                          isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isRunning ? 'Pause Break' : 'Resume Break'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => pomodoroTimerService.stopBreakAndResumeFocus()}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-xs font-black text-white transition-all shadow-md flex items-center gap-2 cursor-pointer hover:opacity-95 animate-pulse"
                      title="Stop Break and Resume Focus Timer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Stop Break & Resume Focus</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Break Coach & Break Contextualizer / Brain Games Display */}
              <div className="flex-1 my-auto flex flex-col justify-center items-center text-center p-4 sm:p-6 max-w-3xl mx-auto space-y-5 w-full">
                {/* Break Mode Tab Selector */}
                <div className="flex items-center justify-center gap-2 bg-white/90 p-1.5 rounded-2xl border border-purple-200/80 shadow-xs">
                  <button
                    onClick={() => setBreakTab('recommendations')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      breakTab === 'recommendations'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🌱 Rest & Recommendations</span>
                  </button>
                  <button
                    onClick={() => setBreakTab('game')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      breakTab === 'game'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Gamepad2 className="w-4 h-4" />
                    <span>🎮 Brain Games Kiosk</span>
                  </button>
                </div>

                {breakTab === 'game' ? (
                  <div className="w-full max-w-2xl mx-auto">
                    <BrainGameContainer
                      defaultGame={db.getSettings().pomodoroBreakConfig?.defaultGame || '2048'}
                      difficulty={db.getSettings().pomodoroBreakConfig?.difficulty || 'medium'}
                      muteSounds={db.getSettings().pomodoroBreakConfig?.muteSounds || false}
                    />
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-100 to-teal-50 border border-emerald-200 text-emerald-700 shadow-md">
                      <Sparkles className="w-10 h-10 animate-pulse" />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-black uppercase tracking-widest text-purple-700 bg-purple-100 border border-purple-200 px-3 py-1 rounded-full">
                        Offline Recovery Coach Active
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        Rest Your Mind & Recharge Focus
                      </h3>
                      <p className="text-slate-600 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                        When your break finishes, your coach will trigger audio cues and auto-resume options.
                      </p>
                    </div>

                    {/* BREAK CONTEXTUALIZER RECOMMENDED ACTIVITIES */}
                    <div className="w-full bg-white/90 backdrop-blur-xl border border-purple-200/80 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3 text-left">
                      <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs">🌱</span>
                          <span className="font-black text-xs text-slate-900 uppercase tracking-wider">
                            Break Contextualizer Recommendations
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                          Tailored for {focusMinutes}m Focus Session
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {focusMinutes <= 30 && (
                          <>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>💧</span> Hydration & Eye Rest
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Drink 250ml water and look at an object 20ft away for 20s.
                              </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>🧘</span> Neck & Wrist Release
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Gently rotate neck clockwise and roll wrists to relieve typing stress.
                              </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>🚶</span> Standing Reach
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Stand up, reach high towards ceiling, and take 3 deep belly breaths.
                              </p>
                            </div>
                          </>
                        )}

                        {focusMinutes > 30 && focusMinutes <= 60 && (
                          <>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>🌬️</span> 4-7-8 Diaphragmatic Breath
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Inhale 4s, hold 7s, exhale 8s. Repeat 3 times to calm brain waves.
                              </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>🚶</span> Room Walk & Spine Align
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Walk around your study area, shake out arms, and align posture.
                              </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>💧</span> Water Refill & Shoulders
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Refill your water bottle and roll shoulders backwards 10 times.
                              </p>
                            </div>
                          </>
                        )}

                        {focusMinutes > 60 && (
                          <>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>🧘</span> Deep Spine & Hamstrings
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Spend 2 mins gently stretching hamstrings, lower back, and hips.
                              </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>🍃</span> Daylight Exposure
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Step near a window or balcony to expose eyes to natural light.
                              </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                              <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>🍵</span> Herbal Tea & Disconnect
                              </div>
                              <p className="text-[11px] text-slate-600 leading-snug">
                                Step away from all screens to allow complete memory consolidation.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Coach Banner inside Portal */}
                {coachBanner && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200 text-purple-950 text-xs font-semibold shadow-md text-left flex items-start gap-3 w-full">
                    <MessageSquare className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Active Coach Mentor Prompt</div>
                      <p className="text-sm font-medium mt-0.5">{coachBanner.text}</p>
                    </div>
                  </div>
                )}

                <div className="pt-1 flex items-center gap-4">
                  <button
                    onClick={toggleMuteCoach}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold border flex items-center gap-2 cursor-pointer transition-all ${
                      isMuted ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span>{isMuted ? 'Voice Muted' : 'Voice Enabled (100% Offline)'}</span>
                  </button>

                  <button
                    onClick={handleSkipBreak}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white font-black text-xs shadow-md hover:opacity-95 transition-all cursor-pointer"
                  >
                    Start Focus Session Now
                  </button>
                </div>
              </div>

              {/* Footer Bar */}
              <div className="border-t border-purple-200/80 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono shrink-0">
                <span className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Workspace auto-restores when focus session starts
                </span>
                <div className="flex items-center gap-3">
                  <span>Session #{completedSessions + 1}</span>
                  <span>•</span>
                  <button
                    onClick={handleSkipBreak}
                    className="text-purple-700 hover:text-purple-900 underline font-bold cursor-pointer"
                  >
                    Skip Break & Resume Study Workspace
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Custom Duration Modal */}
        {showCustomModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-purple-100">
              <h3 className="text-base font-black text-slate-900">Custom Pomodoro Durations</h3>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-600 block mb-1">Focus Study Duration (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={focusInput}
                    onChange={(e) => setFocusInput(parseInt(e.target.value) || 25)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-600 block mb-1">Break Duration (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={breakInput}
                    onChange={(e) => setBreakInput(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="pt-1 space-y-2 border-t border-slate-100">
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoResumeFocus}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAutoResumeFocus(val);
                        const cur = db.getSettings();
                        db.setSettings({
                          ...cur,
                          pomodoroBreakConfig: {
                            ...(cur.pomodoroBreakConfig || {
                              autoLaunchGames: false,
                              defaultGame: '2048',
                              randomizeGames: false,
                              difficulty: 'medium',
                              autoResumeStudy: true,
                              allowSkipBreak: true,
                              muteSounds: false,
                              breakTheme: 'dark',
                            }),
                            autoResumeStudy: val,
                          },
                        });
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span>Auto-start focus timer when break ends</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    applyPreset(focusInput, breakInput);
                    setShowCustomModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-black shadow-xs cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Post-Session Reflection Modal */}
      {reflectionModalMins && (
        <PostSessionReflectionModal
          durationMins={reflectionModalMins}
          onClose={() => setReflectionModalMins(null)}
          onShowNotification={onSessionComplete ? (msg, title) => onSessionComplete(msg, reflectionModalMins) : undefined}
        />
      )}
    </>
  );
};
