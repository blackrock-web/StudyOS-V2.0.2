import {
  UpdateProvider,
  UpdateState,
  UpdateCheckResult,
} from './UpdateProvider';
import { GitHubReleaseUpdateProvider } from './GitHubReleaseUpdateProvider';
import { parseGitHubRepoUrl, loadGitHubRepoConfig, type ParsedGitHubRepo } from './githubRepoConfig';

export class UpdateService {
  private static instance: UpdateService;
  private provider: UpdateProvider;

  constructor(provider?: UpdateProvider) {
    this.provider = provider || new GitHubReleaseUpdateProvider();
  }

  public static getInstance(provider?: UpdateProvider): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService(provider);
    }
    return UpdateService.instance;
  }

  public setProvider(provider: UpdateProvider): void {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  public getGitHubProvider(): GitHubReleaseUpdateProvider | null {
    if (this.provider instanceof GitHubReleaseUpdateProvider) {
      return this.provider;
    }
    return null;
  }

  public setRepositoryUrl(url: string): { ok: boolean; error?: string; config?: ParsedGitHubRepo } {
    const gh = this.getGitHubProvider();
    if (!gh) {
      const parsed = parseGitHubRepoUrl(url);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      return { ok: false, error: 'Current update provider does not support repository configuration.' };
    }
    return gh.setRepositoryFromUrl(url);
  }

  public getRepository(): ParsedGitHubRepo {
    const gh = this.getGitHubProvider();
    if (gh) return gh.getRepository();
    return loadGitHubRepoConfig();
  }

  public async validateRepository(url?: string) {
    const gh = this.getGitHubProvider();
    if (!gh) return { ok: false, error: 'GitHub provider not active' };
    return gh.validateRepository(url);
  }

  public async checkForUpdates(pin?: string): Promise<UpdateCheckResult> {
    return this.provider.checkForUpdates(pin);
  }

  public async downloadUpdate(pin?: string): Promise<{ ok: boolean; error?: string }> {
    return this.provider.downloadUpdate(pin);
  }

  public async installUpdate(pin?: string): Promise<{ ok: boolean; error?: string }> {
    return this.provider.installUpdate(pin);
  }

  public async rollbackToPrevious(): Promise<{ ok: boolean; error?: string }> {
    if (this.provider.rollbackToPrevious) {
      return this.provider.rollbackToPrevious();
    }
    return { ok: false, error: 'Rollback not supported by current provider' };
  }

  public async getStatus(): Promise<UpdateState> {
    return this.provider.getStatus();
  }

  public subscribe(callback: (state: UpdateState) => void): () => void {
    return this.provider.subscribeToStatus(callback);
  }
}

export const updateService = UpdateService.getInstance();
