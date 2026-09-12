/**
 * Lightweight runtime IPC schema validation (no external deps).
 * Rejects unknown fields, wrong types, oversized payloads.
 */

const MAX_STRING = 25 * 1024 * 1024;
const MAX_ARRAY = 100;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

function rejectProto(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__')) return 'prototype pollution';
  if (Object.prototype.hasOwnProperty.call(obj, 'constructor')) return 'forbidden constructor';
  return null;
}

/**
 * @param {unknown} value
 * @param {{ type: string, optional?: boolean, maxLen?: number, allowed?: string[], properties?: Record<string, any>, additionalProperties?: boolean }} schema
 */
function validate(value, schema, path = 'root') {
  if (value === undefined || value === null) {
    if (schema.optional) return null;
    return `${path}: required`;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return `${path}: expected string`;
    const max = schema.maxLen ?? MAX_STRING;
    if (value.length > max) return `${path}: too long`;
    if (schema.allowed && !schema.allowed.includes(value)) return `${path}: not allowed`;
    return null;
  }
  if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${path}: expected number`;
    return null;
  }
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') return `${path}: expected boolean`;
    return null;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `${path}: expected array`;
    if (value.length > (schema.maxLen || MAX_ARRAY)) return `${path}: array too large`;
    return null;
  }
  if (schema.type === 'object') {
    if (!isPlainObject(value)) return `${path}: expected plain object`;
    const pollute = rejectProto(value);
    if (pollute) return `${path}: ${pollute}`;
    const props = schema.properties || {};
    const keys = Object.keys(value);
    if (schema.additionalProperties === false) {
      for (const k of keys) {
        if (!(k in props)) return `${path}: unknown field ${k}`;
      }
    }
    for (const [k, sub] of Object.entries(props)) {
      const err = validate(value[k], sub, `${path}.${k}`);
      if (err) return err;
    }
    return null;
  }
  return `${path}: unknown schema type`;
}

const SCHEMAS = {
  'studyos:save-file-dialog': {
    type: 'object',
    additionalProperties: false,
    properties: {
      defaultPath: { type: 'string', optional: true, maxLen: 200 },
      filters: { type: 'array', optional: true, maxLen: 20 },
      content: { type: 'string', maxLen: MAX_STRING },
      encoding: { type: 'string', optional: true, maxLen: 16, allowed: ['utf8', 'utf-8', 'base64', 'binary'] },
    },
  },
  'studyos:open-file-dialog': {
    type: 'object',
    optional: true,
    additionalProperties: false,
    properties: {
      filters: { type: 'array', optional: true, maxLen: 20 },
    },
  },
  'studyos:show-notification': {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', optional: true, maxLen: 120 },
      body: { type: 'string', optional: true, maxLen: 500 },
    },
  },
  'studyos:encrypt-string': {
    type: 'object',
    additionalProperties: false,
    properties: {
      plain: { type: 'string', maxLen: 2_000_000 },
    },
  },
  'studyos:decrypt-string': {
    type: 'object',
    additionalProperties: false,
    properties: {
      cipher: { type: 'string', maxLen: 2_500_000 },
    },
  },
  'studyos:get-study-mode': {
    type: 'object',
    optional: true,
  },
  'studyos:set-study-mode': {
    type: 'object',
    additionalProperties: false,
    properties: {
      mode: { type: 'boolean' },
    },
  },
  'studyos:set-always-on-top': {
    type: 'object',
    additionalProperties: false,
    properties: {
      flag: { type: 'boolean' },
    },
  },
  'studyos:set-kiosk-mode': {
    type: 'object',
    additionalProperties: false,
    properties: {
      flag: { type: 'boolean' },
    },
  },
  'studyos:set-exam-mode': {
    type: 'object',
    additionalProperties: false,
    properties: {
      flag: { type: 'boolean' },
      allowlist: { type: 'array', optional: true, maxLen: 50 },
    },
  },
  'studyos:open-downloaded-file': {
    type: 'object',
    additionalProperties: false,
    properties: {
      filePath: { type: 'string', maxLen: 1000 },
    },
  },
  'studyos:updater-set-repo': {
    type: 'object',
    optional: true,
    additionalProperties: false,
    properties: {
      owner: { type: 'string', maxLen: 100 },
      repo: { type: 'string', maxLen: 200 },
    },
  },
  'studyos:updater-check': {
    type: 'object',
    optional: true,
    additionalProperties: false,
    properties: {},
  },
  'studyos:updater-download': {
    type: 'object',
    optional: true,
    additionalProperties: false,
    properties: {},
  },
  'studyos:updater-install': {
    type: 'object',
    optional: true,
    additionalProperties: false,
    properties: {},
  },
  'studyos:updater-get-status': {
    type: 'object',
    optional: true,
    additionalProperties: false,
    properties: {},
  },
};

function validateIpc(channel, payload) {
  const schema = SCHEMAS[channel];
  if (!schema) return { ok: false, error: `channel not allowlisted: ${channel}` };
  if (payload === undefined && schema.optional) return { ok: true };
  const err = validate(payload, schema);
  if (err) return { ok: false, error: err };
  return { ok: true };
}

module.exports = { validateIpc, SCHEMAS };
