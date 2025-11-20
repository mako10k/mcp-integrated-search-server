import { RedmineConfigSchema } from '../schemas';

describe('RedmineConfigSchema', () => {
  it('parses a valid configuration', () => {
    const config = {
      configVersion: '1.0',
      defaultRepositoryId: 'main',
      repositories: [
        {
          id: 'main',
          displayName: 'Main Redmine Server',
          url: 'https://redmine.example.com',
          apiKey: '${REDMINE_MAIN_API_KEY}',
          secretSource: 'environment',
          defaults: {
            projectId: null,
            trackerId: null,
            statusId: 1,
            priorityId: 2,
          },
          enabled: true,
          description: 'Main production Redmine server',
        },
      ],
    };

    const parsed = RedmineConfigSchema.parse(config);
    expect(parsed.repositories[0].id).toBe('main');
  });

  it('rejects invalid URL with trailing slash', () => {
    const config = {
      configVersion: '1.0',
      repositories: [
        {
          id: 'main',
          displayName: 'Main',
          url: 'https://redmine.example.com/',
          apiKey: '${REDMINE_MAIN_API_KEY}',
          secretSource: 'environment',
          enabled: true,
        },
      ],
    };

    expect(() => RedmineConfigSchema.parse(config)).toThrow('URL should not end with slash');
  });

  it('rejects invalid repository id format', () => {
    const config = {
      configVersion: '1.0',
      repositories: [
        {
          id: 'Main#1',
          displayName: 'Main',
          url: 'https://redmine.example.com',
          apiKey: '${REDMINE_MAIN_API_KEY}',
          secretSource: 'environment',
          enabled: true,
        },
      ],
    };

    expect(() => RedmineConfigSchema.parse(config)).toThrow('Repository id must be lowercase');
  });

  it('requires at least one repository', () => {
    const config = {
      configVersion: '1.0',
      repositories: [],
    };
    expect(() => RedmineConfigSchema.parse(config)).toThrow('At least one repository is required');
  });
});
