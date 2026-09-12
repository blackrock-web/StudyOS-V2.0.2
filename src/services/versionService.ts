/** Offline-first semantic version management for StudyOS Desktop */

export interface VersionRecord {
  version: string; // semver e.g. 1.0.0
  releaseNotes: string;
  releasedAt: string;
  channel: 'stable' | 'beta';
}

export interface VersionState {
  currentVersion: string;
  previousVersion: string | null;
  availableVersions: VersionRecord[];
  lastCheckedAt: string | null;
  pendingUpdate: VersionRecord | null;
}

const STORAGE_KEY = 'studyos_version_state_v1';
const APP_VERSION_FALLBACK = '1.0.0';

function load(): VersionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VersionState;
  } catch { /* ignore */ }
  return {
    currentVersion: APP_VERSION_FALLBACK,
    previousVersion: null,
    availableVersions: [
      {
        version: APP_VERSION_FALLBACK,
        releaseNotes: 'Initial offline desktop release.',
        releasedAt: new Date().toISOString(),
        channel: 'stable',
      },
    ],
    lastCheckedAt: null,
    pendingUpdate: null,
  };
}

function save(state: VersionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export const versionService = {
  getState(): VersionState {
    return load();
  },

  getCurrentVersion(): string {
    return load().currentVersion;
  },

  setCurrentVersion(version: string, releaseNotes?: string): VersionState {
    const state = load();
    const prev = state.currentVersion;
    state.previousVersion = prev;
    state.currentVersion = version.trim() || prev;
    if (releaseNotes !== undefined) {
      const existing = state.availableVersions.find((v) => v.version === state.currentVersion);
      if (existing) {
        existing.releaseNotes = releaseNotes;
      } else {
        state.availableVersions.unshift({
          version: state.currentVersion,
          releaseNotes: releaseNotes || '',
          releasedAt: new Date().toISOString(),
          channel: 'stable',
        });
      }
    }
    save(state);
    return state;
  },

  updateReleaseNotes(version: string, notes: string): VersionState {
    const state = load();
    const rec = state.availableVersions.find((v) => v.version === version);
    if (rec) rec.releaseNotes = notes;
    else {
      state.availableVersions.unshift({
        version,
        releaseNotes: notes,
        releasedAt: new Date().toISOString(),
        channel: 'stable',
      });
    }
    save(state);
    return state;
  },

  addAvailableVersion(record: VersionRecord): VersionState {
    const state = load();
    state.availableVersions = [
      record,
      ...state.availableVersions.filter((v) => v.version !== record.version),
    ];
    save(state);
    return state;
  },

  /** Offline "check": compare current to highest listed available version */
  checkForUpdates(): { hasUpdate: boolean; latest: VersionRecord | null; state: VersionState } {
    const state = load();
    state.lastCheckedAt = new Date().toISOString();
    const sorted = [...state.availableVersions].sort((a, b) =>
      b.version.localeCompare(a.version, undefined, { numeric: true })
    );
    const latest = sorted[0] || null;
    const hasUpdate = !!(latest && latest.version !== state.currentVersion);
    state.pendingUpdate = hasUpdate ? latest : null;
    save(state);
    return { hasUpdate, latest, state };
  },

  /** Mark update applied after successful restart (user data remains in userData path) */
  applyPendingUpdate(): VersionState {
    const state = load();
    if (state.pendingUpdate) {
      state.previousVersion = state.currentVersion;
      state.currentVersion = state.pendingUpdate.version;
      state.pendingUpdate = null;
      save(state);
    }
    return state;
  },

  rollback(): VersionState {
    const state = load();
    if (state.previousVersion) {
      const cur = state.currentVersion;
      state.currentVersion = state.previousVersion;
      state.previousVersion = cur;
      save(state);
    }
    return state;
  },
};
