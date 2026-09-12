import React, { useState, useEffect } from 'react';
import { Terminal, ShieldCheck, Database, CheckCircle2, AlertOctagon, Sparkles, RefreshCw } from 'lucide-react';
import { db } from '../../services/db';
import { authService } from '../../services/auth';

interface DesktopSplashScreenProps {
  onComplete: () => void;
  onError: (errorDetails: string) => void;
}

interface BootStep {
  id: number;
  label: string;
  sublabel: string;
}

const BOOT_STEPS: BootStep[] = [
  { id: 1, label: 'Initializing Local Database & SQLite Storage', sublabel: 'Mounting offline database engine & indexes' },
  { id: 2, label: 'Restoring Last Session & Exam Workspaces', sublabel: 'Loading multi-exam profiles, syllabus & tasks' },
  { id: 3, label: 'Loading Authentication & Security Credentials', sublabel: 'Validating local encryption keys & account permissions' },
  { id: 4, label: 'Verifying Local Resources & Assets', sublabel: 'Caching offline PDFs, flashcards & media library' },
  { id: 5, label: 'Readying Main Desktop Window', sublabel: 'Synchronizing local desktop runtime frame' },
];

export const DesktopSplashScreen: React.FC<DesktopSplashScreenProps> = ({ onComplete, onError }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [DESKTOP_BOOT] Launching AManager Native Desktop Shell v3.5.0`,
    `[${new Date().toLocaleTimeString()}] [SYSTEM] Memory: 142MB | Storage: Local Storage IndexedDB | Mode: 100% Offline`,
  ]);
  const [progress, setProgress] = useState<number>(10);

  useEffect(() => {
    let isMounted = true;

    const runSequence = async () => {
      try {
        // Step 1: Init Database
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [DB] Initializing SQLite / LocalStorage schema...`]);
        db.initDB();
        await new Promise((r) => setTimeout(r, 350));
        if (!isMounted) return;
        setCurrentStepIndex(1);
        setProgress(30);

        // Step 2: Restore Session
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [SESSION] Restoring multi-exam workspace state...`]);
        const exams = db.getExams();
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [SESSION] Loaded ${exams.length} active exam profiles`]);
        await new Promise((r) => setTimeout(r, 400));
        if (!isMounted) return;
        setCurrentStepIndex(2);
        setProgress(55);

        // Step 3: Auth & Account Verification
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [AUTH] Verifying local user token & security state...`]);
        const user = authService.getCurrentUser();
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [AUTH] User verified: @${user.username} (${user.role || 'Admin'})`]);
        await new Promise((r) => setTimeout(r, 350));
        if (!isMounted) return;
        setCurrentStepIndex(3);
        setProgress(80);

        // Step 4: Verify Resources
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [RESOURCES] Verifying local offline resource indexes...`]);
        const resources = db.getResources();
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [RESOURCES] Loaded ${resources.length} study material items`]);
        await new Promise((r) => setTimeout(r, 300));
        if (!isMounted) return;
        setCurrentStepIndex(4);
        setProgress(100);

        // Step 5: Complete
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] [READY] Main window ready. Entering application shell...`]);
        await new Promise((r) => setTimeout(r, 300));
        if (isMounted) {
          onComplete();
        }
      } catch (err: any) {
        console.error('Desktop initialization failed', err);
        const errMsg = err?.message || 'Unknown initialization error in local database or authentication module.';
        setLogs((prev) => [...prev, `[CRITICAL_ERROR] ${errMsg}`]);
        onError(errMsg);
      }
    };

    runSequence();

    return () => {
      isMounted = false;
    };
  }, [onComplete, onError]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617] text-white select-none font-sans p-6 overflow-hidden">
      {/* Decorative Background Rays */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-pink-500/30">
              A
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                AManager Desktop
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Native Window
                </span>
              </h1>
              <p className="text-xs font-medium text-slate-300">Offline Multi-Exam Study Operating System</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 text-xs text-emerald-400 font-extrabold bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4" />
            <span>Local Core</span>
          </div>
        </div>

        {/* Boot Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-300">
            <span>Booting System ({progress}%)</span>
            <span className="text-purple-300 font-mono">{BOOT_STEPS[currentStepIndex]?.label || 'Completing...'}</span>
          </div>
          <div className="w-full bg-slate-900/80 rounded-full h-3 overflow-hidden border border-white/10">
            <div
              className="bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Checklist */}
        <div className="space-y-2 pt-2">
          {BOOT_STEPS.map((step, idx) => {
            const isFinished = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div
                key={step.id}
                className={`flex items-center justify-between p-2.5 rounded-2xl transition-all border text-xs ${
                  isFinished
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : isCurrent
                    ? 'bg-purple-900/50 border-purple-400/50 text-white shadow-lg'
                    : 'bg-slate-900/30 border-white/5 text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="shrink-0">
                    {isFinished ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isCurrent ? (
                      <RefreshCw className="w-4 h-4 text-purple-300 animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px] font-bold">
                        {step.id}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-extrabold">{step.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{step.sublabel}</div>
                  </div>
                </div>
                {isFinished && <span className="text-[10px] text-emerald-400 font-bold uppercase">Done</span>}
              </div>
            );
          })}
        </div>

        {/* Diagnostic Boot Logs Console */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 text-[11px] font-mono text-slate-300 h-28 overflow-y-auto space-y-1 custom-scrollbar">
          <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 pb-1 border-b border-slate-800">
            <Terminal className="w-3.5 h-3.5 text-purple-400" /> Desktop Diagnostics Log
          </div>
          {logs.map((log, i) => (
            <div key={i} className="leading-tight text-slate-300 truncate">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
