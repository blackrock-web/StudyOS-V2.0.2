import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  Trash2,
  Lock,
  Key,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileX,
  Database,
  Cpu,
  FolderX,
} from 'lucide-react';
import { destructionService } from '../../services/destruction/DestructionService';
import { DestructionProgressState } from '../../types';

interface Props {
  onShowNotification: (msg: string, title?: string) => void;
}

export const DangerZoneDestructionPanel: React.FC<Props> = ({ onShowNotification }) => {
  const [destructionState, setDestructionState] = useState<DestructionProgressState>(destructionService.getState());
  const [step, setStep] = useState<'idle' | 'warning' | 'pin_auth' | 'confirm_text' | 'executing' | 'completed'>('idle');
  const [pinInput, setPinInput] = useState('');
  const [confirmTextInput, setConfirmTextInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = destructionService.subscribe((s) => {
      setDestructionState(s);
      if (s.phase === 'completed') {
        setStep('completed');
      }
    });
    return () => unsub();
  }, []);

  const handleStartFlow = () => {
    setStep('warning');
    setErrorMessage(null);
  };

  const handleProceedToPin = () => {
    setStep('pin_auth');
    setErrorMessage(null);
  };

  const handleProceedToConfirmText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setErrorMessage('Please enter your Security PIN.');
      return;
    }
    setStep('confirm_text');
    setErrorMessage(null);
  };

  const handleExecuteDestruction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmTextInput.trim() !== 'DESTROY') {
      setErrorMessage('Please type DESTROY in all capital letters to proceed.');
      return;
    }

    setStep('executing');
    setErrorMessage(null);

    const res = await destructionService.executeCompleteDestruction(
      pinInput,
      confirmTextInput.trim()
    );

    if (!res.ok) {
      setErrorMessage(res.error || 'Destruction failed');
      setStep('pin_auth');
    }
  };

  const handleResetAppToFresh = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Primary Card */}
      <div className="bg-white p-6 rounded-3xl border-2 border-rose-200 shadow-xs space-y-6">
        <div className="border-b border-rose-100 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-rose-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-600 animate-pulse" /> Danger Zone: Complete Application Destruction
            </h3>
            <p className="text-xs text-rose-600/80 font-medium mt-0.5">
              Permanently and irreversibly obliterate all application binaries, databases, downloaded AI models, and host shortcuts.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
            NUCLEAR PURGE
          </span>
        </div>

        {/* Step 0: Idle State */}
        {step === 'idle' && (
          <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                Permanent Application Eradication
              </div>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                If you are decommissioning this machine, completing your GATE exams, or transferring hardware, this tool will completely clean and delete every single file, model, and database created by StudyOS Desktop.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartFlow}
              className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 transition-all shrink-0 cursor-pointer active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Destroy Application
            </button>
          </div>
        )}

        {/* Step 1: Warning Checklist */}
        {step === 'warning' && (
          <div className="space-y-5 p-5 rounded-2xl bg-rose-50 border border-rose-200 animate-in fade-in">
            <div className="flex items-center gap-2 text-rose-900 font-black text-base">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Step 1/3: Destruction Scope & Impact Warning
            </div>

            <p className="text-xs text-rose-800 font-medium leading-relaxed">
              This action is <strong>IRREVERSIBLE</strong>. Executing this will completely wipe:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-rose-200 flex items-start gap-2.5">
                <Database className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">SQLite & Notes Databases</div>
                  <div className="text-[11px] text-slate-500">All local notes, formulas, test results, and flashcards</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-rose-200 flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Local AI Models & Weights</div>
                  <div className="text-[11px] text-slate-500">All GGUF weights, embeddings, and caches (~/.studyos)</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-rose-200 flex items-start gap-2.5">
                <FolderX className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Application Binaries & Folders</div>
                  <div className="text-[11px] text-slate-500">All installed executables, modules, and dependencies</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-rose-200 flex items-start gap-2.5">
                <FileX className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Launchers & Desktop Shortcuts</div>
                  <div className="text-[11px] text-slate-500">Start menu entries, .desktop files, icon caches</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToPin}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                I Understand — Continue to PIN
              </button>
            </div>
          </div>
        )}

        {/* Step 2: PIN Authentication */}
        {step === 'pin_auth' && (
          <form onSubmit={handleProceedToConfirmText} className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 animate-in fade-in max-w-lg">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Key className="w-4 h-4 text-purple-600" />
              Step 2/3: Enter Security PIN to Authorize
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Security PIN</label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-6 digit PIN"
                autoFocus
                className="w-full p-3 text-sm font-mono tracking-widest bg-white border border-slate-200 rounded-xl focus:border-rose-600"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('warning')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                Verify PIN & Proceed
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Type DESTROY */}
        {step === 'confirm_text' && (
          <form onSubmit={handleExecuteDestruction} className="space-y-4 p-5 rounded-2xl bg-rose-50 border border-rose-300 animate-in fade-in max-w-lg">
            <div className="flex items-center gap-2 text-rose-900 font-black text-sm">
              <AlertOctagon className="w-5 h-5 text-rose-600" />
              Step 3/3: Final Confirmation
            </div>

            <p className="text-xs text-rose-800 leading-relaxed">
              Please type <strong className="font-mono bg-rose-200 px-1.5 py-0.5 rounded text-rose-950">DESTROY</strong> in all capital letters to permanently wipe this application.
            </p>

            <div className="space-y-1.5">
              <input
                type="text"
                value={confirmTextInput}
                onChange={(e) => setConfirmTextInput(e.target.value)}
                placeholder="Type DESTROY here"
                autoFocus
                className="w-full p-3 text-sm font-mono font-bold tracking-wider bg-white border-2 border-rose-300 rounded-xl focus:border-rose-600 uppercase"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-xs text-rose-900 font-medium">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
              >
                Abort
              </button>
              <button
                type="submit"
                disabled={confirmTextInput !== 'DESTROY'}
                className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-40 text-white font-black text-xs shadow-lg shadow-rose-700/30 transition-all cursor-pointer"
              >
                EXECUTE NUCLEAR DESTRUCTION
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Executing Progress */}
        {step === 'executing' && (
          <div className="space-y-4 p-6 rounded-2xl bg-slate-900 text-white animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-rose-400">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                {destructionState.currentStep}
              </span>
              <span>{destructionState.percent}%</span>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 transition-all duration-300 rounded-full"
                style={{ width: `${destructionState.percent}%` }}
              />
            </div>

            <div className="space-y-1 text-[11px] font-mono text-slate-400 max-h-32 overflow-y-auto">
              {destructionState.deletedItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Deleted: {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Completed State */}
        {step === 'completed' && (
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 text-center space-y-4 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-emerald-900">Application Completely Destroyed</h4>
              <p className="text-xs text-emerald-700 mt-1">
                All SQLite databases, local models, caches, and configuration partitions have been wiped.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetAppToFresh}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              Start Fresh / Reload
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
