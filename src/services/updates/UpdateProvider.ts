export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'downloaded'
  | 'installing'
  | 'upToDate'
  | 'error';

export interface UpdateInfo {
  currentVersion: string;
  currentCommit?: string;
  availableVersion?: string | null;
  availableCommit?: string | null;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseDate?: string | null;
  downloadUrl?: string | null;
  checksumSha256?: string | null;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  currentCommit?: string;
  availableVersion?: string | null;
  availableCommit?: string | null;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseDate?: string | null;
  progress: number;
  error?: string | null;
  lastCheckedAt?: string | null;
  rollbackAvailable?: boolean;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  updateInfo?: UpdateInfo;
  error?: string;
}

export interface UpdateProvider {
  readonly name: string;
  checkForUpdates(pin?: string): Promise<UpdateCheckResult>;
  downloadUpdate(pin?: string): Promise<{ ok: boolean; error?: string }>;
  installUpdate(pin?: string): Promise<{ ok: boolean; error?: string }>;
  rollbackToPrevious?(): Promise<{ ok: boolean; error?: string }>;
  getStatus(): Promise<UpdateState>;
  subscribeToStatus(callback: (state: UpdateState) => void): () => void;
}

