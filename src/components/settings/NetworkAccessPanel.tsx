import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Server,
  RefreshCw,
} from 'lucide-react';
import { networkAccessManager, NETWORK_ALLOWLIST } from '../../services/network/NetworkAccessManager';
import { pinService } from '../../services/auth/pinService';
import { NetworkGatewayState, AuthorizedOperation } from '../../types';

interface Props {
  onShowNotification: (msg: string, title?: string) => void;
}

export const NetworkAccessPanel: React.FC<Props> = ({ onShowNotification }) => {
  const [gatewayState, setGatewayState] = useState<NetworkGatewayState>(networkAccessManager.getState());
  const [showPinModal, setShowPinModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [selectedOperation, setSelectedOperation] = useState<AuthorizedOperation>('update');
  const [durationMinutes, setDurationMinutes] = useState<number>(3);
  const [reasonInput, setReasonInput] = useState('Manual authorized network session');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(pinService.isLockedOut());
  const [lockoutSecs, setLockoutSecs] = useState<number>(pinService.getLockoutRemainingSecs());

  useEffect(() => {
    const unsub = networkAccessManager.subscribe((state) => {
      setGatewayState(state);
    });

    const interval = setInterval(() => {
      const locked = pinService.isLockedOut();
      setIsLockedOut(locked);
      setLockoutSecs(pinService.getLockoutRemainingSecs());
    }, 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (isLockedOut) {
      setModalError(`Brute force lockout active. Please wait ${lockoutSecs}s.`);
      return;
    }

    if (!pinInput) {
      setModalError('Please enter your Network Security PIN.');
      return;
    }

    const durationMs = durationMinutes * 60 * 1000;
    const res = await networkAccessManager.requestTemporaryUnlock(
      pinInput,
      selectedOperation,
      reasonInput,
      durationMs
    );

    if (!res.ok) {
      setModalError(res.error || 'Authentication failed');
      return;
    }

    setPinInput('');
    setShowPinModal(false);
    onShowNotification(
      `Network temporarily enabled for ${selectedOperation.toUpperCase()}. Auto-locks in ${durationMinutes} minutes.`,
      'Network Gateway'
    );
  };

  const handleSetNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (newPinInput.length < 4) {
      setModalError('PIN must be at least 4 digits or characters.');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setModalError('New PIN and confirmation do not match.');
      return;
    }

    const res = await pinService.setPin(newPinInput, gatewayState.hasConfiguredPin ? currentPinInput : undefined);
    if (!res.success) {
      setModalError(res.error || 'Failed to update security PIN');
      return;
    }

    // Also update manager state
    await networkAccessManager.setPin(newPinInput);

    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setShowChangePinModal(false);
    onShowNotification('Network Access PIN configured with cryptographic salted hash.', 'Security Vault');
  };

  const handleLockImmediately = async () => {
    await networkAccessManager.lockImmediately('Manually locked by user');
    onShowNotification('Network access disabled. System is now strictly OFFLINE.', 'Network Locked');
  };

  const isLocked = gatewayState.status === 'LOCKED';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Primary Gateway Card */}
      <div className="bg-white p-6 rounded-3xl border border-[#E7E0F8] shadow-xs space-y-6">
        <div className="border-b border-[#E7E0F8] pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" /> Network Access Control & Isolation Gateway
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              StudyOS Desktop operates in 100% offline isolation. Network sockets are strictly blocked by default.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> STATUS: LOCKED (Offline Safe)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse shadow-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600" /> STATUS: UNLOCKED ({gatewayState.authorizedOperation.toUpperCase()})
              </span>
            )}
          </div>
        </div>

        {/* Central Status Box */}
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isLocked
              ? 'bg-slate-50 border-slate-200'
              : 'bg-amber-50/70 border-amber-300 shadow-sm'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {isLocked ? (
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Lock className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Unlock className="w-4 h-4 animate-bounce" />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Network State:{' '}
                    <span className={isLocked ? 'text-emerald-700' : 'text-amber-700 font-mono font-black'}>
                      {gatewayState.status}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    {gatewayState.hasConfiguredPin
                      ? 'Protected by Salted-Hash PIN Vault'
                      : 'PIN not configured yet (first unlock sets default PIN)'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed mt-2">
                {isLocked
                  ? 'Zero outbound network connections permitted. Normal app operations remain 100% offline.'
                  : `Network temporarily permitted for: ${gatewayState.reason || gatewayState.authorizedOperation}. Auto-locks when operation finishes.`}
              </p>
              {!isLocked && gatewayState.activeSessionDurationSecs > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-900 mt-2 bg-amber-200/60 px-2.5 py-1 rounded-lg w-fit">
                  <Clock className="w-3.5 h-3.5" />
                  Auto-relocking in: {gatewayState.activeSessionDurationSecs}s
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isLocked ? (
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setShowPinModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Key className="w-4 h-4" /> Enable Temporary Network Access
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLockImmediately}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Lock className="w-4 h-4" /> Lock Network Now
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setShowChangePinModal(true);
                }}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer"
              >
                {gatewayState.hasConfiguredPin ? 'Change Security PIN' : 'Set Security PIN'}
              </button>
            </div>
          </div>
        </div>

        {/* Security Invariant Guarantees */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2">
            <div className="font-bold text-purple-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-purple-600" /> Authorized Operations Only
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Network access cannot be enabled for general browsing or unvetted scripts. It only opens an isolated channel for <strong>GitHub Releases</strong> or <strong>HuggingFace GGUF models</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2">
            <div className="font-bold text-purple-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-purple-600" /> Automatic Safety Auto-Lock
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Once an update check, download, or model installation finishes (or after session timeout), the gateway automatically snaps back to <strong>LOCKED</strong>.
            </p>
          </div>
        </div>

        {/* Allowlist Inspection */}
        <div className="space-y-3 pt-2">
          <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
            Strict Outbound Destination Allowlist
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Application Updates
              </div>
              <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
                {NETWORK_ALLOWLIST.update.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-600" /> Local Model Downloads
              </div>
              <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
                {NETWORK_ALLOWLIST['model-download'].map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Unlock Network Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Authorize Network Access</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Select Authorized Operation</label>
                <select
                  value={selectedOperation}
                  onChange={(e) => setSelectedOperation(e.target.value as AuthorizedOperation)}
                  className="w-full p-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="update">Application Updates (GitHub Releases)</option>
                  <option value="model-download">Local AI Model Download (HuggingFace GGUF)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Session Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full p-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value={1}>1 Minute (Fast Check)</option>
                  <option value={3}>3 Minutes (Recommended)</option>
                  <option value={5}>5 Minutes (Model Download)</option>
                  <option value={10}>10 Minutes (Large GGUF Weights)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Enter Network Security PIN</label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter 4-8 digit PIN"
                  autoFocus
                  disabled={isLockedOut}
                  className="w-full p-3 text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-600 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500">
                  {gatewayState.hasConfiguredPin
                    ? 'Enter your pre-configured PIN to authorize this session.'
                    : 'No PIN set yet. Enter any new 4-digit PIN to set and unlock.'}
                </p>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLockedOut}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Unlock Network ({durationMinutes} Mins)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set/Change PIN Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {gatewayState.hasConfiguredPin ? 'Change Network PIN' : 'Set Network Security PIN'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePinModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSetNewPin} className="space-y-4">
              {gatewayState.hasConfiguredPin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Current PIN</label>
                  <input
                    type="password"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    placeholder="Enter current PIN"
                    autoFocus
                    className="w-full p-2.5 text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">New PIN (4-8 digits)</label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="e.g. 1234"
                  autoFocus={!gatewayState.hasConfiguredPin}
                  className="w-full p-2.5 text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Confirm New PIN</label>
                <input
                  type="password"
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value)}
                  placeholder="Re-enter new PIN"
                  className="w-full p-2.5 text-sm font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
