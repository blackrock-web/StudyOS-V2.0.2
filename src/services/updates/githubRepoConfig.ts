/**
 * GitHub repository configuration for StudyOS Desktop updates.
 * Authoritative source is whatever the user configures in Settings.
 * Never substitute an unrelated repository.
 */

export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  /** Canonical https://github.com/owner/repo */
  htmlUrl: string;
  /** Original input after trim */
  input: string;
}

const STORAGE_KEY = 'studyos_update_github_repo_v1';

/** Default authoritative repo from project requirements (user may change in Settings). */
export const DEFAULT_GITHUB_REPO_URL = 'https://github.com/blackrock-web/StudyOS-V2.0.0';

export const DEFAULT_GITHUB_OWNER = 'blackrock-web';
export const DEFAULT_GITHUB_REPO = 'StudyOS-V2.0.0';

/**
 * Parse common GitHub URL / shorthand forms into owner + repo.
 * Accepts:
 * - https://github.com/OWNER/REPO
 * - https://github.com/OWNER/REPO/
 * - https://github.com/OWNER/REPO.git
 * - git@github.com:OWNER/REPO.git
 * - OWNER/REPO
 */
export function parseGitHubRepoUrl(input: string): { ok: true; value: ParsedGitHubRepo } | { ok: false; error: string } {
  const raw = (input || '').trim();
  if (!raw) {
    return { ok: false, error: 'Repository URL is required.' };
  }

  let owner = '';
  let repo = '';

  // SSH form
  const ssh = raw.match(/^git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  if (ssh) {
    owner = ssh[1];
    repo = ssh[2].replace(/\.git$/i, '');
  } else {
    // URL or path
    let path = raw;
    try {
      if (/^https?:\/\//i.test(raw) || raw.startsWith('github.com/')) {
        const url = new URL(raw.startsWith('github.com/') ? `https://${raw}` : raw);
        if (!/github\.com$/i.test(url.hostname) && !/github\.com$/i.test(url.hostname.replace(/^www\./, ''))) {
          return { ok: false, error: 'Only github.com repository URLs are supported.' };
        }
        path = url.pathname;
      }
    } catch {
      // treat as OWNER/REPO
    }

    path = path.replace(/^\/+/, '').replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) {
      return {
        ok: false,
        error: 'Could not parse repository. Use https://github.com/OWNER/REPO or OWNER/REPO.',
      };
    }
    owner = parts[0];
    repo = parts[1].replace(/\.git$/i, '');
  }

  if (!owner || !repo) {
    return { ok: false, error: 'Invalid GitHub repository URL.' };
  }
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(owner)) {
    return { ok: false, error: 'Invalid GitHub owner name.' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return { ok: false, error: 'Invalid GitHub repository name.' };
  }

  return {
    ok: true,
    value: {
      owner,
      repo,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      input: raw,
    },
  };
}

export function loadGitHubRepoConfig(): ParsedGitHubRepo {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseGitHubRepoUrl(saved);
        if (parsed.ok) return parsed.value;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    owner: DEFAULT_GITHUB_OWNER,
    repo: DEFAULT_GITHUB_REPO,
    htmlUrl: DEFAULT_GITHUB_REPO_URL,
    input: DEFAULT_GITHUB_REPO_URL,
  };
}

export function saveGitHubRepoConfig(input: string): { ok: true; value: ParsedGitHubRepo } | { ok: false; error: string } {
  const parsed = parseGitHubRepoUrl(input);
  if (!parsed.ok) return parsed;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, parsed.value.htmlUrl);
    }
  } catch {
    /* ignore */
  }
  return parsed;
}

export function getConfiguredRepoUrl(): string {
  return loadGitHubRepoConfig().htmlUrl;
}

/** Semver compare: a > b → 1, a < b → -1, equal → 0. Handles leading v and prerelease loosely. */
export function compareSemver(a: string, b: string): number {
  const norm = (v: string) =>
    String(v || '0')
      .trim()
      .replace(/^v/i, '')
      .split(/[-+]/)[0]
      .split('.')
      .map((p) => parseInt(p.replace(/\D/g, ''), 10) || 0);

  const pa = norm(a);
  const pb = norm(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export type DesktopPlatform = 'win32' | 'darwin' | 'linux';
export type DesktopArch = 'x64' | 'arm64' | 'ia32' | string;

export function detectPlatform(): { platform: DesktopPlatform; arch: DesktopArch } {
  const desktop = typeof window !== 'undefined' ? (window as any).studyosDesktop : undefined;
  if (desktop?.getPlatformInfo) {
    // optional future API
  }
  // Prefer Electron process if exposed
  const nav = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform: DesktopPlatform =
    /Windows/i.test(nav) ? 'win32' : /Mac OS|Macintosh/i.test(nav) ? 'darwin' : 'linux';
  const arch: DesktopArch = /arm64|aarch64/i.test(nav) ? 'arm64' : 'x64';
  return { platform, arch };
}

export interface GitHubReleaseAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
  content_type?: string;
  digest?: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

/**
 * Choose best installer asset for current platform from release assets.
 * Prefer: platform-specific installers over archives; stable over generic.
 */
export function selectReleaseAsset(
  assets: GitHubReleaseAsset[],
  platform: DesktopPlatform,
  arch: DesktopArch
): GitHubReleaseAsset | null {
  if (!assets || assets.length === 0) return null;

  const name = (a: GitHubReleaseAsset) => a.name.toLowerCase();
  const isArchMatch = (n: string) => {
    if (arch === 'arm64') return /arm64|aarch64|apple.?silicon/.test(n) || (!/x64|amd64|x86_64|win32|ia32/.test(n) && platform === 'darwin');
    return /x64|amd64|x86_64|win64|x86/.test(n) || !/arm64|aarch64/.test(n);
  };

  const scored = assets
    .map((a) => {
      const n = name(a);
      let score = 0;
      // skip blockmaps / yaml metadata for primary install
      if (/\.blockmap$/i.test(n) || /\.yml$/i.test(n) || /\.yaml$/i.test(n)) score -= 100;
      if (platform === 'win32') {
        if (/\.exe$/i.test(n)) score += 50;
        if (/\.msi$/i.test(n)) score += 40;
        if (/nsis|setup|installer/i.test(n)) score += 10;
        if (/win|windows/i.test(n)) score += 5;
        if (/\.dmg$|\.appimage$|\.deb$|\.rpm$/i.test(n)) score -= 50;
      } else if (platform === 'darwin') {
        if (/\.dmg$/i.test(n)) score += 50;
        if (/\.pkg$/i.test(n)) score += 40;
        if (/mac|darwin|osx/i.test(n)) score += 5;
        if (/\.exe$|\.appimage$|\.deb$/i.test(n)) score -= 50;
      } else {
        if (/\.appimage$/i.test(n)) score += 50;
        if (/\.deb$/i.test(n)) score += 40;
        if (/\.rpm$/i.test(n)) score += 35;
        if (/linux/i.test(n)) score += 5;
        if (/\.exe$|\.dmg$/i.test(n)) score -= 50;
      }
      if (isArchMatch(n)) score += 15;
      else score -= 10;
      return { a, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);

  return scored[0]?.a || null;
}
