import {
  UpdateProvider,
  UpdateState,
  UpdateCheckResult,
  UpdateInfo,
} from './UpdateProvider';
import type { StudyOSDesktopAPI } from '../../types/desktop';
import { networkGateway, NETWORK_ALLOWLIST } from '../network/NetworkGateway';
import { auditLogger } from '../auditLogger';
import { versionService } from '../versionService';
import {
  loadGitHubRepoConfig,
  saveGitHubRepoConfig,
  parseGitHubRepoUrl,
  compareSemver,
  detectPlatform,
  selectReleaseAsset,
  DEFAULT_GITHUB_OWNER,
  DEFAULT_GITHUB_REPO,
  type GitHubRelease,
  type GitHubReleaseAsset,
  type ParsedGitHubRepo,
} from './githubRepoConfig';

const getDesktopAPI = (): StudyOSDesktopAPI | undefined => {
  if (typeof window !== 'undefined') {
    return (window as any).studyosDesktop;
  }
  return undefined;
};

function getAppVersion(): string {
  try {
    const v = versionService.getCurrentVersion?.() || versionService.getState()?.currentVersion;
    if (v) return String(v).replace(/^v/i, '');
  } catch {
    /* ignore */
  }
  // package.json fallback via electron
  const desktop = getDesktopAPI();
  // renderer may not know package version until status sync
  return '1.0.0';
}

export class GitHubReleaseUpdateProvider implements UpdateProvider {
  public readonly name = 'GitHubReleaseUpdateProvider';
  private config: ParsedGitHubRepo;
  private selectedAsset: GitHubReleaseAsset | null = null;
  private selectedRelease: GitHubRelease | null = null;
  private downloadedPath: string | null = null;
  private fallbackState: UpdateState = {
    status: 'idle',
    currentVersion: getAppVersion(),
    currentCommit: undefined,
    availableVersion: null,
    availableCommit: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    progress: 0,
    error: null,
    lastCheckedAt: null,
    rollbackAvailable: true,
  };
  private listeners: Set<(state: UpdateState) => void> = new Set();

  constructor(config?: { owner?: string; repo?: string }) {
    const stored = loadGitHubRepoConfig();
    this.config = {
      owner: config?.owner || stored.owner || DEFAULT_GITHUB_OWNER,
      repo: config?.repo || stored.repo || DEFAULT_GITHUB_REPO,
      htmlUrl: `https://github.com/${config?.owner || stored.owner}/${config?.repo || stored.repo}`,
      input: stored.input || stored.htmlUrl,
    };

    const desktop = getDesktopAPI();
    if (desktop?.onUpdateStatusChanged) {
      desktop.onUpdateStatusChanged((nativeState: UpdateState) => {
        this.fallbackState = { ...this.fallbackState, ...nativeState };
        this.notifyListeners();
      });
    }
  }

  /** Apply repository from Settings (authoritative). */
  public setRepositoryFromUrl(url: string): { ok: boolean; error?: string; config?: ParsedGitHubRepo } {
    const saved = saveGitHubRepoConfig(url);
    if (!saved.ok) return { ok: false, error: saved.error };
    this.config = saved.value;
    this.logDiag(`Repository configured: ${this.config.owner}/${this.config.repo}`);
    return { ok: true, config: saved.value };
  }

  public getRepository(): ParsedGitHubRepo {
    this.config = loadGitHubRepoConfig();
    return { ...this.config };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.fallbackState });
      } catch (err) {
        console.error('[GitHubReleaseUpdateProvider] Error in listener:', err);
      }
    }
  }

  private setState(patch: Partial<UpdateState>) {
    this.fallbackState = { ...this.fallbackState, ...patch };
    this.notifyListeners();
  }

  private logDiag(message: string) {
    try {
      auditLogger.logEvent?.({
        action: 'UPDATE_DIAG',
        details: message,
        severity: 'INFO',
        status: 'SUCCESS',
      } as any);
    } catch {
      /* ignore */
    }
    if (typeof console !== 'undefined') {
      console.info('[StudyOS Updater]', message);
    }
  }

  public async getStatus(): Promise<UpdateState> {
    this.fallbackState.currentVersion = getAppVersion();
    const desktop = getDesktopAPI();
    if (desktop?.getUpdateStatus) {
      try {
        const nativeState = await desktop.getUpdateStatus();
        if (nativeState) {
          this.fallbackState = {
            ...this.fallbackState,
            ...nativeState,
            currentVersion: nativeState.currentVersion || this.fallbackState.currentVersion,
          };
        }
      } catch (err) {
        console.warn('[GitHubReleaseUpdateProvider] Failed to fetch native update status:', err);
      }
    }
    return { ...this.fallbackState };
  }

  private async unlockForUpdate(pin?: string, reason?: string, durationMs = 120000) {
    const locked = networkGateway.isLocked?.() ?? true;
    if (!locked) {
      return { ok: true as const };
    }
    if (!pin || !String(pin).trim()) {
      const state = networkGateway.getState?.();
      if (state?.hasConfiguredPin) {
        return {
          ok: false as const,
          error: 'Network gateway is locked. Enter your PIN to check GitHub for updates.',
        };
      }
      // No PIN configured yet — require a PIN prompt to establish initial security PIN
      return {
        ok: false as const,
        error: 'Network security PIN is required to unlock GitHub update access.',
      };
    }
    const unlockRes = await networkGateway.requestTemporaryUnlock(
      pin,
      'update',
      reason || 'Checking GitHub Releases for application updates',
      durationMs
    );
    if (!(unlockRes as any).ok) {
      return {
        ok: false as const,
        error: (unlockRes as any).error || 'Network unlock failed. Check PIN and GitHub allowlist.',
      };
    }
    return { ok: true as const };
  }

  private async githubFetch(path: string): Promise<Response> {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    // Ensure allowlist includes this host (diagnostic)
    const host = new URL(url).hostname;
    const allowed = (NETWORK_ALLOWLIST?.update || []).some(
      (d: string) => host === d || host.endsWith('.' + d)
    );
    if (!allowed && networkGateway.isLocked?.()) {
      throw new Error(
        `GitHub host "${host}" is blocked by the network allowlist or gateway is locked.`
      );
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'StudyOS-Desktop-Updater',
      },
    });
    return res;
  }

  /** Validate repository is publicly reachable. */
  public async validateRepository(url?: string): Promise<{
    ok: boolean;
    error?: string;
    config?: ParsedGitHubRepo;
    fullName?: string;
  }> {
    if (url) {
      const set = this.setRepositoryFromUrl(url);
      if (!set.ok) return { ok: false, error: set.error };
    }
    const cfg = this.getRepository();
    this.logDiag(`Validating repository ${cfg.owner}/${cfg.repo}`);
    try {
      const res = await this.githubFetch(`/repos/${cfg.owner}/${cfg.repo}`);
      if (res.status === 404) {
        return {
          ok: false,
          error: `The configured GitHub repository could not be found: ${cfg.owner}/${cfg.repo}. Check the repository URL.`,
          config: cfg,
        };
      }
      if (res.status === 403) {
        const body = await res.text().catch(() => '');
        if (/rate limit/i.test(body)) {
          return {
            ok: false,
            error: 'GitHub API rate limit exceeded. Try again later.',
            config: cfg,
          };
        }
        return {
          ok: false,
          error:
            'The configured GitHub repository could not be accessed. Check the repository URL or network/GitHub allowlist.',
          config: cfg,
        };
      }
      if (!res.ok) {
        return {
          ok: false,
          error: `GitHub returned HTTP ${res.status} while verifying the repository.`,
          config: cfg,
        };
      }
      const data = await res.json();
      if (data.private) {
        return {
          ok: false,
          error: 'Repository is private. Public repositories are required without a GitHub token.',
          config: cfg,
        };
      }
      return { ok: true, config: cfg, fullName: data.full_name as string };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/allowlist|gateway|locked/i.test(msg)) {
        return { ok: false, error: msg, config: cfg };
      }
      if (/Failed to fetch|NetworkError|network/i.test(msg)) {
        return {
          ok: false,
          error: 'Network unavailable or GitHub could not be reached. Unlock the network gateway and retry.',
          config: cfg,
        };
      }
      return { ok: false, error: msg, config: cfg };
    }
  }

  private async fetchLatestCompatibleRelease(): Promise<{
    ok: boolean;
    error?: string;
    release?: GitHubRelease;
    asset?: GitHubReleaseAsset | null;
  }> {
    const cfg = this.getRepository();
    const listRes = await this.githubFetch(
      `/repos/${cfg.owner}/${cfg.repo}/releases?per_page=20`
    );

    if (listRes.status === 404) {
      return {
        ok: false,
        error: `Repository ${cfg.owner}/${cfg.repo} was not found when listing releases.`,
      };
    }
    if (listRes.status === 403) {
      return {
        ok: false,
        error: 'GitHub blocked the releases request (rate limit or allowlist). Try again later.',
      };
    }
    if (!listRes.ok) {
      return { ok: false, error: `Failed to list releases (HTTP ${listRes.status}).` };
    }

    const releases = (await listRes.json()) as GitHubRelease[];
    if (!Array.isArray(releases) || releases.length === 0) {
      return {
        ok: false,
        error:
          'Repository found, but no compatible desktop release is currently available.',
      };
    }

    const published = releases.filter((r) => !r.draft);
    if (published.length === 0) {
      return {
        ok: false,
        error: 'Repository found, but only draft releases exist. No public release is available.',
      };
    }

    // Prefer non-prerelease; fall back to newest prerelease if nothing else
    const stable = published.filter((r) => !r.prerelease);
    const candidates = stable.length > 0 ? stable : published;

    const { platform, arch } = detectPlatform();
    for (const release of candidates) {
      const asset = selectReleaseAsset(release.assets || [], platform, arch);
      if (asset) {
        this.logDiag(
          `Selected release ${release.tag_name} asset ${asset.name} for ${platform}/${arch}`
        );
        return { ok: true, release, asset };
      }
    }

    // Release exists but no platform asset
    const newest = candidates[0];
    this.logDiag(
      `Release ${newest?.tag_name} found but no installer asset for ${platform}/${arch}. Assets: ${(
        newest?.assets || []
      )
        .map((a) => a.name)
        .join(', ') || '(none)'}`
    );
    return {
      ok: false,
      error:
        'Repository found, but no compatible desktop release is currently available for this platform.',
      release: newest,
      asset: null,
    };
  }

  public async checkForUpdates(pin?: string): Promise<UpdateCheckResult> {
    this.config = loadGitHubRepoConfig();
    const currentVersion = getAppVersion();
    this.setState({
      status: 'checking',
      error: null,
      currentVersion,
      lastCheckedAt: new Date().toISOString(),
    });

    const unlock = await this.unlockForUpdate(pin, 'Checking GitHub Releases', 90000);
    if (!unlock.ok) {
      this.setState({ status: 'error', error: unlock.error });
      return { hasUpdate: false, error: unlock.error };
    }

    try {
      // Prefer native electron-updater when packaged and feed is set
      const desktop = getDesktopAPI();
      if (desktop?.checkForUpdates) {
        try {
          // Push configured repo to main process if API exists
          if ((desktop as any).setUpdateRepository) {
            await (desktop as any).setUpdateRepository({
              owner: this.config.owner,
              repo: this.config.repo,
            });
          }
          const res = await desktop.checkForUpdates();
          if (res?.ok) {
            const status = await this.getStatus();
            if (status.status === 'available' && status.availableVersion) {
              const info: UpdateInfo = {
                currentVersion: status.currentVersion,
                availableVersion: status.availableVersion,
                releaseName: status.releaseName,
                releaseNotes: status.releaseNotes,
                releaseDate: status.releaseDate,
              };
              return { hasUpdate: true, updateInfo: info };
            }
            if (status.status === 'upToDate') {
              this.setState({ status: 'upToDate', availableVersion: null });
              return { hasUpdate: false };
            }
          }
          // If native check failed with a soft error, fall through to GitHub API
          if (res && res.ok === false && /dev mode|unavailable/i.test(res.error || '')) {
            this.logDiag(`Native updater skipped: ${res.error}`);
          } else if (res && res.ok === false) {
            this.logDiag(`Native updater returned error, trying GitHub API: ${res.error}`);
          }
        } catch (nativeErr: any) {
          this.logDiag(`Native check failed, using GitHub API: ${nativeErr?.message || nativeErr}`);
        }
      }

      // Validate repository first
      const validation = await this.validateRepository();
      if (!validation.ok) {
        this.setState({ status: 'error', error: validation.error });
        return { hasUpdate: false, error: validation.error };
      }

      const discovered = await this.fetchLatestCompatibleRelease();
      if (!discovered.ok || !discovered.release) {
        this.setState({
          status: 'error',
          error: discovered.error || 'No release available.',
        });
        return { hasUpdate: false, error: discovered.error };
      }

      this.selectedRelease = discovered.release;
      this.selectedAsset = discovered.asset || null;

      const remoteVersion = discovered.release.tag_name.replace(/^v/i, '');
      this.logDiag(
        `Current=${currentVersion} Remote=${remoteVersion} Asset=${discovered.asset?.name || 'none'}`
      );

      if (compareSemver(remoteVersion, currentVersion) <= 0) {
        this.setState({
          status: 'upToDate',
          availableVersion: remoteVersion,
          releaseName: discovered.release.name,
          releaseNotes: discovered.release.body,
          releaseDate: discovered.release.published_at,
          error: null,
        });
        return { hasUpdate: false };
      }

      if (!discovered.asset) {
        const err =
          'A newer release exists, but no compatible installer package was found for this platform.';
        this.setState({
          status: 'error',
          availableVersion: remoteVersion,
          releaseName: discovered.release.name,
          releaseNotes: discovered.release.body,
          releaseDate: discovered.release.published_at,
          error: err,
        });
        return { hasUpdate: false, error: err };
      }

      this.setState({
        status: 'available',
        availableVersion: remoteVersion,
        releaseName: discovered.release.name || `StudyOS ${discovered.release.tag_name}`,
        releaseNotes: discovered.release.body,
        releaseDate: discovered.release.published_at,
        error: null,
        progress: 0,
      });

      return {
        hasUpdate: true,
        updateInfo: {
          currentVersion,
          availableVersion: remoteVersion,
          releaseName: discovered.release.name,
          releaseNotes: discovered.release.body,
          releaseDate: discovered.release.published_at,
          downloadUrl: discovered.asset.browser_download_url,
        },
      };
    } catch (err: any) {
      const msg = err?.message || 'Failed to check for updates';
      this.setState({ status: 'error', error: msg });
      return { hasUpdate: false, error: msg };
    } finally {
      try {
        await networkGateway.finishOperation('update', 'Update check completed. Network locked.');
      } catch {
        /* ignore */
      }
    }
  }

  public async downloadUpdate(pin?: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.selectedAsset && this.fallbackState.status !== 'available') {
      return { ok: false, error: 'No update is available to download. Check for updates first.' };
    }

    const unlock = await this.unlockForUpdate(pin, 'Downloading GitHub release asset', 300000);
    if (!unlock.ok) {
      this.setState({ status: 'error', error: unlock.error });
      return { ok: false, error: unlock.error };
    }

    this.setState({ status: 'downloading', progress: 0, error: null });

    try {
      const desktop = getDesktopAPI();
      if (desktop?.downloadUpdate) {
        const res = await desktop.downloadUpdate();
        if (!res.ok) {
          this.setState({ status: 'error', error: res.error || 'Download failed' });
          return { ok: false, error: this.fallbackState.error || undefined };
        }
        // Native path handles progress via events
        return { ok: true };
      }

      // Renderer-side download (dev / no electron-updater asset)
      const asset = this.selectedAsset;
      if (!asset) {
        return {
          ok: false,
          error: 'No installer asset selected for download.',
        };
      }

      this.logDiag(`Downloading ${asset.name} from ${asset.browser_download_url}`);
      const res = await fetch(asset.browser_download_url, {
        headers: { Accept: 'application/octet-stream', 'User-Agent': 'StudyOS-Desktop-Updater' },
      });
      if (!res.ok) {
        throw new Error(`Download failed with HTTP ${res.status}`);
      }

      const contentLength = Number(res.headers.get('content-length') || asset.size || 0);
      const reader = res.body?.getReader?.();
      if (!reader) {
        // Fallback: blob without progress
        const blob = await res.blob();
        if (blob.size < 1024) {
          throw new Error('Downloaded package is too small; download may be incomplete.');
        }
        this.setState({ status: 'verifying', progress: 100 });
        this.downloadedPath = URL.createObjectURL(blob);
        this.setState({ status: 'downloaded', progress: 100 });
        return { ok: true };
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            this.setState({
              status: 'downloading',
              progress: Math.min(99, Math.round((received / contentLength) * 100)),
            });
          }
        }
      }

      if (contentLength > 0 && received < contentLength * 0.98) {
        throw new Error('Download incomplete. The package was not fully received.');
      }
      if (received < 1024) {
        throw new Error('Downloaded package is too small; download may be incomplete or invalid.');
      }

      this.setState({ status: 'verifying', progress: 100 });
      const blob = new Blob(chunks as BlobPart[]);
      this.downloadedPath = URL.createObjectURL(blob);
      this.setState({ status: 'downloaded', progress: 100 });
      this.logDiag(`Download complete: ${asset.name} (${received} bytes)`);
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Download failed';
      this.setState({ status: 'error', error: msg, progress: 0 });
      this.downloadedPath = null;
      return { ok: false, error: msg };
    } finally {
      try {
        await networkGateway.finishOperation('update', 'Update download finished. Network locked.');
      } catch {
        /* ignore */
      }
    }
  }

  public async installUpdate(): Promise<{ ok: boolean; error?: string }> {
    this.setState({ status: 'installing', error: null });
    try {
      auditLogger.logEvent?.({
        action: 'UPDATE_INSTALL',
        details: 'Preparing in-place install over existing installation (no uninstall required)',
        severity: 'WARNING',
        status: 'SUCCESS',
      } as any);
    } catch {
      /* ignore */
    }

    const desktop = getDesktopAPI();
    if (desktop?.installUpdate) {
      try {
        const res = await desktop.installUpdate();
        if (!res.ok) {
          this.setState({ status: 'error', error: res.error || 'Install failed' });
          return { ok: false, error: this.fallbackState.error || undefined };
        }
        // electron-updater quitAndInstall — app will restart
        return { ok: true };
      } catch (err: any) {
        this.setState({ status: 'error', error: err?.message || 'Install failed' });
        return { ok: false, error: err?.message || 'Install failed' };
      }
    }

    // Non-electron: cannot perform true in-place install of desktop binary
    if (this.downloadedPath && this.selectedAsset) {
      // Trigger browser download of the installer for the user to run over existing install
      try {
        const a = document.createElement('a');
        a.href = this.downloadedPath;
        a.download = this.selectedAsset.name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.setState({
          status: 'downloaded',
          error:
            'Installer downloaded. Run the installer to upgrade in place without uninstalling. Your data will be preserved.',
        });
        return {
          ok: true,
        };
      } catch (err: any) {
        this.setState({ status: 'error', error: err?.message || 'Could not open installer' });
        return { ok: false, error: err?.message };
      }
    }

    this.setState({
      status: 'error',
      error:
        'In-place install requires the packaged desktop application. Download completed package and run the installer over the existing install.',
    });
    return { ok: false, error: this.fallbackState.error || undefined };
  }

  public async rollbackToPrevious(): Promise<{ ok: boolean; error?: string }> {
    try {
      auditLogger.logEvent?.({
        action: 'UPDATE_ROLLBACK',
        details: 'Rollback requested to previous local snapshot',
        severity: 'WARNING',
        status: 'SUCCESS',
      } as any);
    } catch {
      /* ignore */
    }
    try {
      versionService.rollback();
    } catch {
      /* ignore */
    }
    this.setState({ status: 'upToDate', error: null });
    return { ok: true };
  }

  public subscribeToStatus(callback: (state: UpdateState) => void): () => void {
    this.listeners.add(callback);
    callback({ ...this.fallbackState });
    return () => {
      this.listeners.delete(callback);
    };
  }
}
