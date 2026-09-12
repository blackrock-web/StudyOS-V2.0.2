/**
 * StudyOS Desktop — Electron Main Process
 * 100% offline, local-first, no network required.
 */
const { app, BrowserWindow, shell, Menu, dialog, ipcMain, nativeTheme, Notification, safeStorage, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { validateIpc } = require('./ipcValidate.cjs');

const isDev = !app.isPackaged;
let mainWindow = null;
let splashWindow = null;

const APP_NAME = 'StudyOS';
const APP_ID = 'com.studyos.desktop';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function getIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'public', 'icons', 'icon.png'),
    path.join(process.resourcesPath || '', 'icon.png'),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  const splashHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: system-ui, -apple-system, Segoe UI, sans-serif;
    background: transparent;
    display:flex; align-items:center; justify-content:center;
    height:100vh; overflow:hidden;
  }
  .card {
    width:400px; height:250px;
    background: linear-gradient(145deg, #1e1b4b 0%, #4c1d95 50%, #831843 100%);
    border-radius: 24px;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    color:#fff; box-shadow: 0 20px 60px rgba(0,0,0,0.45);
    border: 1px solid rgba(255,255,255,0.12);
  }
  .logo {
    width:64px; height:64px; border-radius:18px;
    background: linear-gradient(135deg, #8b5cf6, #ec4899, #f43f5e);
    display:flex; align-items:center; justify-content:center;
    font-size:28px; font-weight:900; margin-bottom:16px;
    box-shadow: 0 8px 24px rgba(236,72,153,0.4);
  }
  h1 { font-size:22px; font-weight:800; letter-spacing:-0.02em; }
  p { font-size:12px; opacity:0.75; margin-top:6px; font-weight:600; }
  .bar {
    width:180px; height:3px; background:rgba(255,255,255,0.15);
    border-radius:99px; margin-top:22px; overflow:hidden;
  }
  .bar > i {
    display:block; height:100%; width:40%;
    background: linear-gradient(90deg, #a78bfa, #f472b6);
    border-radius:99px;
    animation: slide 1.2s ease-in-out infinite;
  }
  @keyframes slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
</style></head>
<body>
  <div class="card">
    <div class="logo">S</div>
    <h1>StudyOS</h1>
    <p>Offline Desktop · Local-First Study Platform</p>
    <div class="bar"><i></i></div>
  </div>
</body></html>`;
  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml));
}

function createMainWindow() {
  const icon = getIconPath();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: APP_NAME,
    icon: icon,
    backgroundColor: '#fdf2f8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      devTools: isDev,
      webSecurity: true,
      webviewTag: true,
    },
  });

  // Setup isolated browser session partition for webview tabs
  const browserSession = session.fromPartition('persist:studybrowser');
  browserSession.setUserAgent(DESKTOP_USER_AGENT);

  mainWindow.webContents.on('did-attach-webview', (_event, webContents) => {
    webContents.setUserAgent(DESKTOP_USER_AGENT);
  });

  // Handle downloads inside webviews
  browserSession.on('will-download', (_evt, item) => {
    const filename = item.getFilename();
    const totalBytes = item.getTotalBytes();
    const url = item.getURL();
    const savePath = path.join(app.getPath('downloads'), filename);
    item.setSavePath(savePath);

    const id = 'dl-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

    mainWindow?.webContents.send('studyos:download-started', {
      id,
      filename,
      savePath,
      totalBytes,
      url,
      timestamp: new Date().toISOString(),
    });

    item.on('updated', (_event, state) => {
      if (state === 'interrupted') {
        mainWindow?.webContents.send('studyos:download-failed', { id, reason: 'interrupted' });
      } else if (state === 'progressing') {
        mainWindow?.webContents.send('studyos:download-progress', {
          id,
          receivedBytes: item.getReceivedBytes(),
          totalBytes,
        });
      }
    });

    item.once('done', (_event, state) => {
      if (state === 'completed') {
        mainWindow?.webContents.send('studyos:download-completed', {
          id,
          savePath,
          filename,
          totalBytes,
        });
      } else {
        mainWindow?.webContents.send('studyos:download-failed', { id, reason: state });
      }
    });
  });

  // Application Shell Lockdown: main window itself stays locked to local app resources
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file:') || url.startsWith('devtools:') || url.startsWith('blob:') || url.startsWith('data:')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('file:') ||
      url.startsWith('devtools:') ||
      (isDev && url.startsWith('http://localhost'));
    if (!allowed) event.preventDefault();
  });

  // Session: block outbound network + dangerous permissions (offline enforcement)
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _perm, callback) => {
    callback(false);
  });
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  // Deny all remote protocol requests except local/dev
  mainWindow.webContents.session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const u = details.url || '';
    const allow =
      u.startsWith('file:') ||
      u.startsWith('devtools:') ||
      u.startsWith('data:') ||
      u.startsWith('blob:') ||
      (isDev && (u.startsWith('http://localhost:') || u.startsWith('http://127.0.0.1:')));
    callback({ cancel: !allow });
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
    scheduleInitialUpdateCheck();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  buildAppMenu();
}

function buildAppMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { role: 'about', label: `About ${APP_NAME}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: `Quit ${APP_NAME}` },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Backup…',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.send('studyos:menu-export-backup');
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Offline Mode',
          enabled: false,
        },
        {
          label: 'This application runs 100% offline. No internet connection is required.',
          enabled: false,
        },
      ],
    },
  ];

  // Non-macOS simplified menu
  if (process.platform !== 'darwin') {
    template[0] = {
      label: 'File',
      submenu: [
        {
          label: 'Export Backup…',
          accelerator: 'Ctrl+E',
          click: () => mainWindow?.webContents.send('studyos:menu-export-backup'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    };
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC: expose safe local filesystem helpers for export/import only
const MAX_IPC_CONTENT_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_SAVE_ENCODINGS = new Set(['utf8', 'utf-8', 'base64', 'binary']);

function assertSender(event) {
  // Only accept IPC from our own BrowserWindow frames
  const wc = event.sender;
  if (!wc || wc.isDestroyed()) return false;
  if (mainWindow && wc.id !== mainWindow.webContents.id) return false;
  return true;
}

function sanitizeDefaultPath(name) {
  if (!name || typeof name !== 'string') return 'StudyOS_Export.json';
  // Strip path separators / traversal
  const base = path.basename(name).replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 180);
  return base || 'StudyOS_Export.json';
}

// --- Named App Modes (Focus, Kiosk, Exam) & Shortcut Lockdown ---
let studyMode = false; // Default: Open browsing inside webview tabs allowed
let activeExamAllowlist = [];

function registerKioskShortcuts() {
  try {
    globalShortcut.unregisterAll();
    const shortcutsToBlock = [
      'Alt+Tab', 'Alt+F4', 'Alt+Space', 'Alt+Escape',
      'CmdOrCtrl+Q', 'CmdOrCtrl+W', 'CmdOrCtrl+R', 'CmdOrCtrl+Shift+R',
      'CmdOrCtrl+Shift+I', 'CmdOrCtrl+Alt+I', 'F11', 'F5', 'Escape'
    ];
    for (const shortcut of shortcutsToBlock) {
      try {
        globalShortcut.register(shortcut, () => {
          return false;
        });
      } catch {
        /* OS protected shortcut (e.g., Win+L / Cmd+Tab) */
      }
    }
  } catch {
    /* ignore */
  }
}

function unregisterKioskShortcuts() {
  try {
    globalShortcut.unregisterAll();
  } catch {
    /* ignore */
  }
}

function isAllowedUrlInStudyMode(rawUrl) {
  if (!rawUrl) return false;
  if (rawUrl.startsWith('file:') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return true;
  const trustedDomains = [
    ...activeExamAllowlist,
    'pw.live', 'physicswallah.live', 'google.com', 'google.co.in', 'youtube.com',
    'nptel.ac.in', 'geeksforgeeks.org', 'wikipedia.org', 'arxiv.org', 'gateoverflow.in',
    'khanacademy.org', 'developer.mozilla.org', 'github.com', 'pwthor.live', 'www.pwthor.live', 'localhost'
  ];
  try {
    const parsed = new URL(rawUrl);
    return trustedDomains.some(d => d && parsed.hostname.toLowerCase().endsWith(d.toLowerCase()));
  } catch {
    return false;
  }
}

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setUserAgent(DESKTOP_USER_AGENT);

    contents.setWindowOpenHandler(({ url }) => {
      if (studyMode) {
        const allowed = isAllowedUrlInStudyMode(url);
        return allowed ? { action: 'allow' } : { action: 'deny' };
      }
      // Open Browsing Mode (studyMode = false): allow OAuth popups & window creation in webview
      return { action: 'allow' };
    });

    contents.on('will-navigate', (evt, navigationUrl) => {
      if (studyMode) {
        if (!isAllowedUrlInStudyMode(navigationUrl)) {
          evt.preventDefault();
        }
      }
    });
  }
});

ipcMain.handle('studyos:get-study-mode', (event) => {
  if (!assertSender(event)) return false;
  return studyMode;
});

ipcMain.handle('studyos:set-study-mode', (event, opts) => {
  if (!assertSender(event)) return false;
  const check = validateIpc('studyos:set-study-mode', opts || {});
  if (!check.ok) return false;
  studyMode = Boolean(opts?.mode);
  return studyMode;
});

ipcMain.handle('studyos:set-always-on-top', (event, opts) => {
  if (!assertSender(event)) return false;
  const check = validateIpc('studyos:set-always-on-top', opts || {});
  if (!check.ok) return false;
  const flag = Boolean(opts?.flag);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(flag, 'screen-saver');
  }
  return true;
});

ipcMain.handle('studyos:set-kiosk-mode', (event, opts) => {
  if (!assertSender(event)) return false;
  const check = validateIpc('studyos:set-kiosk-mode', opts || {});
  if (!check.ok) return false;
  const flag = Boolean(opts?.flag);
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (flag) {
      mainWindow.setKiosk(true);
      registerKioskShortcuts();
    } else {
      mainWindow.setKiosk(false);
      unregisterKioskShortcuts();
    }
  }
  return true;
});

ipcMain.handle('studyos:set-exam-mode', (event, opts) => {
  if (!assertSender(event)) return false;
  const check = validateIpc('studyos:set-exam-mode', opts || {});
  if (!check.ok) return false;
  const flag = Boolean(opts?.flag);
  activeExamAllowlist = Array.isArray(opts?.allowlist) ? opts.allowlist : [];
  studyMode = flag;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (flag) {
      mainWindow.setKiosk(true);
      registerKioskShortcuts();
    } else {
      mainWindow.setKiosk(false);
      unregisterKioskShortcuts();
    }
  }
  return true;
});

ipcMain.handle('studyos:open-downloaded-file', (event, opts) => {
  if (!assertSender(event)) return false;
  const check = validateIpc('studyos:open-downloaded-file', opts || {});
  if (!check.ok) return false;
  if (opts?.filePath && fs.existsSync(opts.filePath)) {
    shell.showItemInFolder(opts.filePath);
    return true;
  }
  return false;
});

ipcMain.handle('studyos:get-app-path', (event) => {
  if (!assertSender(event)) return null;
  return app.getPath('userData');
});
ipcMain.handle('studyos:get-version', (event) => {
  if (!assertSender(event)) return null;
  return app.getVersion();
});
ipcMain.handle('studyos:is-offline', (event) => {
  if (!assertSender(event)) return true;
  return true;
});

ipcMain.handle('studyos:save-file-dialog', async (event, opts) => {
  if (!assertSender(event)) return { ok: false, error: 'Unauthorized sender' };
  const check = validateIpc('studyos:save-file-dialog', opts);
  if (!check.ok) return { ok: false, error: check.error };
  const payload = opts && typeof opts === 'object' ? opts : {};
  const content = payload.content;
  if (typeof content !== 'string') return { ok: false, error: 'Invalid content' };
  if (content.length > MAX_IPC_CONTENT_BYTES) return { ok: false, error: 'Content too large' };
  const encoding = ALLOWED_SAVE_ENCODINGS.has(payload.encoding) ? payload.encoding : 'utf8';
  const filters = Array.isArray(payload.filters) ? payload.filters : [{ name: 'JSON', extensions: ['json'] }];
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File',
    defaultPath: sanitizeDefaultPath(payload.defaultPath),
    filters,
  });
  if (result.canceled || !result.filePath) return { ok: false };
  try {
    const target = path.resolve(result.filePath);
    // Block path traversal / null bytes
    if (target.includes('\0') || target.includes('..')) {
      return { ok: false, error: 'Invalid path' };
    }
    fs.writeFileSync(target, content, encoding);
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('studyos:open-file-dialog', async (event, opts) => {
  if (!assertSender(event)) return { ok: false, error: 'Unauthorized sender' };
  const check = validateIpc('studyos:open-file-dialog', opts || {});
  if (!check.ok) return { ok: false, error: check.error };
  const payload = opts && typeof opts === 'object' ? opts : {};
  const filters = Array.isArray(payload.filters) ? payload.filters : [{ name: 'JSON', extensions: ['json'] }];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open File',
    properties: ['openFile'],
    filters,
  });
  if (result.canceled || !result.filePaths?.length) return { ok: false };
  try {
    const filePath = path.resolve(result.filePaths[0]);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, error: 'Not a file' };
    if (stat.size > MAX_IPC_CONTENT_BYTES) return { ok: false, error: 'File too large' };
    const real = fs.realpathSync(filePath);
    if (real.includes('\0')) return { ok: false, error: 'Invalid path' };
    const content = fs.readFileSync(real, 'utf8');
    return { ok: true, path: real, content };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

// OS secure credential storage (Keychain / DPAPI / libsecret)
ipcMain.handle('studyos:encrypt-string', async (event, opts) => {
  if (!assertSender(event)) return null;
  const check = validateIpc('studyos:encrypt-string', opts);
  if (!check.ok) return null;
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const buf = safeStorage.encryptString(String(opts.plain));
    return buf.toString('base64');
  } catch {
    return null;
  }
});

ipcMain.handle('studyos:decrypt-string', async (event, opts) => {
  if (!assertSender(event)) return null;
  const check = validateIpc('studyos:decrypt-string', opts);
  if (!check.ok) return null;
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const buf = Buffer.from(String(opts.cipher), 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    nativeTheme.themeSource = 'system';
    createSplash();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Hard offline: never allow certificate prompts / insecure remote
app.on('certificate-error', (event) => {
  event.preventDefault();
});


// Native desktop notifications (offline)
ipcMain.on('studyos:show-notification', (event, payload) => {
  try {
    if (!assertSender(event)) return;
    const check = validateIpc('studyos:show-notification', payload || {});
    if (!check.ok) return;
    const safe = payload && typeof payload === 'object' ? payload : {};
    const title = String(safe.title || 'StudyOS').slice(0, 120);
    const body = String(safe.body || '').slice(0, 500);
    if (Notification.isSupported()) {
      const n = new Notification({
        title,
        body,
        silent: false,
      });
      n.show();
    }
  } catch (e) {
    /* ignore */
  }
});

// ============================================================================
// AUTOMATIC UPDATE SYSTEM (Public GitHub Releases via electron-updater)
// ============================================================================
let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
  }
} catch (err) {
  console.warn('[StudyOS Updater] electron-updater could not be initialized:', err?.message || err);
}

let currentUpdateState = {
  status: 'idle', // 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'upToDate' | 'error'
  currentVersion: app.getVersion() || '1.0.0',
  availableVersion: null,
  releaseNotes: null,
  releaseName: null,
  releaseDate: null,
  progress: 0,
  error: null,
  lastCheckedAt: null,
};

/** Authoritative GitHub release source (renderer Settings can override). */
let updateRepoConfig = {
  owner: (typeof process.env.STUDYOS_UPDATE_OWNER === 'string' && process.env.STUDYOS_UPDATE_OWNER) || 'blackrock-web',
  repo: (typeof process.env.STUDYOS_UPDATE_REPO === 'string' && process.env.STUDYOS_UPDATE_REPO) || 'StudyOS-V2.0.0',
};

function applyUpdateFeedURL() {
  if (!autoUpdater) return;
  try {
    // electron-updater generic provider pointing at GitHub releases for configured repo only
    const owner = updateRepoConfig.owner;
    const repo = updateRepoConfig.repo;
    autoUpdater.setFeedURL({
      provider: 'github',
      owner,
      repo,
      private: false,
    });
    console.info('[StudyOS Updater] Feed set to GitHub', owner + '/' + repo);
  } catch (err) {
    console.warn('[StudyOS Updater] setFeedURL failed:', err?.message || err);
  }
}
if (autoUpdater) {
  applyUpdateFeedURL();
}

function broadcastUpdateStatus() {
  currentUpdateState.currentVersion = app.getVersion() || '1.0.0';
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('studyos:updater-status-changed', { ...currentUpdateState });
    } catch {
      /* ignore */
    }
  }
}

if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    currentUpdateState.status = 'checking';
    currentUpdateState.error = null;
    currentUpdateState.lastCheckedAt = new Date().toISOString();
    broadcastUpdateStatus();
  });

  autoUpdater.on('update-available', (info) => {
    currentUpdateState.status = 'available';
    currentUpdateState.availableVersion = info.version;
    currentUpdateState.releaseName = info.releaseName || `StudyOS v${info.version}`;
    currentUpdateState.releaseDate = info.releaseDate || new Date().toISOString();
    let notes = '';
    if (typeof info.releaseNotes === 'string') {
      notes = info.releaseNotes;
    } else if (Array.isArray(info.releaseNotes)) {
      notes = info.releaseNotes.map((n) => (n && typeof n === 'object' ? n.note : String(n))).join('\n');
    }
    currentUpdateState.releaseNotes = notes || 'New update available from GitHub Releases.';
    currentUpdateState.error = null;
    broadcastUpdateStatus();
  });

  autoUpdater.on('update-not-available', (_info) => {
    currentUpdateState.status = 'upToDate';
    currentUpdateState.availableVersion = null;
    currentUpdateState.error = null;
    broadcastUpdateStatus();
  });

  autoUpdater.on('error', (err) => {
    // Gracefully handle offline or unreachable network
    currentUpdateState.status = 'error';
    const msg = err && err.message ? err.message : 'Network unreachable or no release available';
    currentUpdateState.error = msg;
    broadcastUpdateStatus();
  });

  autoUpdater.on('download-progress', (progressObj) => {
    currentUpdateState.status = 'downloading';
    currentUpdateState.progress = Math.round(progressObj?.percent || 0);
    broadcastUpdateStatus();
  });

  autoUpdater.on('update-downloaded', (info) => {
    currentUpdateState.status = 'downloaded';
    currentUpdateState.progress = 100;
    currentUpdateState.availableVersion = info.version;
    broadcastUpdateStatus();
  });
}

// Safe IPC Handlers for Updater
ipcMain.handle('studyos:updater-set-repo', async (event, opts) => {
  if (!assertSender(event)) return { ok: false, error: 'Unauthorized' };
  const owner = String(opts?.owner || '').trim();
  const repo = String(opts?.repo || '').trim().replace(/\.git$/i, '');
  if (!owner || !repo) return { ok: false, error: 'owner and repo are required' };
  updateRepoConfig = { owner, repo };
  applyUpdateFeedURL();
  return { ok: true, owner, repo };
});

ipcMain.handle('studyos:updater-check', async (event) => {
  if (!assertSender(event)) return { ok: false, error: 'Unauthorized' };
  currentUpdateState.lastCheckedAt = new Date().toISOString();
  currentUpdateState.error = null;

  if (!app.isPackaged) {
    // Unpackaged / dev: let the renderer GitHub API path be authoritative
    currentUpdateState.status = 'idle';
    broadcastUpdateStatus();
    return { ok: false, error: 'dev mode — use renderer GitHub Releases API', state: { ...currentUpdateState } };
  }

  if (!autoUpdater) {
    currentUpdateState.status = 'error';
    currentUpdateState.error = 'Updater module unavailable';
    broadcastUpdateStatus();
    return { ok: false, error: 'Updater module unavailable', state: { ...currentUpdateState } };
  }

  try {
    applyUpdateFeedURL();
    currentUpdateState.status = 'checking';
    broadcastUpdateStatus();
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, result: result ? { version: result.updateInfo?.version } : null, state: { ...currentUpdateState } };
  } catch (err) {
    currentUpdateState.status = 'error';
    currentUpdateState.error = err?.message || 'Check failed (offline or server unreachable)';
    broadcastUpdateStatus();
    return { ok: false, error: currentUpdateState.error, state: { ...currentUpdateState } };
  }
});

ipcMain.handle('studyos:updater-download', async (event) => {
  if (!assertSender(event)) return { ok: false, error: 'Unauthorized' };
  if (!app.isPackaged) {
    currentUpdateState.status = 'downloaded';
    currentUpdateState.progress = 100;
    broadcastUpdateStatus();
    return { ok: true, state: { ...currentUpdateState } };
  }

  if (!autoUpdater) {
    return { ok: false, error: 'Updater not available' };
  }

  try {
    currentUpdateState.status = 'downloading';
    currentUpdateState.progress = 0;
    broadcastUpdateStatus();
    await autoUpdater.downloadUpdate();
    return { ok: true, state: { ...currentUpdateState } };
  } catch (err) {
    currentUpdateState.status = 'error';
    currentUpdateState.error = err?.message || 'Download failed';
    broadcastUpdateStatus();
    return { ok: false, error: currentUpdateState.error, state: { ...currentUpdateState } };
  }
});

ipcMain.handle('studyos:updater-install', async (event) => {
  if (!assertSender(event)) return { ok: false, error: 'Unauthorized' };
  if (!app.isPackaged) {
    currentUpdateState.status = 'installing';
    broadcastUpdateStatus();
    return { ok: true };
  }

  if (!autoUpdater) {
    return { ok: false, error: 'Updater not available' };
  }

  try {
    currentUpdateState.status = 'installing';
    broadcastUpdateStatus();
    // In-place upgrade: install over existing app without uninstall; userData is preserved.
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (e) {
        console.error('[StudyOS Updater] quitAndInstall failed', e);
      }
    });
    return { ok: true };
  } catch (err) {
    currentUpdateState.status = 'error';
    currentUpdateState.error = err?.message || 'Installation trigger failed';
    broadcastUpdateStatus();
    return { ok: false, error: currentUpdateState.error };
  }
});

ipcMain.handle('studyos:updater-get-status', (event) => {
  if (!assertSender(event)) return null;
  currentUpdateState.currentVersion = app.getVersion() || '1.0.0';
  return { ...currentUpdateState };
});

// Non-blocking auto-check with delay after window is shown
function scheduleInitialUpdateCheck() {
  if (app.isPackaged && autoUpdater) {
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates().catch(() => {
          // Silent offline catch
        });
      } catch {
        /* ignore */
      }
    }, 8000); // 8 second startup delay
  }
}

