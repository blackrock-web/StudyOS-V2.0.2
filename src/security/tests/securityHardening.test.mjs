/**
 * StudyOS production security + reliability regression tests
 * Run: node src/security/tests/securityHardening.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    console.error('  ✗', name, '\n   ', e.message);
  }
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('\nStudyOS Production Readiness Tests\n');

// --- Prior security baseline ---
test('backupValidation module exists', () => {
  const src = read('src/services/backupValidation.ts');
  assert.ok(src.includes('ALLOWED_ROOT_KEYS'));
  assert.ok(src.includes('__proto__'));
});

test('cryptoService PBKDF2', () => {
  const src = read('src/services/cryptoService.ts');
  assert.ok(src.includes('PBKDF2'));
  assert.ok(/310_?000/.test(src));
});

test('auth uses verifySecret + rate limit', () => {
  const src = read('src/services/auth.ts');
  assert.ok(src.includes('verifySecret'));
  assert.ok(src.includes('checkLoginAllowed'));
  assert.ok(src.includes('recordLoginFailure'));
  assert.ok(src.includes('recordLoginSuccess'));
});

test('rateLimitService progressive lockout', () => {
  const src = read('src/services/rateLimitService.ts');
  assert.ok(src.includes('MAX_ATTEMPTS'));
  assert.ok(src.includes('lockedUntil'));
  assert.ok(src.includes('lockDurationMs'));
});

test('PDFTextLayer no untrusted innerHTML', () => {
  const src = read('src/components/pdf/PDFTextLayer.tsx');
  assert.ok(!src.includes('div.innerHTML'));
});

test('markdown sanitizer blocks javascript:', () => {
  const src = read('src/services/markdownSanitize.ts');
  assert.ok(src.includes('javascript:'));
  assert.ok(src.includes('sanitizeMarkdown'));
});

test('IPC schema allowlist', () => {
  const src = read('electron/ipcValidate.cjs');
  assert.ok(src.includes('studyos:save-file-dialog'));
  assert.ok(src.includes('additionalProperties'));
});

test('Electron hardening flags', () => {
  const src = read('electron/main.cjs');
  assert.ok(src.includes('contextIsolation: true'));
  assert.ok(src.includes('sandbox: true'));
  assert.ok(src.includes('nodeIntegration: false'));
  assert.ok(src.includes('webSecurity: true'));
  assert.ok(src.includes('validateIpc'));
  assert.ok(src.includes('safeStorage'));
});

test('CSP no unsafe-eval', () => {
  const src = read('index.html');
  assert.ok(!src.includes('unsafe-eval'));
  assert.ok(src.includes("script-src 'self'"));
});

test('no Gemini fetch in NotesView', () => {
  assert.ok(!read('src/components/NotesView.tsx').includes('fetch("/api/ai'));
});

test('secureStorage AES-GCM', () => {
  assert.ok(read('src/services/secureStorage.ts').includes('AES-GCM'));
});

test('path traversal guards', () => {
  const src = read('electron/main.cjs');
  assert.ok(src.includes('realpathSync') || src.includes('path.resolve'));
});

// --- Reliability ---
test('journalService WAL + recovery', () => {
  const src = read('src/services/journalService.ts');
  assert.ok(src.includes('runTransaction'));
  assert.ok(src.includes('recoverPendingJournals'));
  assert.ok(src.includes('committed'));
});

test('App boots journal recovery', () => {
  const src = read('src/App.tsx');
  assert.ok(src.includes('recoverPendingJournals'));
});

test('backupIntegrity HMAC envelope', () => {
  const src = read('src/services/backupIntegrity.ts');
  assert.ok(src.includes('HMAC'));
  assert.ok(src.includes('createSecureBackup'));
  assert.ok(src.includes('verifyAndExtractBackup'));
  assert.ok(src.includes('STUDYOS_BACKUP'));
});

test('SettingsBackup uses integrity verification', () => {
  const src = read('src/components/settings/SettingsBackup.tsx');
  assert.ok(src.includes('verifyAndExtractBackup') || src.includes('createSecureBackup'));
});

// --- Quick Focus ---
test('QuickFocusPanel exists with CRUD + popup', () => {
  const src = read('src/components/dashboard/QuickFocusPanel.tsx');
  assert.ok(src.includes('QuickFocusPanel'));
  assert.ok(src.includes('syncService'));
  assert.ok(src.includes('role="dialog"'));
  assert.ok(src.includes('aria-modal'));
  assert.ok(src.includes('handleUndo'));
  assert.ok(src.includes('onDragStart') || src.includes('draggable'));
  assert.ok(src.includes('duplicateTask'));
  assert.ok(src.includes('bulkComplete') || src.includes('Bulk'));
});

test('Dashboard wires QuickFocusPanel', () => {
  const src = read('src/components/dashboard/OverviewDashboard.tsx');
  assert.ok(src.includes('QuickFocusPanel'));
});

test('TaskItem has Quick Focus extension fields', () => {
  const src = read('src/types/index.ts');
  assert.ok(src.includes('orderIndex'));
  assert.ok(src.includes('pinned'));
  assert.ok(src.includes('colorTag'));
});

// --- Offline integrity scan ---
test('no live /api/ai fetch in PDFWorkspace', () => {
  const src = read('src/components/pdf/PDFWorkspace.tsx');
  assert.ok(!src.includes('fetch("/api/ai'));
  assert.ok(!src.includes('fetch("/api/pdf/upload"'));
});

test('preload minimal surface', () => {
  const src = read('electron/preload.cjs');
  assert.ok(src.includes('contextBridge.exposeInMainWorld'));
  assert.ok(src.includes('encryptSecure'));
  assert.ok(!src.includes('require(') || src.includes("require('electron')"));
});

test('package.json has test:security script', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.scripts['test:security']);
});

// --- A11y markers on Quick Focus ---
test('Quick Focus accessibility labels', () => {
  const src = read('src/components/dashboard/QuickFocusPanel.tsx');
  assert.ok(src.includes('aria-label'));
  assert.ok(src.includes('tabIndex') || src.includes('tabindex') || src.includes('role="button"'));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
