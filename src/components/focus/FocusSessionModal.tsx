import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  BookOpen,
  Clock,
  Minimize2,
  FileText,
  Flame,
  Coffee,
  Check,
} from 'lucide-react';
import { focusTimerService, FocusTimerEngineState } from '../../services/focusTimerService';

interface FocusSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const FocusSessionModal: React.FC<FocusSessionModalProps> = ({ isOpen, onClose }) => {
  const [timerState, setTimerState] = useState<FocusTimerEngineState>(() => focusTimerService.getState());
  const [notes, setNotes] = useState('');
  const [ambientSound, setAmbientSound] = useState<'off' | 'rain' | 'whitenoise' | 'cafe'>('off');
  const [celebrationData, setCelebrationData] = useState<{
    lectureTitle: string;
    subject: string;
    durationMins: number;
    focusPercentage: number;
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  useEffect(() => {
    const unsub = focusTimerService.subscribe((s) => setTimerState(s));

    const handleCelebrate = (e: any) => {
      setCelebrationData(e.detail);
    };
    window.addEventListener('studyos_focus_session_celebrate', handleCelebrate);

    return () => {
      unsub();
      window.removeEventListener('studyos_focus_session_celebrate', handleCelebrate);
      stopAmbient();
    };
  }, []);

  const stopAmbient = () => {
    try {
      if (noiseNodeRef.current) {
        (noiseNodeRef.current as any).stop?.();
        noiseNodeRef.current.disconnect();
        noiseNodeRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch {
      /* ignore */
    }
  };

  const playAmbient = (type: 'rain' | 'whitenoise' | 'cafe') => {
    stopAmbient();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      if (type === 'whitenoise') {
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
      } else if (type === 'rain') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      } else {
        // Cafe / Soft Brown noise
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);

      whiteNoise.connect(gainNode);
      gainNode.connect(ctx.destination);

      whiteNoise.start(0);
      noiseNodeRef.current = whiteNoise;
      setAmbientSound(type);
    } catch {
      /* ignore */
    }
  };

  if (!isOpen) return null;

  const isRunning = timerState.status === 'running';
  const totalSecs = Math.max(1, timerState.plannedDurationSecs);
  const elapsedSecs = Math.min(totalSecs, timerState.accumulatedElapsedSecs);
  const progressPercent = Math.min(100, Math.max(0, (elapsedSecs / totalSecs) * 100));

  const subject = timerState.activeSubject || timerState.activeLecture?.subject || 'Focus Mode';
  const title = timerState.activeLecture?.title || `${subject} Deep Study Session`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fadeIn text-slate-900">
      {/* CELEBRATION MODAL OVERLAY */}
      {celebrationData && (
        <div className="absolute inset-0 z-60 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-indigo-200 text-center space-y-6 shadow-2xl animate-scaleUp">
            <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mx-auto shadow-md">
              <Sparkles className="w-10 h-10 text-indigo-600 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-700">
                Session Accomplished!
              </span>
              <h2 className="text-2xl font-black text-slate-900">
                {celebrationData.lectureTitle}
              </h2>
              <p className="text-xs text-slate-600">
                Completed {celebrationData.durationMins} minutes of uninterrupted study in {celebrationData.subject}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] text-emerald-800 block uppercase font-bold">Focus Score</span>
                <span className="text-lg font-black text-emerald-700">{celebrationData.focusPercentage}%</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
                <span className="text-[10px] text-indigo-800 block uppercase font-bold">Study Logged</span>
                <span className="text-lg font-black text-indigo-700">{celebrationData.durationMins}m</span>
              </div>
            </div>

            <button
              onClick={() => {
                setCelebrationData(null);
                onClose();
              }}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Main Focus Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Control Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
              {subject}
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">
              Planned: {Math.round(totalSecs / 60)}m
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Ambient Sound Selector */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => {
                  if (ambientSound !== 'off') {
                    stopAmbient();
                    setAmbientSound('off');
                  } else {
                    playAmbient('rain');
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  ambientSound !== 'off' ? 'text-indigo-700 bg-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Toggle Ambient Audio"
              >
                {ambientSound !== 'off' ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              {ambientSound !== 'off' && (
                <div className="flex items-center space-x-1 pr-1 text-[11px]">
                  <button
                    onClick={() => playAmbient('rain')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${ambientSound === 'rain' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    Rain
                  </button>
                  <button
                    onClick={() => playAmbient('whitenoise')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${ambientSound === 'whitenoise' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    White Noise
                  </button>
                  <button
                    onClick={() => playAmbient('cafe')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${ambientSound === 'cafe' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:bg-slate-200'}`}
                  >
                    Cafe
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Minimize to Persistent Bar"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Center: Giant Countdown Clock & Progress Ring */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 flex flex-col items-center justify-center space-y-6 text-center">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 max-w-xl">
              {title}
            </h2>
            <p className="text-xs text-slate-500">
              Focus mode is active. Keep this screen or navigate freely across StudyOS while the timer persists.
            </p>
          </div>

          {/* Giant Countdown Display */}
          <div className="relative p-8 rounded-full bg-slate-50 border-4 border-indigo-100 shadow-inner flex flex-col items-center justify-center w-64 h-64 sm:w-72 sm:h-72">
            <span className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-indigo-700">
              {formatTime(timerState.secondsLeft)}
            </span>
            <span className="text-xs font-bold text-slate-500 mt-2 tracking-wide">
              {isRunning ? 'FOCUSING' : 'PAUSED'}
            </span>
            <div className="w-36 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-teal-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-500 mt-1">
              {Math.round(progressPercent)}% elapsed
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => focusTimerService.toggleTimer()}
              className={`px-6 py-3.5 rounded-2xl font-black text-sm flex items-center space-x-2 transition-all shadow-md cursor-pointer ${
                isRunning
                  ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                  : 'bg-emerald-600 text-white font-bold hover:bg-emerald-700'
              }`}
            >
              {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{isRunning ? 'Pause Timer' : 'Resume Timer'}</span>
            </button>

            <button
              onClick={() => focusTimerService.completeSession(true)}
              className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Finish & Log</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Cancel session? Partial time will be logged.')) {
                  focusTimerService.cancelSession();
                  onClose();
                }
              }}
              className="px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Quick Scratchpad / Session Notes */}
          <div className="w-full max-w-xl text-left space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              Session Notes & Key Learnings
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jot down quick thoughts, formulas, or tricky problems encountered..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
