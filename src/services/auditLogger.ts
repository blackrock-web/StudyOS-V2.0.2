/**
 * Typed audit logger — immutable entries, correct field mapping.
 * Call with a single strongly-typed object to avoid positional-arg mixups.
 */

export type AuditSeverity = 'INFO' | 'WARNING' | 'SECURITY' | 'SYSTEM' | 'ERROR';
export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'ATTEMPT';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  severity: AuditSeverity;
  username: string;
  status: AuditStatus;
  actingRole?: string;
  /** @deprecated use severity */
  type?: string;
  accountUsername?: string;
  ipAddress?: string;
}

export interface AuditLogInput {
  action: string;
  details: string;
  severity?: AuditSeverity;
  username?: string;
  status?: AuditStatus;
  actingRole?: string;
}

class AuditLogger {
  private readonly STORAGE_KEY = 'studyos_audit_logs';
  private readonly MAX_ENTRIES = 200;

  public record(input: AuditLogInput): void {
    const username = (input.username || 'local').slice(0, 128);
    const entry: AuditLogEntry = Object.freeze({
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
      action: String(input.action || 'UNKNOWN').slice(0, 128),
      details: String(input.details || '').slice(0, 2000),
      severity: input.severity || 'SYSTEM',
      username,
      status: input.status || 'SUCCESS',
      type: input.severity || 'SYSTEM',
      accountUsername: username,
      ipAddress: '127.0.0.1',
    });

    const logs = this.getLogs();
    logs.unshift(entry);
    this.setLogs(logs.slice(0, this.MAX_ENTRIES));
  }

  /**
   * Backward-compatible positional API.
   * Detects severity-like 3rd args (common buggy call sites) and remaps.
   */
  public log(
    action: string,
    details: string,
    arg3: string = 'local',
    arg4: string = 'SYSTEM',
    arg5: string = 'SUCCESS'
  ): void {
    const severitySet = new Set(['INFO', 'WARNING', 'SECURITY', 'SYSTEM', 'ERROR']);
    let username = 'local';
    let severity: AuditSeverity = 'SYSTEM';
    let status: AuditStatus = 'SUCCESS';

    if (severitySet.has(String(arg3).toUpperCase())) {
      severity = String(arg3).toUpperCase() as AuditSeverity;
      username = arg4 || 'local';
      const s = String(arg5 || '').toUpperCase();
      if (s === 'SUCCESS' || s === 'FAILURE' || s === 'ATTEMPT') {
        status = s as AuditStatus;
      } else {
        status = severity === 'WARNING' || severity === 'ERROR' ? 'FAILURE' : 'SUCCESS';
      }
    } else {
      username = arg3 || 'local';
      if (severitySet.has(String(arg4).toUpperCase())) {
        severity = String(arg4).toUpperCase() as AuditSeverity;
      }
      const s = String(arg5 || '').toUpperCase();
      if (s === 'SUCCESS' || s === 'FAILURE' || s === 'ATTEMPT') {
        status = s as AuditStatus;
      }
    }

    this.record({ action, details, username, severity, status });
  }

  public logEvent(
    inputOrAction: AuditLogInput | string,
    details?: string,
    severityOrUsername?: string,
    arg4?: string,
    arg5?: string
  ): void {
    if (typeof inputOrAction === 'object') {
      this.record(inputOrAction);
    } else {
      this.log(inputOrAction, details || '', severityOrUsername, arg4, arg5);
    }
  }

  public getLogs(): AuditLogEntry[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e): e is AuditLogEntry =>
          Boolean(e && typeof e === 'object' && typeof e.action === 'string' && typeof e.timestamp === 'string')
      );
    } catch {
      return [];
    }
  }

  public clearLogs(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private setLogs(logs: AuditLogEntry[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    } catch {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs.slice(0, 20)));
      } catch {
        try {
          localStorage.removeItem(this.STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export const auditLogger = new AuditLogger();
