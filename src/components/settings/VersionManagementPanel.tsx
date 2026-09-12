import React, { useState, useEffect } from 'react';
import {
  Package,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Key,
  ShieldCheck,
  RotateCcw,
  GitBranch,
  ExternalLink,
  Save,
} from 'lucide-react';
import { updateService } from '../../services/updates/UpdateService';
import { UpdateState } from '../../services/updates/UpdateProvider';
import { versionService } from '../../services/versionService';
import {
  DEFAULT_GITHUB_REPO_URL,
  getConfiguredRepoUrl,
  parseGitHubRepoUrl,
} from '../../services/updates/githubRepoConfig';

interface Props {
  onShowNotification: (msg: string, title?: string) => void;
}

function statusLabel(status: UpdateState['status']): string {
  switch (status) {
    case 'checking':
      return 'Checking for updates…';
    case 'available':
      return 'Update available';
    case 'downloading':
      return 'Downloading…';
    case 'verifying':
      return 'Verifying package…';
    case 'downloaded':
      return 'Download complete — ready to install';
    case 'installing':
      return 'Installing update…';
    case 'upToDate':
      return "You're up to date";
    case 'error':
      return 'Update failed';
    default:
      return 'Idle';
  }
}

export const VersionManagementPanel: React.FC<Props> = ({ onShowNotification }) => {
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: versionService.getCurrentVersion(),
    currentCommit: undefined,
    availableVersion: null,
    availableCommit: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    progress: 0,
    error: null,
    lastCheckedAt: null,
    rollbackAvailable: true,
  });

  const [repoInput, setRepoInput] = useState(getConfiguredRepoUrl() || DEFAULT_GITHUB_REPO_URL);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoSavedLabel, setRepoSavedLabel] = useState<string | null>(null);
  const [validatingRepo, setValidatingRepo] = useState(false);

  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'check' | 'download' | 'install'>('check');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    updateService.getStatus().then((s) => setUpdateState(s));
    const unsubscribe = updateService.subscribe((s) => setUpdateState(s));
    return () => unsubscribe();
  }, []);

  const handleSaveRepo = async () => {
    setRepoError(null);
    setRepoSavedLabel(null);
    const parsed = parseGitHubRepoUrl(repoInput);
    if (!parsed.ok) {
      setRepoError(parsed.error);
      return;
    }
    const res = updateService.setRepositoryUrl(repoInput);
    if (!res.ok) {
      setRepoError(res.error || 'Could not save repository');
      return;
    }
    setRepoInput(res.config?.htmlUrl || repoInput);
    setRepoSavedLabel(`${res.config?.owner}/${res.config?.repo}`);
    onShowNotification(
      `Update source set to ${res.config?.owner}/${res.config?.repo}. No other repository will be used.`,
      'Repository Saved'
    );
  };

  const handleValidateRepo = async () => {
    setRepoError(null);
    setValidatingRepo(true);
    try {
      const save = updateService.setRepositoryUrl(repoInput);
      if (!save.ok) {
        setRepoError(save.error || 'Invalid repository URL');
        return;
      }
      setRepoInput(save.config?.htmlUrl || repoInput);
      const result = await updateService.validateRepository();
      if (!result.ok) {
        setRepoError(result.error || 'Repository is not reachable');
        onShowNotification(result.error || 'Repository validation failed', 'Repository');
      } else {
        setRepoSavedLabel(result.fullName || `${save.config?.owner}/${save.config?.repo}`);
        onShowNotification(
          `Repository reachable: ${result.fullName || save.config?.htmlUrl}`,
          'Repository OK'
        );
      }
    } finally {
      setValidatingRepo(false);
    }
  };

  const triggerPinPrompt = (action: 'check' | 'download' | 'install') => {
    setPendingAction(action);
    setPinInput('');
    setPinError(null);
    setShowPinModal(true);
  };

  const runCheck = async (pin?: string) => {
    setBusy(true);
    try {
      onShowNotification('Checking the configured GitHub repository for releases…', 'Auto-Updater');
      const result = await updateService.checkForUpdates(pin);
      if (result.hasUpdate && result.updateInfo?.availableVersion) {
        onShowNotification(
          `Update available: v${result.updateInfo.availableVersion}`,
          'Update Available'
        );
      } else if (result.error) {
        onShowNotification(result.error, 'Update Notice');
      } else {
        onShowNotification("You're up to date.", 'Up to Date');
      }
    } finally {
      setBusy(false);
    }
  };

  const runDownload = async (pin?: string) => {
    setBusy(true);
    try {
      onShowNotification('Downloading the release package…', 'Downloading');
      const res = await updateService.downloadUpdate(pin);
      if (!res.ok) {
        onShowNotification(res.error || 'Failed to download update', 'Download Failed');
      } else {
        onShowNotification('Update downloaded and verified. Ready to install in place.', 'Ready to Install');
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Please enter your Network Security PIN.');
      return;
    }
    setShowPinModal(false);
    if (pendingAction === 'check') await runCheck(pinInput);
    else if (pendingAction === 'download') await runDownload(pinInput);
  };

  const handleInstall = async () => {
    setBusy(true);
    try {
      onShowNotification(
        'Installing over the existing application (no uninstall). StudyOS will restart when complete.',
        'Installing'
      );
      const res = await updateService.installUpdate();
      if (!res.ok) {
        onShowNotification(res.error || 'Install failed. Your current install is unchanged.', 'Install Failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRollback = async () => {
    const res = await updateService.rollbackToPrevious();
    if (res.ok) {
      onShowNotification('Restored previous application version snapshot from local backup.', 'Rollback Complete');
    } else {
      onShowNotification(res.error || 'Rollback unavailable', 'Rollback');
    }
  };

  const currentVersion = updateState.currentVersion || versionService.getCurrentVersion();

  return (
    <div className="space-y-6">
      {/* Repository configuration */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">GitHub Update Source</h3>
            <p className="text-xs text-slate-500">
              Only this repository is used. Unrelated StudyOS repos are never substituted.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700">Repository URL</label>
          <input
            type="url"
            value={repoInput}
            onChange={(e) => {
              setRepoInput(e.target.value);
              setRepoError(null);
              setRepoSavedLabel(null);
            }}
            placeholder="https://github.com/OWNER/REPO"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {repoError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {repoError}
            </p>
          )}
          {repoSavedLabel && !repoError && (
            <p className="text-xs text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Active source: {repoSavedLabel}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveRepo}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Repository
          </button>
          <button
            type="button"
            disabled={validatingRepo}
            onClick={handleValidateRepo}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {validatingRepo ? 'Validating…' : 'Validate Public Access'}
          </button>
          <a
            href={repoInput.startsWith('http') ? repoInput : DEFAULT_GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open on GitHub
          </a>
        </div>
      </div>

      {/* Primary Auto-Updater Status Card */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current version</div>
              <div className="text-xl font-black text-slate-900">v{currentVersion}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{statusLabel(updateState.status)}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || updateState.status === 'checking' || updateState.status === 'downloading'}
              onClick={() => triggerPinPrompt('check')}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${updateState.status === 'checking' ? 'animate-spin' : ''}`} />
              Check for Updates
            </button>
            {updateState.status === 'available' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => triggerPinPrompt('download')}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Download v{updateState.availableVersion}
              </button>
            )}
            {(updateState.status === 'downloaded' || updateState.status === 'verifying') && (
              <button
                type="button"
                disabled={busy}
                onClick={handleInstall}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Install Update (in place)
              </button>
            )}
            {updateState.status === 'error' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => triggerPinPrompt('check')}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {updateState.status === 'downloading' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-600">
              <span>Downloading…</span>
              <span>{updateState.progress || 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${Math.min(100, updateState.progress || 0)}%` }}
              />
            </div>
          </div>
        )}

        {updateState.availableVersion && updateState.status === 'available' && (
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-xs space-y-2">
            <div className="font-black text-indigo-900">
              Update available: v{updateState.availableVersion}
              {updateState.releaseName ? ` — ${updateState.releaseName}` : ''}
            </div>
            {updateState.releaseDate && (
              <div className="text-indigo-700">Released: {new Date(updateState.releaseDate).toLocaleString()}</div>
            )}
            <button
              type="button"
              onClick={() => setShowNotesModal(true)}
              className="text-indigo-700 font-bold underline cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              View release notes
            </button>
          </div>
        )}

        {updateState.error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-xs text-red-800 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Update notice</div>
              <p className="mt-0.5 leading-relaxed">{updateState.error}</p>
            </div>
          </div>
        )}

        {updateState.status === 'upToDate' && !updateState.error && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            You&apos;re up to date with the latest compatible release from the configured repository.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          {updateState.lastCheckedAt && (
            <span>Last checked: {new Date(updateState.lastCheckedAt).toLocaleString()}</span>
          )}
          {updateState.rollbackAvailable && (
            <button
              type="button"
              onClick={handleRollback}
              className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rollback to previous version
            </button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-600 space-y-1.5">
        <div className="font-bold text-slate-800">In-place update guarantee</div>
        <p>
          Updates install over the existing StudyOS Desktop installation. You are not asked to uninstall first.
          Local study data, settings, and the configured GitHub repository URL are preserved in the application
          user-data directory.
        </p>
        <p>
          Public GitHub Releases are used without a login when the repository is public. Network access is granted
          only for the update operation through the existing security gateway and GitHub allowlist.
        </p>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">Network Security PIN</h3>
            </div>
            <p className="text-xs text-slate-600">
              Temporarily unlock the network gateway to contact GitHub for the configured repository only.
            </p>
            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter PIN"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              {pinError && <p className="text-xs text-red-600">{pinError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                >
                  Unlock Network & Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Release Notes — {updateState.releaseName || `v${updateState.availableVersion}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {updateState.releaseNotes || 'No detailed release notes provided.'}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
