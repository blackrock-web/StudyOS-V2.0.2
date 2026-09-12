/**
 * StudyOS Desktop — Preload (contextBridge)
 * Minimal offline-only API. No Node primitives exposed to renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

function clampStr(v, max) {
  return String(v == null ? '' : v).slice(0, max);
}

contextBridge.exposeInMainWorld('studyosDesktop', {
  platform: process.platform,
  isDesktop: true,
  isOffline: true,
  getVersion: () => ipcRenderer.invoke('studyos:get-version'),
  getUserDataPath: () => ipcRenderer.invoke('studyos:get-app-path'),
  saveFile: (opts) => {
    const safe = opts && typeof opts === 'object' ? opts : {};
    return ipcRenderer.invoke('studyos:save-file-dialog', {
      defaultPath: clampStr(safe.defaultPath, 200),
      filters: Array.isArray(safe.filters) ? safe.filters : undefined,
      content: typeof safe.content === 'string' ? safe.content : '',
      encoding: typeof safe.encoding === 'string' ? safe.encoding : 'utf8',
    });
  },
  openFile: (opts) => {
    const safe = opts && typeof opts === 'object' ? opts : {};
    return ipcRenderer.invoke('studyos:open-file-dialog', {
      filters: Array.isArray(safe.filters) ? safe.filters : undefined,
    });
  },
  showNotification: (title, body) => {
    ipcRenderer.send('studyos:show-notification', {
      title: clampStr(title, 120),
      body: clampStr(body, 500),
    });
  },
  encryptSecure: (plain) =>
    ipcRenderer.invoke('studyos:encrypt-string', { plain: clampStr(plain, 2_000_000) }),
  decryptSecure: (cipher) =>
    ipcRenderer.invoke('studyos:decrypt-string', { cipher: clampStr(cipher, 2_500_000) }),
  getStudyMode: () => ipcRenderer.invoke('studyos:get-study-mode'),
  setStudyMode: (mode) => ipcRenderer.invoke('studyos:set-study-mode', { mode: Boolean(mode) }),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('studyos:set-always-on-top', { flag: Boolean(flag) }),
  setKioskMode: (flag) => ipcRenderer.invoke('studyos:set-kiosk-mode', { flag: Boolean(flag) }),
  setExamMode: (flag, allowlist) =>
    ipcRenderer.invoke('studyos:set-exam-mode', {
      flag: Boolean(flag),
      allowlist: Array.isArray(allowlist) ? allowlist.map(s => clampStr(s, 200)) : []
    }),
  openDownloadedFile: (filePath) =>
    ipcRenderer.invoke('studyos:open-downloaded-file', { filePath: clampStr(filePath, 1000) }),
  onDownloadStarted: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, data) => cb(data);
    ipcRenderer.on('studyos:download-started', h);
    return () => ipcRenderer.removeListener('studyos:download-started', h);
  },
  onDownloadProgress: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, data) => cb(data);
    ipcRenderer.on('studyos:download-progress', h);
    return () => ipcRenderer.removeListener('studyos:download-progress', h);
  },
  onDownloadCompleted: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, data) => cb(data);
    ipcRenderer.on('studyos:download-completed', h);
    return () => ipcRenderer.removeListener('studyos:download-completed', h);
  },
  onDownloadFailed: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, data) => cb(data);
    ipcRenderer.on('studyos:download-failed', h);
    return () => ipcRenderer.removeListener('studyos:download-failed', h);
  },
  onMenuExportBackup: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = () => {
      try {
        cb();
      } catch (e) {
        /* ignore */
      }
    };
    ipcRenderer.on('studyos:menu-export-backup', handler);
    return () => ipcRenderer.removeListener('studyos:menu-export-backup', handler);
  },
  // Auto-updater safe interface
  setUpdateRepository: (opts) => ipcRenderer.invoke('studyos:updater-set-repo', opts || {}),
  checkForUpdates: () => ipcRenderer.invoke('studyos:updater-check'),
  downloadUpdate: () => ipcRenderer.invoke('studyos:updater-download'),
  installUpdate: () => ipcRenderer.invoke('studyos:updater-install'),
  getUpdateStatus: () => ipcRenderer.invoke('studyos:updater-get-status'),
  onUpdateStatusChanged: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const h = (_e, data) => cb(data);
    ipcRenderer.on('studyos:updater-status-changed', h);
    return () => ipcRenderer.removeListener('studyos:updater-status-changed', h);
  },
});
