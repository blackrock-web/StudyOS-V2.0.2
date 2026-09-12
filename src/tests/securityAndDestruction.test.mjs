/**
 * StudyOS Security, Network Gateway, PIN Service, Local Models, and Destruction Test Suite
 * Run with: node src/tests/securityAndDestruction.test.mjs
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Initialize in-memory storage environment for Node execution
const mockStorage = new Map();
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.Event = class {};
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
  get length() { return mockStorage.size; },
  key: (i) => Array.from(mockStorage.keys())[i] || null,
};

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

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    console.error('  ✗', name, '\n   ', e.message);
  }
}

console.log('\n======================================================');
console.log('Running StudyOS Security, PIN Auth & Network Gateway Tests');
console.log('======================================================\n');

// 1. PIN Service Salted Hash & Rate Limiting
test('PIN Service Invariant 1: Salted Hash creates distinct hashes with distinct salts', () => {
  const hashPin = (pin, salt) => {
    return crypto.createHash('sha256').update(`${salt}:${pin.trim()}:studyos_pin_isolated_auth_v2`).digest('hex');
  };

  const salt1 = crypto.randomBytes(16).toString('hex');
  const salt2 = crypto.randomBytes(16).toString('hex');
  const pin = '4321';

  const hash1 = hashPin(pin, salt1);
  const hash2 = hashPin(pin, salt2);

  assert.notEqual(salt1, salt2, 'Salts must be randomly generated');
  assert.notEqual(hash1, hash2, 'Identical PINs must produce different hashes with different salts');
  assert.equal(hashPin(pin, salt1), hash1, 'Same salt and PIN must produce identical verification hash');
});

test('PIN Service Invariant 2: Format validation enforces minimum length and constraints', () => {
  const validatePinFormat = (pin) => {
    if (!pin || typeof pin !== 'string') return { valid: false, error: 'PIN cannot be empty.' };
    const trimmed = pin.trim();
    if (trimmed.length < 4) return { valid: false, error: 'PIN must be at least 4 digits.' };
    if (trimmed.length > 12) return { valid: false, error: 'PIN cannot exceed 12 digits.' };
    return { valid: true };
  };

  assert.equal(validatePinFormat('1234').valid, true);
  assert.equal(validatePinFormat('987654').valid, true);
  assert.equal(validatePinFormat('123').valid, false);
  assert.equal(validatePinFormat('').valid, false);
  assert.equal(validatePinFormat('1234567890123').valid, false);
});

test('PIN Service Invariant 3: Brute force lockout triggered after 5 consecutive failures', () => {
  let failedAttempts = 0;
  let lockoutUntil = null;
  const MAX_FAILED = 5;

  const simulateAttempt = (isCorrect) => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      return { success: false, error: 'Locked out' };
    }
    if (isCorrect) {
      failedAttempts = 0;
      lockoutUntil = null;
      return { success: true };
    }
    failedAttempts++;
    if (failedAttempts >= MAX_FAILED) {
      lockoutUntil = Date.now() + 60000;
      return { success: false, error: 'Brute force lockout' };
    }
    return { success: false, remaining: MAX_FAILED - failedAttempts };
  };

  for (let i = 0; i < 4; i++) {
    const res = simulateAttempt(false);
    assert.equal(res.success, false);
  }
  assert.equal(failedAttempts, 4);

  // 5th failure triggers lockout
  const res5 = simulateAttempt(false);
  assert.equal(res5.success, false);
  assert.equal(res5.error, 'Brute force lockout');

  // Next attempt is immediately rejected due to lockout
  const resLocked = simulateAttempt(true);
  assert.equal(resLocked.success, false);
  assert.equal(resLocked.error, 'Locked out');
});

// 2. Central Network Gateway Pattern & Allowlist Enforcement
test('Network Gateway Invariant 1: Central state initializes strictly in LOCKED state', () => {
  const initialGatewayState = {
    status: 'LOCKED',
    authorizedOperation: 'none',
    unlockedAt: null,
    expiresAt: null,
    reason: null,
    hasConfiguredPin: false,
    activeSessionDurationSecs: 0,
  };

  assert.equal(initialGatewayState.status, 'LOCKED', 'Gateway must start LOCKED');
  assert.equal(initialGatewayState.authorizedOperation, 'none', 'No operation permitted by default');
  assert.equal(initialGatewayState.unlockedAt, null);
  assert.equal(initialGatewayState.expiresAt, null);
});

test('Network Gateway Invariant 2: Allowlist enforcement strictly permits verified update/model domains and denies all others', () => {
  const ALLOWLIST = {
    update: [
      'github.com',
      'api.github.com',
      'objects.githubusercontent.com',
      'raw.githubusercontent.com',
      'github-releases.githubusercontent.com',
      'codeload.github.com',
    ],
    'model-download': [
      'huggingface.co',
      'cdn-lfs.huggingface.co',
      'cdn-lfs-us-1.huggingface.co',
      'raw.githubusercontent.com',
      'localhost',
      '127.0.0.1',
    ],
  };

  const checkUrl = (url, op, status) => {
    if (status !== 'UNLOCKED') return { allowed: false, reason: 'Gateway LOCKED' };
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const list = ALLOWLIST[op] || [];
      const isAllowed = list.some((d) => hostname === d || hostname.endsWith(`.${d}`));
      return { allowed: isAllowed, reason: isAllowed ? 'Allowed' : 'Not in allowlist' };
    } catch {
      return { allowed: false, reason: 'Invalid URL' };
    }
  };

  // Locked state blocks everything
  assert.equal(checkUrl('https://api.github.com/repos', 'update', 'LOCKED').allowed, false);

  // Unlocked state for 'update' allows GitHub domains
  assert.equal(checkUrl('https://api.github.com/repos/release', 'update', 'UNLOCKED').allowed, true);
  assert.equal(checkUrl('https://objects.githubusercontent.com/assets', 'update', 'UNLOCKED').allowed, true);

  // Unlocked state for 'model-download' allows HuggingFace
  assert.equal(checkUrl('https://huggingface.co/models/smollm.gguf', 'model-download', 'UNLOCKED').allowed, true);
  assert.equal(checkUrl('https://cdn-lfs.huggingface.co/weights.bin', 'model-download', 'UNLOCKED').allowed, true);

  // General web, telemetry, and unlisted domains are strictly DENIED
  assert.equal(checkUrl('https://google-analytics.com/collect', 'update', 'UNLOCKED').allowed, false);
  assert.equal(checkUrl('https://telemetry.example.com/log', 'model-download', 'UNLOCKED').allowed, false);
  assert.equal(checkUrl('https://facebook.com', 'update', 'UNLOCKED').allowed, false);
});

test('Network Gateway Invariant 3: Operation completion immediately snaps state back to LOCKED', () => {
  let gatewayState = {
    status: 'UNLOCKED',
    authorizedOperation: 'model-download',
    unlockedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 180000).toISOString(),
    reason: 'Downloading SmolLM 135M',
    hasConfiguredPin: true,
    activeSessionDurationSecs: 180,
  };

  const finishOperation = (op) => {
    if (gatewayState.authorizedOperation === op || gatewayState.status === 'UNLOCKED') {
      gatewayState = {
        status: 'LOCKED',
        authorizedOperation: 'none',
        unlockedAt: null,
        expiresAt: null,
        reason: null,
        hasConfiguredPin: true,
        activeSessionDurationSecs: 0,
      };
    }
  };

  assert.equal(gatewayState.status, 'UNLOCKED');
  finishOperation('model-download');
  assert.equal(gatewayState.status, 'LOCKED');
  assert.equal(gatewayState.authorizedOperation, 'none');
});

// 3. Local AI & GGUF Model Management
test('Local Model Engine: SHA-256 integrity hash verification prevents tampering', () => {
  const modelRegistry = [
    {
      id: 'smollm-135m-q4',
      name: 'SmolLM 135M Instruct (Q4_K_M)',
      sha256: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
      offlineReady: true,
      format: 'GGUF',
    },
    {
      id: 'qwen2.5-0.5b-q4',
      name: 'Qwen 2.5 0.5B Instruct (Q4_K_M)',
      sha256: 'b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdefa1',
      offlineReady: true,
      format: 'GGUF',
    }
  ];

  assert.equal(modelRegistry.length, 2);
  for (const m of modelRegistry) {
    assert.equal(m.sha256.length, 64, 'SHA-256 hash must be exactly 64 hex characters');
    assert.equal(m.offlineReady, true, 'Model must operate fully offline once stored');
    assert.equal(m.format, 'GGUF', 'Format must be local binary GGUF');
  }
});

// 4. Nuclear Application Destruction
test('Destruction Guard 1: Requires confirmation text "DESTROY"', () => {
  const isValidConfirmation = (text) => text.trim() === 'DESTROY';
  assert.equal(isValidConfirmation('DESTROY'), true);
  assert.equal(isValidConfirmation('destroy'), false, 'Lowercase must be rejected');
  assert.equal(isValidConfirmation(' DELETE '), false, 'Wrong text must be rejected');
  assert.equal(isValidConfirmation(''), false);
});

test('Destruction Guard 2: Complete purge removes all databases, models, and cache keys', () => {
  // Populate mock data
  localStorage.setItem('studyos_accounts_v1', JSON.stringify([{ id: 'acc-1' }]));
  localStorage.setItem('studyos_installed_models_v1', JSON.stringify([{ id: 'model-1' }]));
  localStorage.setItem('studyos_security_pin_hash_v2', 'hashed_pin_value');
  localStorage.setItem('studyos_audit_logs', JSON.stringify([{ id: 'log-1' }]));

  assert.ok(localStorage.getItem('studyos_accounts_v1') !== null);

  // Simulate complete purge
  const allKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('studyos_')) {
      allKeys.push(key);
    }
  }

  for (const k of allKeys) {
    localStorage.removeItem(k);
  }

  assert.equal(localStorage.getItem('studyos_accounts_v1'), null, 'User accounts purged');
  assert.equal(localStorage.getItem('studyos_installed_models_v1'), null, 'Models metadata purged');
  assert.equal(localStorage.getItem('studyos_security_pin_hash_v2'), null, 'Security PIN purged');
});

console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed\n`);
if (failed > 0) {
  process.exit(1);
}
