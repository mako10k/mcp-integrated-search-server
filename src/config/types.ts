/**
 * Type definitions for Redmine multi-repository configuration
 */

export type SecretSource = 'environment' | 'aws-secrets-manager' | 'vault' | 'azure-keyvault';

export interface RedmineRepositoryDefaults {
  projectId?: number | string | null;
  trackerId?: number | string | null;
  statusId?: number | string | null;
  priorityId?: number | string | null;
}

export interface RedmineRepository {
  id: string;
  displayName: string;
  url: string;
  /** String value or an environment variable reference like ${REDMINE_MAIN_API_KEY} */
  apiKey: string;
  secretSource: SecretSource;
  defaults?: RedmineRepositoryDefaults;
  enabled: boolean;
  description?: string;
}

export interface RedmineConfig {
  configVersion: string;
  defaultRepositoryId?: string;
  repositories: RedmineRepository[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  responseTimeMs?: number;
  serverVersion?: string;
}
