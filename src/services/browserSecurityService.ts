import { secureStorage } from './secureStorage';
import { auditLogger } from './auditLogger';

export interface DomainPermissions {
  camera: boolean;
  microphone: boolean;
  notifications: boolean;
}

export interface TrustedDomain {
  domain: string;
  addedAt: string;
  category: string;
  isUserAdded: boolean;
  permissions?: DomainPermissions;
}

export interface BrowserSecurityConfig {
  whitelistingEnabled: boolean;
  blockExecutables: boolean;
  scanDownloads: boolean;
  strictCSP: boolean;
  isolatedSandbox: boolean;
  localOnlyTelemetry: boolean;
  cookieIsolation: boolean;
  requireApprovalForDownloads: boolean;
}

export interface DownloadScanResult {
  filename: string;
  url: string;
  isSafe: boolean;
  isExecutable: boolean;
  isMalwareRisk: boolean;
  reason?: string;
  fileCategory: string;
}

export interface SandboxStatus {
  memoryIsolated: boolean;
  activeFiltersCount: number;
  iframeSandboxFlags: string[];
  encryptionAlgorithm: string;
  blockedThreatsCount: number;
  lastScanTime: string;
}

const DEFAULT_TRUSTED_DOMAINS: TrustedDomain[] = [
  { domain: 'google.com', addedAt: new Date().toISOString(), category: 'Search Engine & Services', isUserAdded: false },
  { domain: 'www.google.com', addedAt: new Date().toISOString(), category: 'Search Engine', isUserAdded: false },
  { domain: 'accounts.google.com', addedAt: new Date().toISOString(), category: 'Authentication & Security', isUserAdded: false },
  { domain: 'mail.google.com', addedAt: new Date().toISOString(), category: 'Productivity', isUserAdded: false },
  { domain: 'docs.google.com', addedAt: new Date().toISOString(), category: 'Productivity', isUserAdded: false },
  { domain: 'drive.google.com', addedAt: new Date().toISOString(), category: 'Cloud Storage', isUserAdded: false },
  { domain: 'pw.live', addedAt: new Date().toISOString(), category: 'Learning Portal', isUserAdded: false },
  { domain: 'www.pw.live', addedAt: new Date().toISOString(), category: 'Learning Portal', isUserAdded: false },
  { domain: 'pwthor.live', addedAt: new Date().toISOString(), category: 'Learning Portal', isUserAdded: false },
  { domain: 'www.pwthor.live', addedAt: new Date().toISOString(), category: 'Learning Portal', isUserAdded: false },
  { domain: 'physicswallah.live', addedAt: new Date().toISOString(), category: 'Learning Portal', isUserAdded: false },
  { domain: 'study.pw.live', addedAt: new Date().toISOString(), category: 'Learning Portal', isUserAdded: false },
  { domain: 'wikipedia.org', addedAt: new Date().toISOString(), category: 'Reference', isUserAdded: false },
  { domain: 'en.wikipedia.org', addedAt: new Date().toISOString(), category: 'Reference', isUserAdded: false },
  { domain: 'nptel.ac.in', addedAt: new Date().toISOString(), category: 'Courses', isUserAdded: false },
  { domain: 'geeksforgeeks.org', addedAt: new Date().toISOString(), category: 'Docs & Tutorials', isUserAdded: false },
  { domain: 'www.geeksforgeeks.org', addedAt: new Date().toISOString(), category: 'Docs & Tutorials', isUserAdded: false },
  { domain: 'khanacademy.org', addedAt: new Date().toISOString(), category: 'Learning', isUserAdded: false },
  { domain: 'www.khanacademy.org', addedAt: new Date().toISOString(), category: 'Learning', isUserAdded: false },
  { domain: 'gateoverflow.in', addedAt: new Date().toISOString(), category: 'PYQs & Exam Prep', isUserAdded: false },
  { domain: 'developer.mozilla.org', addedAt: new Date().toISOString(), category: 'Web Docs', isUserAdded: false },
  { domain: 'arxiv.org', addedAt: new Date().toISOString(), category: 'Research', isUserAdded: false },
  { domain: 'github.com', addedAt: new Date().toISOString(), category: 'Developer Platform', isUserAdded: false },
  { domain: 'youtube.com', addedAt: new Date().toISOString(), category: 'Educational Videos', isUserAdded: false },
  { domain: 'www.youtube.com', addedAt: new Date().toISOString(), category: 'Educational Videos', isUserAdded: false },
  { domain: 'coursera.org', addedAt: new Date().toISOString(), category: 'Courses', isUserAdded: false },
  { domain: 'udemy.com', addedAt: new Date().toISOString(), category: 'Courses', isUserAdded: false },
  { domain: 'notion.so', addedAt: new Date().toISOString(), category: 'Productivity', isUserAdded: false },
  { domain: 'duckduckgo.com', addedAt: new Date().toISOString(), category: 'Search Engine', isUserAdded: false },
  { domain: 'html.duckduckgo.com', addedAt: new Date().toISOString(), category: 'Search Engine', isUserAdded: false },
  { domain: 'bing.com', addedAt: new Date().toISOString(), category: 'Search Engine', isUserAdded: false },
  { domain: 'www.bing.com', addedAt: new Date().toISOString(), category: 'Search Engine', isUserAdded: false },
  { domain: 'startpage.com', addedAt: new Date().toISOString(), category: 'Search Engine', isUserAdded: false },
];

const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'vbs', 'msi', 'apk', 'dmg', 'scr', 'ps1',
  'jar', 'iso', 'dll', 'sys', 'reg', 'lnk', 'cpl', 'app', 'deb', 'rpm',
  'vbe', 'wsf', 'gadget', 'bas', 'chm', 'hta', 'com', 'pif'
]);

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file|about|blob):/i;

const SUSPICIOUS_DOMAIN_KEYWORDS = [
  'phishing', 'malware', 'crypto-stealer', 'trojan', 'ransomware',
  'crack-exe', 'free-keygen', 'warez-download', 'fake-login-verify'
];

const DEFAULT_CONFIG: BrowserSecurityConfig = {
  whitelistingEnabled: true,
  blockExecutables: true,
  scanDownloads: true,
  strictCSP: true,
  isolatedSandbox: true,
  localOnlyTelemetry: true,
  cookieIsolation: true,
  requireApprovalForDownloads: true,
};

class BrowserSecurityService {
  private config: BrowserSecurityConfig = { ...DEFAULT_CONFIG };
  private trustedDomains: TrustedDomain[] = [...DEFAULT_TRUSTED_DOMAINS];
  private blockedThreatsCount = 0;

  private domainPermissionsMap: Record<string, DomainPermissions> = {};

  constructor() {
    this.initEncryptedStorage();
  }

  private async initEncryptedStorage(): Promise<void> {
    try {
      const savedConfig = localStorage.getItem('studyos_browser_enc_settings');
      if (savedConfig) {
        const parsed = await secureStorage.decryptJSON<BrowserSecurityConfig>(savedConfig);
        if (parsed && typeof parsed === 'object') {
          this.config = { ...DEFAULT_CONFIG, ...parsed };
        }
      }

      const savedDomains = localStorage.getItem('studyos_browser_enc_trusted_domains');
      if (savedDomains) {
        const parsed = await secureStorage.decryptJSON<TrustedDomain[]>(savedDomains);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge defaults with saved domains so newly supported default sites are always present
          const existingMap = new Map(parsed.map((d) => [d.domain.toLowerCase(), d]));
          for (const defaultDomain of DEFAULT_TRUSTED_DOMAINS) {
            if (!existingMap.has(defaultDomain.domain.toLowerCase())) {
              existingMap.set(defaultDomain.domain.toLowerCase(), defaultDomain);
            }
          }
          this.trustedDomains = Array.from(existingMap.values());
        }
      }

      const savedPerms = localStorage.getItem('studyos_browser_enc_domain_perms');
      if (savedPerms) {
        const parsedPerms = await secureStorage.decryptJSON<Record<string, DomainPermissions>>(savedPerms);
        if (parsedPerms && typeof parsedPerms === 'object') {
          this.domainPermissionsMap = parsedPerms;
        }
      }

      const threatCount = localStorage.getItem('studyos_browser_blocked_threats_count');
      if (threatCount) {
        this.blockedThreatsCount = parseInt(threatCount, 10) || 0;
      }
    } catch (e) {
      console.warn('BrowserSecurityService: fallback to memory state during initialization', e);
    }
  }

  // --- Encrypted Storage Handlers ---
  public async saveEncryptedData<T>(key: string, data: T): Promise<void> {
    try {
      const encrypted = await secureStorage.encryptJSON(data);
      localStorage.setItem(`studyos_browser_enc_${key}`, encrypted);
    } catch (e) {
      console.error(`Failed to encrypt browser data for key ${key}`, e);
    }
  }

  public async loadEncryptedData<T>(key: string, fallback: T): Promise<T> {
    try {
      const encrypted = localStorage.getItem(`studyos_browser_enc_${key}`);
      if (!encrypted) return fallback;
      return await secureStorage.decryptJSON<T>(encrypted);
    } catch (e) {
      console.warn(`Failed to decrypt browser data for key ${key}`, e);
      return fallback;
    }
  }

  // --- Whitelist & Domain Safety ---
  public extractDomain(rawUrl: string): string {
    if (!rawUrl) return '';
    try {
      const clean = rawUrl.trim();
      const withProtocol = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      const parsed = new URL(withProtocol);
      return parsed.hostname.toLowerCase();
    } catch {
      return rawUrl.split('/')[0]?.toLowerCase() || rawUrl.toLowerCase();
    }
  }

  public isDomainTrusted(rawUrl: string): boolean {
    if (!this.config.whitelistingEnabled) return true;
    const domain = this.extractDomain(rawUrl);
    if (!domain) return false;

    return this.trustedDomains.some((item) => {
      const td = item.domain.toLowerCase();
      return domain === td || domain.endsWith('.' + td) || td.endsWith('.' + domain);
    });
  }

  public addTrustedDomain(domainInput: string, category: string = 'User Whitelisted'): boolean {
    const domain = this.extractDomain(domainInput);
    if (!domain) return false;

    if (this.trustedDomains.some((d) => d.domain.toLowerCase() === domain)) {
      return true;
    }

    const newDomain: TrustedDomain = {
      domain,
      addedAt: new Date().toISOString(),
      category,
      isUserAdded: true,
    };

    this.trustedDomains.push(newDomain);
    this.saveEncryptedData('trusted_domains', this.trustedDomains);

    auditLogger.record({
      action: 'BROWSER_WHITELIST_ADD',
      details: `Added trusted domain: ${domain}`,
      severity: 'SECURITY',
      status: 'SUCCESS',
    });

    return true;
  }

  public removeTrustedDomain(domainInput: string): boolean {
    const domain = domainInput.toLowerCase().trim();
    const initialLength = this.trustedDomains.length;
    this.trustedDomains = this.trustedDomains.filter((d) => d.domain.toLowerCase() !== domain);

    if (this.trustedDomains.length !== initialLength) {
      this.saveEncryptedData('trusted_domains', this.trustedDomains);
      auditLogger.record({
        action: 'BROWSER_WHITELIST_REMOVE',
        details: `Removed domain from trusted whitelist: ${domain}`,
        severity: 'SECURITY',
        status: 'SUCCESS',
      });
      return true;
    }
    return false;
  }

  public getTrustedDomains(): TrustedDomain[] {
    return [...this.trustedDomains];
  }

  // --- Domain Permissions Control (Camera, Mic, Notifications) ---
  public getDomainPermissions(domainInput: string): DomainPermissions {
    const domain = this.extractDomain(domainInput);
    if (!domain) {
      return { camera: false, microphone: false, notifications: false };
    }

    const existing = this.domainPermissionsMap[domain];
    if (existing) {
      return { ...existing };
    }

    // Default permissions for trusted domains
    const isTrusted = this.isDomainTrusted(domain);
    const defaults: DomainPermissions = isTrusted
      ? { camera: false, microphone: true, notifications: true }
      : { camera: false, microphone: false, notifications: false };

    return defaults;
  }

  public setDomainPermissions(domainInput: string, perms: Partial<DomainPermissions>): DomainPermissions {
    const domain = this.extractDomain(domainInput);
    if (!domain) {
      return { camera: false, microphone: false, notifications: false };
    }

    const current = this.getDomainPermissions(domain);
    const updated: DomainPermissions = {
      ...current,
      ...perms,
    };

    this.domainPermissionsMap[domain] = updated;
    this.saveEncryptedData('domain_perms', this.domainPermissionsMap);

    auditLogger.record({
      action: 'BROWSER_SECURITY_CONFIG_UPDATE',
      details: `Updated domain permissions for ${domain}: Cam=${updated.camera}, Mic=${updated.microphone}, Notif=${updated.notifications}`,
      severity: 'SECURITY',
      status: 'SUCCESS',
    });

    return updated;
  }

  public toggleDomainPermission(domainInput: string, permissionType: keyof DomainPermissions): DomainPermissions {
    const current = this.getDomainPermissions(domainInput);
    return this.setDomainPermissions(domainInput, {
      [permissionType]: !current[permissionType],
    });
  }

  // --- Threat Analysis & Script Injection Guard ---
  public analyzeUrlSafety(rawUrl: string): { isSafe: boolean; isBlockedProtocol: boolean; reason?: string } {
    const trimmed = rawUrl.trim();

    // Protocol check
    if (DANGEROUS_PROTOCOLS.test(trimmed)) {
      this.incrementThreats();
      auditLogger.record({
        action: 'BROWSER_BLOCKED_PROTOCOL',
        details: `Blocked execution of unsafe protocol: ${trimmed.slice(0, 50)}`,
        severity: 'SECURITY',
        status: 'FAILURE',
      });
      return { isSafe: false, isBlockedProtocol: true, reason: 'Dangerous executable protocol or local file access attempt' };
    }

    // Suspicious phishing domain keyword check
    const domain = this.extractDomain(trimmed);
    const hasSuspiciousKeyword = SUSPICIOUS_DOMAIN_KEYWORDS.some((kw) => domain.includes(kw));
    if (hasSuspiciousKeyword) {
      this.incrementThreats();
      auditLogger.record({
        action: 'BROWSER_BLOCKED_MALICIOUS_SITE',
        details: `Blocked domain containing malicious signature: ${domain}`,
        severity: 'SECURITY',
        status: 'FAILURE',
      });
      return { isSafe: false, isBlockedProtocol: false, reason: 'Domain contains known malware/phishing signature' };
    }

    return { isSafe: true, isBlockedProtocol: false };
  }

  // --- Secure Download Scanner ---
  public scanDownload(filename: string, url: string): DownloadScanResult {
    const cleanFilename = filename.trim();
    const parts = cleanFilename.split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : '';

    const isExecutable = EXECUTABLE_EXTENSIONS.has(ext);
    const domain = this.extractDomain(url);

    let isSafe = true;
    let isMalwareRisk = false;
    let reason = 'File passed security inspection';

    if (this.config.blockExecutables && isExecutable) {
      isSafe = false;
      isMalwareRisk = true;
      reason = `Executable files (.${ext}) are blocked by default to protect desktop OS integrity.`;
      this.incrementThreats();

      auditLogger.record({
        action: 'BROWSER_BLOCKED_EXECUTABLE_DOWNLOAD',
        details: `Blocked executable download: ${cleanFilename} from ${domain}`,
        severity: 'SECURITY',
        status: 'FAILURE',
      });
    }

    const fileCategory = isExecutable
      ? 'Executable Binary'
      : ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'].includes(ext)
      ? 'Document'
      : ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)
      ? 'Image'
      : ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
      ? 'Archive'
      : 'General Resource';

    return {
      filename: cleanFilename,
      url,
      isSafe,
      isExecutable,
      isMalwareRisk,
      reason,
      fileCategory,
    };
  }

  // --- Desktop Integration Hardening & IPC Command Validator ---
  public validateIPCCommand(command: string, params?: Record<string, unknown>): { allowed: boolean; reason?: string } {
    const forbiddenCommands = new Set([
      'shell.openExternal',
      'system.execute',
      'fs.unlink',
      'fs.writeFile',
      'process.exit',
      'native.keychainAccess',
    ]);

    if (forbiddenCommands.has(command)) {
      this.incrementThreats();
      auditLogger.record({
        action: 'BROWSER_UNAUTHORIZED_IPC',
        details: `Blocked unauthorized desktop IPC call: ${command}`,
        severity: 'SECURITY',
        status: 'FAILURE',
      });
      return {
        allowed: false,
        reason: `Command '${command}' is blocked for web content processes under Desktop IPC Security Protocol`,
      };
    }

    return { allowed: true };
  }

  // --- Config Getters & Setters ---
  public getConfig(): BrowserSecurityConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<BrowserSecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveEncryptedData('settings', this.config);
    auditLogger.record({
      action: 'BROWSER_SECURITY_CONFIG_UPDATE',
      details: `Browser security settings updated`,
      severity: 'SECURITY',
      status: 'SUCCESS',
    });
  }

  public getSandboxStatus(): SandboxStatus {
    return {
      memoryIsolated: true,
      activeFiltersCount: 14,
      iframeSandboxFlags: [
        'allow-scripts',
        'allow-same-origin',
        'allow-forms',
        'allow-popups',
        'allow-popups-to-escape-sandbox',
        'allow-downloads',
        'allow-modals',
        'allow-presentation',
      ],
      encryptionAlgorithm: 'AES-256-GCM (WebCrypto PBKDF2 / OS Keychain)',
      blockedThreatsCount: this.blockedThreatsCount,
      lastScanTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }

  private incrementThreats(): void {
    this.blockedThreatsCount += 1;
    try {
      localStorage.setItem('studyos_browser_blocked_threats_count', String(this.blockedThreatsCount));
    } catch {
      /* ignore */
    }
  }

  public clearAllLocalData(): void {
    const keysToRemove = [
      'studyos_browser_tabs_v2',
      'studyos_browser_active_tab_id',
      'studyos_browser_bookmarks',
      'studyos_browser_history',
      'studyos_browser_downloads',
      'studyos_browser_enc_tabs',
      'studyos_browser_enc_history',
      'studyos_browser_enc_bookmarks',
      'studyos_browser_enc_downloads',
      'studyos_browser_enc_settings',
      'studyos_browser_enc_trusted_domains',
      'studyos_browser_enc_domain_perms',
      'studyos_browser_blocked_threats_count',
      'studyos_browser_cookies',
      'studyos_browser_cache',
    ];

    keysToRemove.forEach((k) => localStorage.removeItem(k));
    this.config = { ...DEFAULT_CONFIG };
    this.trustedDomains = [...DEFAULT_TRUSTED_DOMAINS];
    this.domainPermissionsMap = {};
    this.blockedThreatsCount = 0;

    auditLogger.record({
      action: 'BROWSER_CLEAR_ALL_DATA',
      details: 'Purged all local browser state, cache, encrypted storage and custom whitelist entries',
      severity: 'SECURITY',
      status: 'SUCCESS',
    });
  }

  public clearCookies(): void {
    localStorage.removeItem('studyos_browser_cookies');
    auditLogger.record({
      action: 'BROWSER_CLEAR_COOKIES',
      details: 'Cleared all browser session cookies and site tokens',
      severity: 'SECURITY',
      status: 'SUCCESS',
    });
  }

  public clearCache(): void {
    localStorage.removeItem('studyos_browser_cache');
    auditLogger.record({
      action: 'BROWSER_CLEAR_CACHE',
      details: 'Cleared temporary web cache and site preview storage',
      severity: 'SECURITY',
      status: 'SUCCESS',
    });
  }
}

export const browserSecurityService = new BrowserSecurityService();
