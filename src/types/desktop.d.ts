export interface StudyOSDesktopAPI {
  platform: string;
  isDesktop: boolean;
  isOffline: boolean;
  getVersion: () => Promise<string>;
  getUserDataPath: () => Promise<string>;
  saveFile: (opts: {
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
    content: string;
    encoding?: string;
  }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  openFile: (opts: {
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ ok: boolean; path?: string; content?: string; error?: string }>;
  showNotification?: (title: string, body: string) => void;
  getStudyMode?: () => Promise<boolean>;
  setStudyMode?: (mode: boolean) => Promise<boolean>;
  setAlwaysOnTop?: (flag: boolean) => Promise<boolean>;
  setKioskMode?: (flag: boolean) => Promise<boolean>;
  setExamMode?: (flag: boolean, allowlist?: string[]) => Promise<boolean>;
  onMenuExportBackup?: (cb: () => void) => () => void;
  openDownloadedFile?: (filePath: string) => Promise<{ success?: boolean; ok?: boolean; error?: string }>;
  onDownloadStarted?: (
    callback: (data: { id: string; filename: string; url: string; savePath: string; totalBytes: number }) => void
  ) => () => void;
  onDownloadProgress?: (
    callback: (data: { id: string; receivedBytes: number; totalBytes: number }) => void
  ) => () => void;
  onDownloadCompleted?: (
    callback: (data: { id: string; filename: string; savePath: string }) => void
  ) => () => void;
  onDownloadFailed?: (
    callback: (data: { id: string; error?: string }) => void
  ) => () => void;

  // --- Network Access Gateway ---
  getNetworkStatus?: () => Promise<any>;
  setNetworkPin?: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  verifyNetworkPin?: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  unlockNetworkTemporary?: (opts: {
    pin: string;
    operation: 'update' | 'model-download';
    reason?: string;
    durationMs?: number;
  }) => Promise<{ ok: boolean; error?: string; state?: any }>;
  lockNetworkNow?: () => Promise<{ ok: boolean; state?: any }>;
  onNetworkStatusChanged?: (cb: (state: any) => void) => () => void;

  // --- Git & GitHub Updates ---
  setUpdateRepository?: (opts: { owner: string; repo: string }) => Promise<{ ok: boolean; error?: string; owner?: string; repo?: string }>;
  checkForUpdates?: () => Promise<{ ok: boolean; error?: string; state?: any }>;
  downloadUpdate?: () => Promise<{ ok: boolean; error?: string; state?: any }>;
  installUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  getUpdateStatus?: () => Promise<any>;
  onUpdateStatusChanged?: (cb: (state: any) => void) => () => void;

  // --- Local LLM & Model Management ---
  getInstalledModels?: () => Promise<any[]>;
  downloadLocalModel?: (opts: {
    modelId: string;
    url: string;
    expectedSha256: string;
    destinationPath?: string;
  }) => Promise<{ ok: boolean; error?: string; model?: any }>;
  deleteLocalModel?: (modelId: string) => Promise<{ ok: boolean; error?: string }>;
  onModelDownloadProgress?: (cb: (data: { modelId: string; progress: number; bytes: number; total: number; speed: string }) => void) => () => void;

  // --- Complete Destruction ---
  destroyApplication?: (opts: {
    pin: string;
    confirmationText: string;
    preserveBackups?: boolean;
  }) => Promise<{ ok: boolean; error?: string; deletedCount?: number }>;
  onDestructionProgress?: (cb: (state: { step: string; percent: number; done: boolean; error?: string }) => void) => () => void;
}


declare global {
  interface Window {
    studyosDesktop?: StudyOSDesktopAPI;
  }
}

export {};
