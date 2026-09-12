import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  Unlock,
  Eye,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  HelpCircle,
  Globe,
  Plus,
  Trash2,
  Laptop,
  Check,
  AlertTriangle,
  Monitor,
  Flame,
} from 'lucide-react';
import {
  appModeService,
  AppModeState,
  NamedAppMode,
  PER_PLATFORM_BLOCKABILITY,
} from '../../services/appModeService';

interface FocusModeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowNotification: (msg: string, title?: string) => void;
}

export const FocusModeManagerModal: React.FC<FocusModeManagerModalProps> = ({
  isOpen,
  onClose,
  onShowNotification,
}) => {
  const [modeState, setModeState] = useState<AppModeState>(() => appModeService.getState());
  const [selectedTab, setSelectedTab] = useState<'modes' | 'info_panel' | 'allowlist' | 'platform_table'>('modes');
  const [activePlatform, setActivePlatform] = useState<'windows' | 'macOS' | 'linux'>('windows');

  // Allowlist editor
  const [newDomain, setNewDomain] = useState('');
  const [allowlistDomains, setAllowlistDomains] = useState<string[]>(modeState.allowlist);

  // Manual unlock prompt state
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlockSecret, setUnlockSecret] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isVerifyingUnlock, setIsVerifyingUnlock] = useState(false);

  useEffect(() => {
    const unsub = appModeService.subscribe((s) => {
      setModeState(s);
      setAllowlistDomains(s.allowlist);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleActivateMode = async (mode: NamedAppMode) => {
    if (mode === modeState.activeMode) return;
    await appModeService.activateMode(mode, { allowlist: allowlistDomains });
    onShowNotification(
      `${appModeService.getModeTitle(mode)} activated successfully.`,
      'Focus Mode Assistance'
    );
  };

  const handleManualUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockSecret.trim()) {
      setUnlockError('Please enter your account PIN or password.');
      return;
    }

    setIsVerifyingUnlock(true);
    setUnlockError('');

    try {
      const res = await appModeService.deactivateModeWithAuth(unlockSecret);
      if (res.success) {
        setShowUnlockPrompt(false);
        setUnlockSecret('');
        onShowNotification('App Mode unlocked successfully.', 'Security Unlocked');
      } else {
        setUnlockError(res.message);
      }
    } catch {
      setUnlockError('An unexpected error occurred during verification.');
    } finally {
      setIsVerifyingUnlock(false);
    }
  };

  const handleAddDomain = () => {
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!clean) return;
    if (allowlistDomains.includes(clean)) {
      setNewDomain('');
      return;
    }
    const updated = [...allowlistDomains, clean];
    setAllowlistDomains(updated);
    appModeService.updateConfig({ allowlist: updated });
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    const updated = allowlistDomains.filter((d) => d !== domain);
    setAllowlistDomains(updated);
    appModeService.updateConfig({ allowlist: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-purple-900 via-slate-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <ShieldAlert className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight">StudyOS Focus Assistance Modes</h2>
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  App-Level Nudge
                </span>
              </div>
              <p className="text-xs text-purple-200 font-medium">
                Focus Mode (Light) • Kiosk Mode (Medium) • Exam Mode (Browser Lockdown)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {modeState.activeMode !== 'none' && (
              <button
                onClick={() => setShowUnlockPrompt(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Unlock & Exit ({appModeService.getModeTitle(modeState.activeMode)})</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-purple-200 hover:text-white hover:bg-white/10 transition-all text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 space-x-2 text-xs font-bold">
          <button
            onClick={() => setSelectedTab('modes')}
            className={`px-4 py-3 rounded-t-xl border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              selectedTab === 'modes'
                ? 'border-purple-600 text-purple-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4 text-purple-600" />
            <span>Active Modes</span>
          </button>

          <button
            onClick={() => setSelectedTab('info_panel')}
            className={`px-4 py-3 rounded-t-xl border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              selectedTab === 'info_panel'
                ? 'border-purple-600 text-purple-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4 text-indigo-600" />
            <span>Scope & Guarantees Panel</span>
          </button>

          <button
            onClick={() => setSelectedTab('allowlist')}
            className={`px-4 py-3 rounded-t-xl border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              selectedTab === 'allowlist'
                ? 'border-purple-600 text-purple-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>Exam Allowlist Domains</span>
          </button>

          <button
            onClick={() => setSelectedTab('platform_table')}
            className={`px-4 py-3 rounded-t-xl border-b-2 transition-all flex items-center space-x-1.5 cursor-pointer ${
              selectedTab === 'platform_table'
                ? 'border-purple-600 text-purple-900 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Laptop className="w-4 h-4 text-amber-600" />
            <span>Per-Platform Shortcut Matrix</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MODES SELECTION */}
          {selectedTab === 'modes' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Active Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  modeState.activeMode !== 'none'
                    ? 'bg-purple-50 border-purple-200 text-purple-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-3 rounded-xl ${
                      modeState.activeMode !== 'none'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {modeState.activeMode !== 'none' ? (
                      <Lock className="w-5 h-5 animate-pulse" />
                    ) : (
                      <Unlock className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-black">
                      Current Mode: {appModeService.getActiveModeName()}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {modeState.isBreakPaused
                        ? 'Temporarily suspended for Pomodoro rest break. Will auto-resume on study session restart.'
                        : modeState.activeMode !== 'none'
                        ? 'Application-level assistance layer active. Exit requires PIN / Password.'
                        : 'Select a focus tier below to start an assistance session.'}
                    </div>
                  </div>
                </div>

                {modeState.activeMode !== 'none' && (
                  <button
                    onClick={() => setShowUnlockPrompt(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md transition-all cursor-pointer"
                  >
                    Unlock & Exit Mode
                  </button>
                )}
              </div>

              {/* Mode Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. FOCUS MODE */}
                <div
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                    modeState.activeMode === 'focus'
                      ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/40'
                      : 'border-slate-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center space-x-1.5">
                        <Eye className="w-4 h-4 text-purple-600" />
                        <span>Focus Mode</span>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded-full">
                        Light Tier
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900">Always-On-Top Nudge</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pins StudyOS window always-on-top of other apps. Displays a persistent focus timer banner and optionally mutes system notifications.
                    </p>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Always-on-top window pin</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Persistent focus banner</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-400">
                        <XCircle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        <span>No app-switching restriction</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleActivateMode('focus')}
                    disabled={modeState.activeMode === 'focus'}
                    className={`mt-5 w-full py-2.5 px-4 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                      modeState.activeMode === 'focus'
                        ? 'bg-purple-200 text-purple-800 cursor-default'
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                    }`}
                  >
                    {modeState.activeMode === 'focus' ? 'Currently Active' : 'Activate Focus Mode'}
                  </button>
                </div>

                {/* 2. KIOSK MODE */}
                <div
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                    modeState.activeMode === 'kiosk'
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40'
                      : 'border-slate-200 hover:border-indigo-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center space-x-1.5">
                        <Lock className="w-4 h-4 text-indigo-600" />
                        <span>Kiosk Mode</span>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-full">
                        Medium Tier
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900">Fullscreen Kiosk & Escape Block</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Enforces Electron fullscreen kiosk display (`win.setKiosk(true)`) and intercepts standard escape shortcuts (Alt+F4, Cmd+Q, Escape, F11) where OS permits.
                    </p>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>True Fullscreen Kiosk Mode</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Blocks common escape hotkeys</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-amber-700 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span>OS shortcuts vary by platform</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleActivateMode('kiosk')}
                    disabled={modeState.activeMode === 'kiosk'}
                    className={`mt-5 w-full py-2.5 px-4 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                      modeState.activeMode === 'kiosk'
                        ? 'bg-indigo-200 text-indigo-800 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                    }`}
                  >
                    {modeState.activeMode === 'kiosk' ? 'Currently Active' : 'Activate Kiosk Mode'}
                  </button>
                </div>

                {/* 3. EXAM MODE */}
                <div
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                    modeState.activeMode === 'exam'
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                      : 'border-slate-200 hover:border-emerald-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center space-x-1.5">
                        <ShieldAlert className="w-4 h-4 text-emerald-600" />
                        <span>Exam Mode</span>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                        Strictest Tier
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900">Kiosk + Browser Navigation Lockdown</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Combines Kiosk Mode with strict embedded webview navigation filtering. Disables browser access outside pre-approved allowlist domains.
                    </p>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Fullscreen Kiosk display</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Allowlist browser lockdown</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Blocks unauthorized external tabs</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleActivateMode('exam')}
                    disabled={modeState.activeMode === 'exam'}
                    className={`mt-5 w-full py-2.5 px-4 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                      modeState.activeMode === 'exam'
                        ? 'bg-emerald-200 text-emerald-800 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                    }`}
                  >
                    {modeState.activeMode === 'exam' ? 'Currently Active' : 'Activate Exam Mode'}
                  </button>
                </div>
              </div>

              {/* Pomodoro Timer Sync & Scheduled Session Settings */}
              <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    Pomodoro Timer Integration & Auto-Transitions
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <label className="flex items-start space-x-3 p-3 rounded-2xl bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modeState.autoScheduleWithPomodoro}
                      onChange={(e) =>
                        appModeService.updateConfig({ autoScheduleWithPomodoro: e.target.checked })
                      }
                      className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 block">
                        Auto-start mode with Pomodoro timer
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Automatically trigger scheduled mode whenever a focus session is started.
                      </span>
                    </div>
                  </label>

                  <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1">
                    <label className="text-[11px] font-extrabold text-slate-700 block">
                      Default Scheduled Mode on Pomodoro Start
                    </label>
                    <select
                      value={modeState.scheduledMode}
                      onChange={(e) =>
                        appModeService.updateConfig({
                          scheduledMode: e.target.value as NamedAppMode,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white"
                    >
                      <option value="none">Disabled (No auto-mode)</option>
                      <option value="focus">Focus Mode (Always-on-top)</option>
                      <option value="kiosk">Kiosk Mode (Fullscreen & Escape Block)</option>
                      <option value="exam">Exam Mode (Kiosk + Web Lockdown)</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-50 border border-purple-100 text-[11px] text-purple-900 flex items-center space-x-2.5">
                  <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span>
                    <strong>Auto-Transition to Break:</strong> When Pomodoro break timer fires, fullscreen kiosk and shortcut blocking are automatically suspended for your rest break, then re-entered when your next focus session begins.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IN-APP INFO PANEL / SCOPE & GUARANTEES */}
          {selectedTab === 'info_panel' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-black">What This Mode Does & Does Not Enforce</h3>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  Transparency and clarity are paramount in StudyOS. Please review the explicit boundaries of application-level focus assistance below:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* WHAT IT DOES */}
                <div className="p-5 rounded-3xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-800 font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h4>What StudyOS Modes DO Enforce</h4>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Window Pinning:</strong> Keeps StudyOS pinned always-on-top in Focus Mode.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>True Kiosk Display:</strong> Enforces OS fullscreen mode and prevents accidental minimize/resize.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Shortcut Interception:</strong> Intercepts standard app-closing hotkeys (Alt+F4, Cmd+Q, Escape, F11) where OS permits.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Browser Allowlist Lockdown:</strong> Restricts embedded webview tabs to trusted study domains in Exam Mode.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Credential Unlock:</strong> Requires PIN or password to exit active modes early.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* WHAT IT DOES NOT */}
                <div className="p-5 rounded-3xl bg-rose-50/50 border border-rose-200 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-800 font-black text-sm">
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <h4>What StudyOS Modes CANNOT Enforce</h4>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>No OS Parental Control:</strong> This is application-level focus assistance, NOT operating-system level parental lock software.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Process Force-Quit:</strong> A determined user can still force-quit the app via Windows Task Manager, macOS Activity Monitor, or terminal (<code className="bg-rose-100 px-1 py-0.5 rounded">kill -9</code>).
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Kernel-Protected Hotkeys:</strong> OS-reserved shortcuts (Ctrl+Alt+Del on Windows, Cmd+Tab / Mission Control on macOS) cannot be blocked without OS root privileges.
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Native Daemon Scope:</strong> True OS lockdown would require a separate native helper daemon running outside Electron sandbox, which is out of scope.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXAM ALLOWLIST DOMAINS */}
          {selectedTab === 'allowlist' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black">Pre-Approved Exam Domain Allowlist</h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    In Exam Mode, the embedded browser will block navigation to any domain not listed here.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-200 text-emerald-900 rounded-xl font-mono text-xs font-black">
                  {allowlistDomains.length} Domains Active
                </span>
              </div>

              {/* Add Domain Input */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  placeholder="e.g. nptel.ac.in or gateoverflow.in"
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAddDomain}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center space-x-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Domain</span>
                </button>
              </div>

              {/* Domain Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                {allowlistDomains.map((domain) => (
                  <div
                    key={domain}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between group hover:border-emerald-300 transition-all text-xs font-bold text-slate-800"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate">{domain}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      title="Remove domain"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PER-PLATFORM SHORTCUT MATRIX */}
          {selectedTab === 'platform_table' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Platform-Specific Shortcut & Behavior Matrix
                  </h3>
                  <p className="text-xs text-slate-500">
                    Exact blockable vs unblockable behaviors across operating systems.
                  </p>
                </div>

                <div className="flex space-x-1 p-1 bg-slate-100 rounded-xl">
                  {(['windows', 'macOS', 'linux'] as const).map((plat) => (
                    <button
                      key={plat}
                      onClick={() => setActivePlatform(plat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold capitalize transition-all cursor-pointer ${
                        activePlatform === plat
                          ? 'bg-white text-purple-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {plat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Matrix Table View */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-3 bg-slate-900 text-white text-xs font-black flex items-center justify-between">
                  <span>Operating System: {PER_PLATFORM_BLOCKABILITY[activePlatform].platform}</span>
                  <span className="text-[10px] text-purple-300 uppercase tracking-widest font-mono">
                    Electron Sandbox Scope
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs">
                  {/* Blockable */}
                  <div className="p-4 space-y-3 bg-emerald-50/30">
                    <div className="flex items-center space-x-1.5 font-black text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Blockable Shortcuts & Behaviors</span>
                    </div>
                    <ul className="space-y-2">
                      {PER_PLATFORM_BLOCKABILITY[activePlatform].blockable.map((item, i) => (
                        <li key={i} className="flex items-start space-x-2 text-slate-700 font-medium">
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Unblockable */}
                  <div className="p-4 space-y-3 bg-amber-50/30">
                    <div className="flex items-center space-x-1.5 font-black text-amber-800">
                      <XCircle className="w-4 h-4 text-amber-600" />
                      <span>Unblockable (OS Kernel / Shell Protected)</span>
                    </div>
                    <ul className="space-y-2">
                      {PER_PLATFORM_BLOCKABILITY[activePlatform].unblockable.map((item, i) => (
                        <li key={i} className="flex items-start space-x-2 text-slate-700 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* UNLOCK PROMPT MODAL OVERLAY */}
        {showUnlockPrompt && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-purple-100 text-purple-700">
                  <Lock className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Manual Mode Override Verification
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enter your account PIN or password to unlock and exit {appModeService.getModeTitle(modeState.activeMode)}.
                  </p>
                </div>
              </div>

              <form onSubmit={handleManualUnlock} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    PIN or Password
                  </label>
                  <input
                    type="password"
                    value={unlockSecret}
                    onChange={(e) => setUnlockSecret(e.target.value)}
                    placeholder="Enter 4-digit PIN or password..."
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-sm font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {unlockError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{unlockError}</span>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnlockPrompt(false);
                      setUnlockSecret('');
                      setUnlockError('');
                    }}
                    className="flex-1 py-2.5 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingUnlock}
                    className="flex-1 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    {isVerifyingUnlock ? (
                      <span>Verifying...</span>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Confirm Unlock</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
