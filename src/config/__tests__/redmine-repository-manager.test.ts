import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { RedmineRepositoryManager } from '../redmine-repository-manager';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RedmineRepositoryManager', () => {
  const originalEnv = process.env;
  const cwd = process.cwd();

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.REDMINE_CONFIG_PATH;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function writeTempConfig(json: unknown): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-redmine-'));
    const file = path.join(dir, 'redmine-repositories.json');
    fs.writeFileSync(file, JSON.stringify(json, null, 2));
    return file;
  }

  it('loads config from REDMINE_CONFIG_PATH and resolves repository', () => {
    const config = {
      configVersion: '1.0',
      defaultRepositoryId: 'main',
      repositories: [
        {
          id: 'main',
          displayName: 'Main',
          url: 'https://redmine.example.com',
          apiKey: '${RED_KEY}',
          secretSource: 'environment',
          enabled: true,
        },
      ],
    };

    const file = writeTempConfig(config);
    process.env.REDMINE_CONFIG_PATH = file;
    process.env.RED_KEY = 'valid_key_1234567890';

    const mgr = new RedmineRepositoryManager(cwd);
    const repo = mgr.getRepository();
    expect(repo.id).toBe('main');

    const apiKey = mgr.getResolvedApiKey('main');
    expect(apiKey).toBe('valid_key_1234567890');
  });

  it('honors defaultRepositoryId when id is omitted', () => {
    const config = {
      configVersion: '1.0',
      defaultRepositoryId: 'dev',
      repositories: [
        {
          id: 'main',
          displayName: 'Main',
          url: 'https://redmine.example.com',
          apiKey: '${RED_KEY}',
          secretSource: 'environment',
          enabled: true,
        },
        {
          id: 'dev',
          displayName: 'Dev',
          url: 'https://redmine-dev.example.com',
          apiKey: '${RED_KEY_DEV}',
          secretSource: 'environment',
          enabled: true,
        },
      ],
    };
    const file = writeTempConfig(config);
    process.env.REDMINE_CONFIG_PATH = file;
    process.env.RED_KEY = 'main_key_1234567890';
    process.env.RED_KEY_DEV = 'dev_key_1234567890';

    const mgr = new RedmineRepositoryManager(cwd);
    const repo = mgr.getRepository();
    expect(repo.id).toBe('dev');
    expect(mgr.getResolvedApiKey()).toBe('dev_key_1234567890');
  });

  it('throws when repository is disabled', () => {
    const config = {
      configVersion: '1.0',
      repositories: [
        {
          id: 'staging',
          displayName: 'Staging',
          url: 'https://redmine-staging.example.com',
          apiKey: '${RED_KEY_STG}',
          secretSource: 'environment',
          enabled: false,
        },
      ],
    };
    const file = writeTempConfig(config);
    process.env.REDMINE_CONFIG_PATH = file;
    process.env.RED_KEY_STG = 'staging_key_1234567890';

    const mgr = new RedmineRepositoryManager(cwd);
    expect(() => mgr.getRepository('staging')).toThrow('disabled');
  });

  it('falls back to legacy env when no file is present', () => {
    delete process.env.REDMINE_CONFIG_PATH;
    process.env.REDMINE_URL = 'https://legacy-redmine.example.com';
    process.env.REDMINE_API_KEY = 'legacy_key_1234567890';

    const mgr = new RedmineRepositoryManager(cwd);
    const repo = mgr.getRepository();
    expect(repo.id).toBe('legacy');
    expect(mgr.getResolvedApiKey()).toBe('legacy_key_1234567890');
  });

  it('tests connection by calling /users/current.json', async () => {
    const config = {
      configVersion: '1.0',
      repositories: [
        {
          id: 'main',
          displayName: 'Main',
          url: 'https://redmine.example.com',
          apiKey: '${RED_KEY}',
          secretSource: 'environment',
          enabled: true,
        },
      ],
    };

    const file = writeTempConfig(config);
    process.env.REDMINE_CONFIG_PATH = file;
    process.env.RED_KEY = 'valid_key_1234567890';

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: { user: { id: 1, login: 'current' } },
      headers: { 'x-redmine-version': '5.1.0' },
    } as any);

    const mgr = new RedmineRepositoryManager(cwd);
    const result = await mgr.testConnection('main');
    expect(result.success).toBe(true);
    expect(result.serverVersion).toBe('5.1.0');
  });
});
