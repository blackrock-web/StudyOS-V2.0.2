import { UserProfile, UserRole } from '../types';
import { auditLogger } from './auditLogger';
import {
  hashSecret,
  verifySecret,
  isLegacyHash,
  secureUUID,
  legacyHashString,
} from './cryptoService';
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
} from './rateLimitService';

const ACCOUNTS_KEY = 'studyos_accounts_list';
const CURRENT_ACCOUNT_KEY = 'studyos_current_account_id';
const WORKSPACE_LOCKED_KEY = 'studyos_workspace_locked';
const SESSION_PERSIST_KEY = 'studyos_session_remember_me';
const PARENT_LINKING_CODES_KEY = 'studyos_parent_linking_codes';

export interface ParentLinkingCodeRecord {
  code: string;
  studentAccountId: string;
  studentUsername: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedByUsername?: string;
  usedAt?: string;
}

/** @deprecated Use hashSecret from cryptoService — kept for rare sync call sites during migration */
export function hashString(str: string): string {
  return legacyHashString(str);
}

export function generateUUID(): string {
  return secureUUID();
}

// Anonymous / Fallback User Profile Template for initial guest registration
export const ANONYMOUS_FALLBACK_USER: UserProfile = {
  accountId: 'guest-pending-registration',
  fullName: 'New Aspirant',
  username: 'guest',
  email: '',
  passwordHash: '',
  pinHash: '',
  role: 'Student',
  securityQuestion: 'What is your target exam?',
  securityAnswerHash: '',
  avatarUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  theme: 'light',
  studyTarget: 'Custom Exam Workspace',
  targetExamType: 'GATE',
  targetExamDate: '2027-02-07',
  dailyGoalHours: 6,
  isOnboarded: false,
  streakDays: 0,
  lastSyncTime: 'Just now',
  storageBytes: 0,
  rememberMe: true,
};

class AuthService {
  private getAccountsList(): UserProfile[] {
    try {
      const data = localStorage.getItem(ACCOUNTS_KEY);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      let needsMigrationSave = false;
      const valid = parsed
        .filter((item): item is UserProfile => Boolean(item && typeof item === 'object' && item.accountId && item.username))
        .map((acc) => {
          // One-time role migration mapping every existing local account to 'Student' by default
          if (acc.role !== 'Student' && acc.role !== 'Parent') {
            needsMigrationSave = true;
            return { ...acc, role: 'Student' as const };
          }
          return acc;
        });

      if (needsMigrationSave) {
        this.saveAccountsList(valid);
      }
      return valid;
    } catch {
      return [];
    }
  }

  private saveAccountsList(accounts: UserProfile[]): void {
    const valid = accounts.filter((item): item is UserProfile => Boolean(item && typeof item === 'object' && item.accountId && item.username));
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(valid));
    } catch (e) {
      console.warn('Quota exceeded when saving accounts list, performing emergency storage cleanup...', e);
      this.cleanOrphanAndHeavySeedKeys(valid.map((a) => a.accountId));
      try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(valid));
      } catch (e2) {
        console.error('Failed to save accounts list even after emergency cleanup:', e2);
      }
    }
  }

  public cleanOrphanAndHeavySeedKeys(validAccountIds?: string[]): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const ids = validAccountIds || this.getAccountsList().map((a) => a.accountId);
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith('studyos_acc_')) {
          const parts = key.split('_');
          const accId = parts[2];
          if (accId && !ids.includes(accId)) {
            keysToRemove.push(key);
          } else if (key.endsWith('_studyos_db_lectures')) {
            // Check if lectures key is unedited and can be pruned
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  const hasUserChanges = parsed.some(
                    (l: any) => Boolean(l.notes) || l.status !== 'Pending' || l.timeSpentMinutes > 0 || l.dppCompleted || (l.revisionCount && l.revisionCount > 0)
                  );
                  if (!hasUserChanges) {
                    keysToRemove.push(key);
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }

      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (err) {
      console.warn('Error cleaning storage keys:', err);
    }
  }

  public getAccounts(): UserProfile[] {
    return this.getAccountsList();
  }

  public getCurrentAccountId(): string {
    const current = localStorage.getItem(CURRENT_ACCOUNT_KEY);
    if (!current) {
      const accounts = this.getAccountsList();
      if (accounts.length > 0 && accounts[0]?.accountId) {
        localStorage.setItem(CURRENT_ACCOUNT_KEY, accounts[0].accountId);
        return accounts[0].accountId;
      }
      return '';
    }
    return current;
  }

  public getCurrentUser(): UserProfile {
    const currentId = this.getCurrentAccountId();
    const accounts = this.getAccountsList();
    if (accounts.length === 0) {
      return ANONYMOUS_FALLBACK_USER;
    }
    const user = accounts.find((a) => a.accountId === currentId);
    if (user) return user;

    const fallback = accounts[0];
    if (fallback && fallback.accountId) {
      localStorage.setItem(CURRENT_ACCOUNT_KEY, fallback.accountId);
      return fallback;
    }
    return ANONYMOUS_FALLBACK_USER;
  }

  public isWorkspaceLocked(): boolean {
    // Production: always show Login on app launch / full reload.
    // Unlocked only while sessionStorage flag is alive (same process session).
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('studyos_session_alive') === '1') {
        return localStorage.getItem(WORKSPACE_LOCKED_KEY) === 'true';
      }
    } catch {
      /* ignore */
    }
    return true;
  }

  private markSessionAlive(): void {
    try {
      sessionStorage.setItem('studyos_session_alive', '1');
    } catch {
      /* ignore */
    }
  }

  public lockWorkspace(): void {
    localStorage.setItem(WORKSPACE_LOCKED_KEY, 'true');
    try {
      sessionStorage.removeItem('studyos_session_alive');
    } catch {
      /* ignore */
    }
    const user = this.getCurrentUser();
    auditLogger.log('LOCK_SESSION', 'Workspace locked by user request', 'SECURITY', user.username, user.role);
  }

  private async migrateHashIfNeeded(
    user: UserProfile,
    plain: string,
    field: 'passwordHash' | 'pinHash' | 'securityAnswerHash'
  ): Promise<void> {
    const current = user[field];
    if (current && isLegacyHash(current)) {
      user[field] = await hashSecret(plain);
      this.updateUserProfile(user);
    }
  }

  public async unlockWorkspace(pinOrPassword: string): Promise<boolean> {
    const user = this.getCurrentUser();
    const gate = checkLoginAllowed(user.username || 'local');
    if (!gate.allowed) {
      auditLogger.log('UNLOCK_LOCKED', gate.message || 'Rate limited', 'WARNING', user.username, user.role);
      return false;
    }
    const passOk = user.passwordHash ? await verifySecret(pinOrPassword, user.passwordHash) : false;
    const pinOk = user.pinHash ? await verifySecret(pinOrPassword, user.pinHash) : false;
    if (passOk || pinOk) {
      if (passOk) await this.migrateHashIfNeeded(user, pinOrPassword, 'passwordHash');
      if (pinOk) await this.migrateHashIfNeeded(user, pinOrPassword, 'pinHash');
      recordLoginSuccess(user.username || 'local');
      localStorage.setItem(WORKSPACE_LOCKED_KEY, 'false');
      this.markSessionAlive();
      auditLogger.log('UNLOCK_SUCCESS', 'Workspace unlocked via credentials/PIN', 'SECURITY', user.username, user.role);
      // Best-effort wipe of secret from caller scope is handled by GC; avoid retaining
      pinOrPassword = '';
      return true;
    }
    recordLoginFailure(user.username || 'local');
    auditLogger.log('UNLOCK_FAILED', 'Failed unlock attempt with incorrect PIN or password', 'WARNING', user.username, user.role);
    return false;
  }

  public async authenticate(username: string, passwordOrPin: string, rememberMe = true): Promise<UserProfile | null> {
    const accounts = this.getAccountsList();
    const cleanUser = username.toLowerCase().trim();
    const gate = checkLoginAllowed(cleanUser);
    if (!gate.allowed) {
      auditLogger.log('LOGIN_LOCKED', gate.message || 'Rate limited', 'WARNING', cleanUser, 'Unknown');
      return null;
    }
    const user = accounts.find((a) => a.username.toLowerCase() === cleanUser);
    if (!user) {
      recordLoginFailure(cleanUser);
      auditLogger.log('LOGIN_FAILED', `Failed login attempt for username @${cleanUser}`, 'WARNING', cleanUser, 'Unknown');
      return null;
    }
    const passOk = user.passwordHash ? await verifySecret(passwordOrPin, user.passwordHash) : false;
    const pinOk = user.pinHash ? await verifySecret(passwordOrPin, user.pinHash) : false;
    if (passOk || pinOk) {
      if (passOk) await this.migrateHashIfNeeded(user, passwordOrPin, 'passwordHash');
      if (pinOk) await this.migrateHashIfNeeded(user, passwordOrPin, 'pinHash');
      recordLoginSuccess(cleanUser);
      user.rememberMe = rememberMe;
      localStorage.setItem(CURRENT_ACCOUNT_KEY, user.accountId);
      localStorage.setItem(WORKSPACE_LOCKED_KEY, 'false');
      localStorage.setItem(SESSION_PERSIST_KEY, rememberMe ? 'true' : 'false');
      this.markSessionAlive();
      this.updateUserProfile(user);
      auditLogger.log('LOGIN_SUCCESS', `User authenticated as @${user.username} [Role: ${user.role || 'User'}]`, 'SECURITY', user.username, user.role);
      passwordOrPin = '';
      return user;
    }
    const after = recordLoginFailure(cleanUser);
    auditLogger.log(
      'LOGIN_FAILED',
      after.message || `Failed login attempt for username @${cleanUser}`,
      'WARNING',
      cleanUser,
      'Unknown'
    );
    return null;
  }

  public async unlockWithPin(pin: string): Promise<boolean> {
    const user = this.getCurrentUser();
    if (user.pinHash && (await verifySecret(pin, user.pinHash))) {
      await this.migrateHashIfNeeded(user, pin, 'pinHash');
      localStorage.setItem(WORKSPACE_LOCKED_KEY, 'false');
      this.markSessionAlive();
      auditLogger.log('PIN_UNLOCK_SUCCESS', '4-Digit PIN unlocked workspace', 'SECURITY', user.username, user.role);
      return true;
    }
    auditLogger.log('PIN_UNLOCK_FAILED', 'Incorrect 4-Digit PIN entered', 'WARNING', user.username, user.role);
    return false;
  }

  public async changePassword(oldPass: string, newPass: string): Promise<{ success: boolean; message: string }> {
    const user = this.getCurrentUser();
    const ok = user.passwordHash ? await verifySecret(oldPass, user.passwordHash) : false;
    if (!ok) {
      auditLogger.log('PASSWORD_CHANGE_FAILED', 'Incorrect current password provided', 'WARNING', user.username, user.role);
      return { success: false, message: 'Current password is incorrect.' };
    }
    if (newPass.length < 8) {
      return { success: false, message: 'New password must be at least 8 characters.' };
    }
    user.passwordHash = await hashSecret(newPass);
    user.mustChangePassword = false;
    this.updateUserProfile(user);
    auditLogger.log('PASSWORD_CHANGE_SUCCESS', 'Account password updated successfully', 'SECURITY', user.username, user.role);
    return { success: true, message: 'Password updated successfully!' };
  }

  public async changePin(newPin: string): Promise<{ success: boolean; message: string }> {
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, message: 'PIN must be exactly 4 digits.' };
    }
    const user = this.getCurrentUser();
    user.pinHash = await hashSecret(newPin);
    this.updateUserProfile(user);
    auditLogger.log('PIN_CHANGE_SUCCESS', '4-Digit PIN updated successfully', 'SECURITY', user.username, user.role);
    return { success: true, message: '4-Digit PIN updated successfully!' };
  }
  public async createAccount(data: {
    fullName: string;
    username: string;
    email?: string;
    password: string;
    pin?: string;
    securityQuestion: string;
    securityAnswer: string;
    avatarUrl?: string;
    studyTarget?: string;
    targetExamType?: 'GATE' | 'CUSTOM';
    targetExamDate?: string;
    dailyGoalHours?: number;
    role?: UserRole;
  }): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    try {
      const accounts = this.getAccountsList();
      const cleanUsername = (data.username || '').trim().toLowerCase();
      const cleanFullName = (data.fullName || '').trim();

      if (!cleanFullName) {
        return { success: false, message: 'Full Name is required.' };
      }

      if (!cleanUsername) {
        return { success: false, message: 'Username is required.' };
      }

      if (cleanUsername.length < 3) {
        return { success: false, message: 'Username must be at least 3 characters long.' };
      }

      if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) {
        return { success: false, message: 'Username may only contain letters, numbers, dots, underscores, hyphens (3–32 chars).' };
      }

      if (!data.password || data.password.length < 8) {
        return { success: false, message: 'Password must be at least 8 characters.' };
      }

      if (accounts.some((a) => a && a.username && a.username.toLowerCase() === cleanUsername)) {
        return { success: false, message: `Username "@${cleanUsername}" is already taken. Please choose another.` };
      }

      const passwordHash = await hashSecret(data.password);
      const pinHash = await hashSecret(data.pin && /^\d{4}$/.test(data.pin) ? data.pin : '0000');
      const securityAnswerHash = await hashSecret((data.securityAnswer || '').trim().toLowerCase());

      const newUser: UserProfile = {
        accountId: generateUUID(),
        fullName: cleanFullName.slice(0, 120),
        username: cleanUsername,
        email: (data.email?.trim() || '').slice(0, 254),
        passwordHash,
        pinHash,
        role: 'Student',
        securityQuestion: (data.securityQuestion || 'What is your target GATE discipline?').slice(0, 200),
        securityAnswerHash,
        avatarUrl:
          data.avatarUrl && data.avatarUrl.startsWith('data:image/')
            ? data.avatarUrl
            : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        theme: 'light',
        studyTarget: data.studyTarget || (data.targetExamType === 'GATE' ? 'GATE 2027 CS & DA' : 'Custom Exam Preparation'),
        targetExamType: data.targetExamType || 'GATE',
        targetExamDate: data.targetExamDate || '2027-02-07',
        dailyGoalHours: data.dailyGoalHours || 6,
        isOnboarded: true,
        streakDays: 0,
        lastSyncTime: 'Just now',
        storageBytes: 0,
        rememberMe: true,
      };

      accounts.push(newUser);
      this.saveAccountsList(accounts);
      localStorage.setItem(CURRENT_ACCOUNT_KEY, newUser.accountId);
      localStorage.setItem(WORKSPACE_LOCKED_KEY, 'false');
      localStorage.setItem(SESSION_PERSIST_KEY, 'true');
      this.markSessionAlive();

      auditLogger.log('ACCOUNT_CREATED', `New Student account created: @${cleanUsername} [Role: Student]`, 'SECURITY', cleanUsername, 'Student');

      return { success: true, message: 'Account created successfully!', user: newUser };
    } catch (err: unknown) {
      console.error('Error creating account:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create account due to a system error.';
      return { success: false, message: msg };
    }
  }

  public getParentLinkingCodes(): ParentLinkingCodeRecord[] {
    try {
      const raw = localStorage.getItem(PARENT_LINKING_CODES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveParentLinkingCodes(codes: ParentLinkingCodeRecord[]): void {
    try {
      localStorage.setItem(PARENT_LINKING_CODES_KEY, JSON.stringify(codes));
    } catch (err) {
      console.error('Failed to save parent linking codes:', err);
    }
  }

  public generateParentLinkingCode(studentUser?: UserProfile): { success: boolean; code?: string; message: string } {
    const student = studentUser || this.getCurrentUser();
    if (student.role === 'Parent') {
      return { success: false, message: 'Parent role cannot generate linking codes.' };
    }

    // Generate random 6-character code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomStr = '';
    for (let i = 0; i < 6; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `P-${randomStr}`;

    const codes = this.getParentLinkingCodes();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 day expiration

    const newRecord: ParentLinkingCodeRecord = {
      code,
      studentAccountId: student.accountId,
      studentUsername: student.username,
      createdAt: new Date().toISOString(),
      expiresAt: expires.toISOString(),
      used: false,
    };

    codes.unshift(newRecord);
    this.saveParentLinkingCodes(codes);

    auditLogger.log('PARENT_CODE_GENERATED', `Generated parent viewer linking code ${code} for @${student.username}`, 'SECURITY', student.username, 'Student');

    return { success: true, code, message: 'Linking code generated successfully!' };
  }

  public async createParentAccount(data: {
    fullName: string;
    username: string;
    password: string;
    pin?: string;
    securityQuestion: string;
    securityAnswer: string;
    linkingCode: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    try {
      const cleanCode = (data.linkingCode || '').trim().toUpperCase();
      if (!cleanCode) {
        return { success: false, message: 'Parent linking code is required.' };
      }

      const codes = this.getParentLinkingCodes();
      const codeRecord = codes.find(
        (c) => c.code.toUpperCase() === cleanCode && !c.used
      );

      if (!codeRecord) {
        return {
          success: false,
          message: 'Invalid or expired parent linking code. Please request a new code from the student account.',
        };
      }

      const accounts = this.getAccountsList();
      const cleanUsername = (data.username || '').trim().toLowerCase();
      const cleanFullName = (data.fullName || '').trim();

      if (!cleanFullName) {
        return { success: false, message: 'Full Name is required.' };
      }

      if (!cleanUsername) {
        return { success: false, message: 'Username is required.' };
      }

      if (cleanUsername.length < 3) {
        return { success: false, message: 'Username must be at least 3 characters long.' };
      }

      if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) {
        return {
          success: false,
          message: 'Username may only contain letters, numbers, dots, underscores, hyphens (3–32 chars).',
        };
      }

      if (!data.password || data.password.length < 8) {
        return { success: false, message: 'Password must be at least 8 characters.' };
      }

      if (accounts.some((a) => a && a.username && a.username.toLowerCase() === cleanUsername)) {
        return { success: false, message: `Username "@${cleanUsername}" is already taken. Please choose another.` };
      }

      // Mark code as used
      codeRecord.used = true;
      codeRecord.usedAt = new Date().toISOString();
      codeRecord.usedByUsername = cleanUsername;
      this.saveParentLinkingCodes(codes);

      const passwordHash = await hashSecret(data.password);
      const pinHash = await hashSecret(data.pin && /^\d{4}$/.test(data.pin) ? data.pin : '0000');
      const securityAnswerHash = await hashSecret((data.securityAnswer || '').trim().toLowerCase());

      const newParentUser: UserProfile = {
        accountId: generateUUID(),
        fullName: cleanFullName.slice(0, 120),
        username: cleanUsername,
        email: '',
        passwordHash,
        pinHash,
        role: 'Parent',
        linkedStudentAccountId: codeRecord.studentAccountId,
        securityQuestion: (data.securityQuestion || 'Security question').slice(0, 200),
        securityAnswerHash,
        avatarUrl:
          data.avatarUrl && data.avatarUrl.startsWith('data:image/')
            ? data.avatarUrl
            : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        theme: 'light',
        studyTarget: 'Parent Viewer',
        isOnboarded: true,
        streakDays: 0,
        lastSyncTime: 'Just now',
        storageBytes: 0,
        rememberMe: true,
      };

      accounts.push(newParentUser);
      this.saveAccountsList(accounts);
      localStorage.setItem(CURRENT_ACCOUNT_KEY, newParentUser.accountId);
      localStorage.setItem(WORKSPACE_LOCKED_KEY, 'false');
      localStorage.setItem(SESSION_PERSIST_KEY, 'true');
      this.markSessionAlive();

      auditLogger.log(
        'ACCOUNT_CREATED',
        `New Parent Viewer account created (@${cleanUsername}) linked to Student @${codeRecord.studentUsername}`,
        'SECURITY',
        cleanUsername,
        'Parent'
      );

      return { success: true, message: 'Parent profile created successfully!', user: newParentUser };
    } catch (err: unknown) {
      console.error('Error creating Parent account:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create Parent account due to a system error.';
      return { success: false, message: msg };
    }
  }

  public deleteAccount(accountId: string): { success: boolean; message: string } {
    let accounts = this.getAccountsList();
    const target = accounts.find((a) => a.accountId === accountId);

    if (!target) return { success: false, message: 'Account not found.' };

    if (target.isDefaultAdmin) {
      return { success: false, message: 'Cannot delete default system administrator account.' };
    }

    accounts = accounts.filter((a) => a.accountId !== accountId);
    this.saveAccountsList(accounts);

    auditLogger.log('ACCOUNT_DELETED', `Account @${target.username} removed from system`, 'WARNING', target.username, target.role);

    // If active account was deleted, fallback to remaining
    if (this.getCurrentAccountId() === accountId) {
      const fallback = accounts[0] || ANONYMOUS_FALLBACK_USER;
      localStorage.setItem(CURRENT_ACCOUNT_KEY, fallback.accountId);
      localStorage.setItem(WORKSPACE_LOCKED_KEY, 'true');
    }

    return { success: true, message: 'Account removed successfully.' };
  }

  public updateUserProfile(updated: Partial<UserProfile>): UserProfile {
    const accounts = this.getAccountsList();
    const currentId = this.getCurrentAccountId();
    const idx = accounts.findIndex((a) => a.accountId === currentId);

    if (idx !== -1 && accounts[idx]) {
      const merged: UserProfile = {
        ...accounts[idx]!,
        ...updated,
        updatedAt: new Date().toISOString(),
      };
      accounts[idx] = merged;
      this.saveAccountsList(accounts);
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            window.dispatchEvent(new Event('studyos_user_updated'));
          } catch {
            /* ignore */
          }
        }, 0);
      }
      return merged;
    }
    return this.getCurrentUser();
  }

  public switchAccount(accountId: string): UserProfile | null {
    const accounts = this.getAccountsList();
    const target = accounts.find((a) => a.accountId === accountId);
    if (target) {
      localStorage.setItem(CURRENT_ACCOUNT_KEY, target.accountId);
      localStorage.setItem(WORKSPACE_LOCKED_KEY, 'true'); // Lock when switching so password/PIN is requested
      auditLogger.log('ACCOUNT_SWITCH', `Switched active profile to @${target.username}`, 'INFO', target.username, target.role);
      return target;
    }
    return null;
  }

  public async resetPasswordWithSecurityAnswer(
    username: string,
    answer: string,
    newPassword: string
  ): Promise<boolean> {
    if (!newPassword || newPassword.length < 8) return false;
    const accounts = this.getAccountsList();
    const user = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase().trim());
    if (user && user.securityAnswerHash && (await verifySecret(answer.trim().toLowerCase(), user.securityAnswerHash))) {
      await this.migrateHashIfNeeded(user, answer.trim().toLowerCase(), 'securityAnswerHash');
      user.passwordHash = await hashSecret(newPassword);
      user.updatedAt = new Date().toISOString();
      this.saveAccountsList(accounts);
      auditLogger.log('PASSWORD_RESET', `Password reset completed via security answer for @${user.username}`, 'SECURITY', user.username, user.role);
      return true;
    }
    auditLogger.log('PASSWORD_RESET_FAILED', `Password reset failed for @${username}`, 'WARNING', username, 'Unknown');
    return false;
  }

  public logout(): void {
    const user = this.getCurrentUser();
    localStorage.setItem(WORKSPACE_LOCKED_KEY, 'true');
    auditLogger.log('LOGOUT', `User @${user.username} logged out`, 'INFO', user.username, user.role);
  }
}

export const authService = new AuthService();

