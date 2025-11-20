import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { RedmineConfigSchema } from './schemas';
import type { RedmineConfig, RedmineRepository, ConnectionTestResult } from './types';
import { SecretsResolver } from './secrets-resolver';

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function expandHome(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export class RedmineRepositoryManager {
  private config?: RedmineConfig;
  private apiKeyCache: Map<string, string> = new Map();

  constructor(private readonly cwd: string = process.cwd()) {}

  /**
   * Load configuration based on priority order.
   * 1. REDMINE_CONFIG_PATH
   * 2. ./redmine-repositories.local.json (gitignored)
   * 3. ./redmine-repositories.json (committed)
   * 4. ~/.mcp-integrated-search/redmine-repositories.json
   * 5. Legacy env fallback (REDMINE_URL, REDMINE_API_KEY)
   */
  loadConfig(): RedmineConfig {
    // 1. Explicit path
    const explicitPath = process.env.REDMINE_CONFIG_PATH
      ? expandHome(process.env.REDMINE_CONFIG_PATH)
      : undefined;

    const localPath = path.join(this.cwd, 'redmine-repositories.local.json');
    const defaultPath = path.join(this.cwd, 'redmine-repositories.json');
    const homePath = path.join(os.homedir(), '.mcp-integrated-search', 'redmine-repositories.json');

    const candidates = [explicitPath, localPath, defaultPath, homePath].filter(Boolean) as string[];


    for (const p of candidates) {
      if (fileExists(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const json = JSON.parse(raw);
        const parsed = RedmineConfigSchema.parse(json);
        this.config = parsed;
        // Config loaded successfully from path p
        return parsed;
      }
    }

    // 5. Legacy env fallback
    const legacyUrl = process.env.REDMINE_URL;
    const legacyKey = process.env.REDMINE_API_KEY;
    if (legacyUrl && legacyKey) {
      const legacy: RedmineConfig = {
        configVersion: '1.0',
        defaultRepositoryId: 'legacy',
        repositories: [
          {
            id: 'legacy',
            displayName: 'Legacy Redmine',
            url: legacyUrl.replace(/\/$/, ''),
            apiKey: '${REDMINE_API_KEY}',
            secretSource: 'environment',
            enabled: true,
          },
        ],
      };
      this.config = RedmineConfigSchema.parse(legacy);
      // Legacy configuration constructed from environment variables
      return this.config;
    }

    throw new Error(
      'No Redmine configuration found. Provide REDMINE_CONFIG_PATH or add a redmine-repositories.json. ' +
        'Alternatively set REDMINE_URL and REDMINE_API_KEY for legacy mode.'
    );
  }

  /** Get loaded config (loads if not yet loaded). */
  getConfig(): RedmineConfig {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  /**
   * Resolve repository by id. If id is not provided, resolve default repository.
   * Throws if repository not found or disabled.
   */
  getRepository(id?: string): RedmineRepository {
    const cfg = this.getConfig();
    const targetId = id ?? cfg.defaultRepositoryId ?? cfg.repositories[0]?.id;
    if (!targetId) {
      throw new Error('No repositories defined in configuration');
    }

    const repo = cfg.repositories.find((r) => r.id === targetId);
    if (!repo) {
      const available = cfg.repositories.map((r) => r.id).join(', ');
      throw new Error(`Repository '${targetId}' not found. Available: ${available}`);
    }

    if (!repo.enabled) {
      throw new Error(`Repository '${targetId}' is disabled`);
    }

    return repo;
  }

  /** Resolve and validate API key for given repository id */
  getResolvedApiKey(repoId?: string): string {
    const repo = this.getRepository(repoId);
    const cached = this.apiKeyCache.get(repo.id);
    if (cached) return cached;

    const resolved = SecretsResolver.resolveAndValidate(repo.apiKey);
    this.apiKeyCache.set(repo.id, resolved);
    return resolved;
  }

  /** Clear cached API keys */
  clearCache(): void {
    this.apiKeyCache.clear();
  }

  /**
   * Test connectivity to a repository by calling /users/current.json
   */
  async testConnection(repoId?: string): Promise<ConnectionTestResult> {
    const repo = this.getRepository(repoId);
    const apiKey = this.getResolvedApiKey(repo.id);

    const start = Date.now();
    const url = `${repo.url}/users/current.json`;

    try {
      const res = await axios.get(url, {
        headers: {
          'X-Redmine-API-Key': apiKey,
          Accept: 'application/json',
        },
        timeout: 5000,
      });

      const elapsed = Date.now() - start;
      const serverVersion = res.headers['x-redmine-version'] ?? undefined;

      return {
        success: true,
        message: 'Connection successful',
        responseTimeMs: elapsed,
        serverVersion,
      };
    } catch (err: any) {
      const elapsed = Date.now() - start;
      const safeMessage = SecretsResolver.redactFromText(String(err?.message ?? err), [apiKey]);
      return {
        success: false,
        message: `Connection failed: ${safeMessage}`,
        responseTimeMs: elapsed,
      };
    }
  }
}
