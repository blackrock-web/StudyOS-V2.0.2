/**
 * PDF resource exhaustion limits for offline PDF.js usage.
 */

export const PDF_SECURITY_LIMITS = {
  maxFileBytes: 80 * 1024 * 1024, // 80 MB
  maxPages: 2000,
  maxEmbeddedObjects: 5000,
  maxDecompressionRatio: 100, // compressed → expanded
  maxParseMs: 60_000,
  maxRecursionDepth: 32,
} as const;

export interface PdfGuardResult {
  ok: boolean;
  error?: string;
}

export function validatePdfFileMeta(file: { size?: number; name?: string; type?: string }): PdfGuardResult {
  const size = file.size ?? 0;
  if (size <= 0) return { ok: false, error: 'Empty or unknown file size' };
  if (size > PDF_SECURITY_LIMITS.maxFileBytes) {
    return { ok: false, error: `PDF exceeds ${PDF_SECURITY_LIMITS.maxFileBytes} byte limit` };
  }
  const name = (file.name || '').toLowerCase();
  if (name && !name.endsWith('.pdf') && file.type && file.type !== 'application/pdf') {
    return { ok: false, error: 'Only PDF files are allowed' };
  }
  if (file.type && file.type !== 'application/pdf' && file.type !== 'application/x-pdf' && !name.endsWith('.pdf')) {
    return { ok: false, error: `Invalid MIME type: ${file.type}` };
  }
  // Block path-like names
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return { ok: false, error: 'Invalid filename' };
  }
  return { ok: true };
}

export function validatePdfDocument(doc: { numPages?: number }): PdfGuardResult {
  const pages = doc.numPages ?? 0;
  if (pages <= 0) return { ok: false, error: 'PDF has no pages' };
  if (pages > PDF_SECURITY_LIMITS.maxPages) {
    return { ok: false, error: `PDF exceeds max page count (${PDF_SECURITY_LIMITS.maxPages})` };
  }
  return { ok: true };
}

export async function withPdfParseTimeout<T>(promise: Promise<T>, ms = PDF_SECURITY_LIMITS.maxParseMs): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('PDF parse timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Treat all extracted PDF text as untrusted */
export function untrustedPdfText(s: string): string {
  if (typeof s !== 'string') return '';
  return s.slice(0, 500_000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
