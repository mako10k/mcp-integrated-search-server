# Multi-Redmine Repository Support Design

## Overview

This document describes the design for supporting multiple Redmine repositories in the MCP Integrated Search Server. The current implementation only supports a single Redmine instance configured via environment variables. This enhancement will allow users to configure and switch between multiple Redmine repositories dynamically.

## Design Goals

1. **Externalize Configuration**: Move Redmine settings from environment variables to a configuration file
2. **Repository Identification**: Support switching between repositories using a repository ID
3. **Repository Attributes**: Store comprehensive repository metadata (ID, display name, URL, API key, default project, etc.)
4. **Default Repository**: Maintain a default repository for convenience
5. **Tool Integration**: Add repository ID parameter to all existing Redmine tools
6. **Repository Management**: Provide tools for managing repository configurations

## Architecture

### 1. Configuration File Structure

Create a new configuration file: `redmine-repositories.json`

**SECURITY BEST PRACTICE (2025)**: Never store actual API keys in configuration files. Use environment variable references instead.

```json
{
  "configVersion": "1.0",
  "defaultRepositoryId": "main",
  "repositories": [
    {
      "id": "main",
      "displayName": "Main Redmine Server",
      "url": "https://redmine.example.com",
      "apiKey": "${REDMINE_MAIN_API_KEY}",
      "description": "Primary Redmine server for project management",
      "secretSource": "environment",
      "defaults": {
        "projectId": 1,
        "trackerId": 1,
        "statusId": 1,
        "priorityId": 2
      },
      "enabled": true
    },
    {
      "id": "dev",
      "displayName": "Development Redmine",
      "url": "https://dev-redmine.example.com",
      "apiKey": "${REDMINE_DEV_API_KEY}",
      "description": "Development and testing server",
      "secretSource": "environment",
      "defaults": {
        "projectId": 5,
        "trackerId": 2
      },
      "enabled": true
    }
  ]
}
```

**Corresponding .env file** (must be added to .gitignore):
```bash
# .env - NEVER commit this file to Git
REDMINE_MAIN_API_KEY=your_actual_production_api_key_here
REDMINE_DEV_API_KEY=your_actual_dev_api_key_here
```

**Template for sharing** (.env.example - safe to commit):
```bash
# .env.example
REDMINE_MAIN_API_KEY=your_production_redmine_api_key
REDMINE_DEV_API_KEY=your_development_redmine_api_key
REDMINE_STAGING_API_KEY=your_staging_redmine_api_key
```

### 2. Configuration File Location Priority

Configuration files are searched in the following order:

1. **Environment variable**: `REDMINE_CONFIG_PATH` (explicit path)
2. **Local override**: `./redmine-repositories.local.json` (gitignored, for local development)
3. **Default config**: `./redmine-repositories.json` (committed to Git, contains ${VAR} references)
4. **User home**: `~/.mcp-integrated-search/redmine-repositories.json` (user-specific settings)
5. **Fallback**: Generate from environment variables (backward compatibility)

**Security Note**: Files ending with `.local.json` should be added to `.gitignore` and may contain actual secrets (not recommended). The preferred approach is to use environment variable references in all configuration files.

### 3. Data Structures

#### RedmineRepository Interface

```typescript
interface RedmineRepository {
  id: string;                    // Unique repository identifier
  displayName: string;            // Human-readable name
  url: string;                    // Redmine instance URL
  apiKey: string;                 // API key or ${ENV_VAR} reference
  description?: string;           // Optional description
  secretSource?: 'environment' | 'aws-secrets-manager' | 'vault' | 'azure-keyvault'; // Secret source type
  secretPath?: string;            // Path in external secrets manager (for future use)
  defaults?: {                    // Default values for this repository
    projectId?: number;
    trackerId?: number;
    statusId?: number;
    priorityId?: number;
    assignedToId?: number;
  };
  enabled: boolean;               // Enable/disable repository
}

interface RedmineConfig {
  configVersion: string;          // Configuration schema version
  defaultRepositoryId: string;
  repositories: RedmineRepository[];
}
```

### 4. Configuration Manager Class

```typescript
class RedmineRepositoryManager {
  private config: RedmineConfig;
  private configPath: string;
  
  constructor() {
    this.loadConfig();
  }
  
  // Load configuration from file or environment variables
  private loadConfig(): void;
  
  // Resolve environment variable references (${VAR_NAME})
  private resolveEnvironmentVariable(value: string): string;
  
  // Resolve API key from various sources
  private async resolveApiKey(repo: RedmineRepository): Promise<string>;
  
  // Get repository by ID (with resolved API key)
  async getRepository(id: string): Promise<RedmineRepository | null>;
  
  // Get default repository
  async getDefaultRepository(): Promise<RedmineRepository | null>;
  
  // Set default repository
  setDefaultRepository(id: string): boolean;
  
  // List all repositories (without exposing API keys)
  listRepositories(): Omit<RedmineRepository, 'apiKey'>[];
  
  // Add a new repository
  addRepository(repo: RedmineRepository): boolean;
  
  // Update existing repository
  updateRepository(id: string, updates: Partial<RedmineRepository>): boolean;
  
  // Remove repository
  removeRepository(id: string): boolean;
  
  // Save configuration to file
  saveConfig(): void;
  
  // Validate repository configuration
  private validateRepository(repo: RedmineRepository): boolean;
  
  // Mask API key for logging (show only first 4 chars)
  private maskApiKey(apiKey: string): string;
  
  // Test repository connection
  async testConnection(id: string): Promise<{ success: boolean; message: string }>;
}
```

### 5. Tool Modifications

#### Add Repository Parameter to Existing Tools

All existing Redmine tools will be updated to accept an optional `repository_id` parameter:

- `redmine_list_issues` → Add `repository_id?: string`
- `redmine_create_issue` → Add `repository_id?: string`
- `redmine_list_projects` → Add `repository_id?: string`
- `redmine_get_issue` → Add `repository_id?: string`
- `redmine_update_issue` → Add `repository_id?: string`
- `redmine_bulk_update_issues` → Add `repository_id?: string`

**Behavior**: If `repository_id` is not provided, use the default repository.

#### Example Tool Schema Update

```typescript
{
  name: "redmine_list_issues",
  description: "List issues from a Redmine repository",
  inputSchema: {
    type: "object",
    properties: {
      repository_id: {
        type: "string",
        description: "Repository ID (optional, uses default if not specified)"
      },
      project_id: {
        type: "number",
        description: "Filter by project ID"
      },
      // ... other parameters
    }
  }
}
```

### 6. New Repository Management Tools

#### 6.1 List Repositories

**Tool Name**: `redmine_list_repositories`

**Description**: List all configured Redmine repositories

**Input Schema**:
```typescript
{
  include_disabled?: boolean  // Include disabled repositories (default: false)
}
```

**Output**:
```json
{
  "repositories": [
    {
      "id": "main",
      "displayName": "Main Redmine Server",
      "url": "https://redmine.example.com",
      "description": "Primary Redmine server",
      "enabled": true,
      "isDefault": true
    }
  ]
}
```

#### 6.2 Get Default Repository

**Tool Name**: `redmine_get_default_repository`

**Description**: Get the currently configured default repository

**Output**:
```json
{
  "id": "main",
  "displayName": "Main Redmine Server",
  "url": "https://redmine.example.com",
  "defaults": {
    "projectId": 1
  }
}
```

#### 6.3 Set Default Repository

**Tool Name**: `redmine_set_default_repository`

**Description**: Change the default repository

**Input Schema**:
```typescript
{
  repository_id: string  // Required: New default repository ID
}
```

#### 6.4 Get Repository Details

**Tool Name**: `redmine_get_repository`

**Description**: Get detailed information about a specific repository

**Input Schema**:
```typescript
{
  repository_id: string  // Required: Repository ID to query
}
```

**Output**:
```json
{
  "id": "main",
  "displayName": "Main Redmine Server",
  "url": "https://redmine.example.com",
  "description": "Primary Redmine server",
  "defaults": {
    "projectId": 1,
    "trackerId": 1,
    "statusId": 1,
    "priorityId": 2
  },
  "enabled": true
}
```

#### 6.5 Update Repository Defaults

**Tool Name**: `redmine_update_repository_defaults`

**Description**: Update default values for a repository

**Input Schema**:
```typescript
{
  repository_id: string,
  defaults: {
    projectId?: number,
    trackerId?: number,
    statusId?: number,
    priorityId?: number,
    assignedToId?: number
  }
}
```

#### 6.6 Test Repository Connection

**Tool Name**: `redmine_test_repository_connection`

**Description**: Test connectivity and authentication for a repository

**Input Schema**:
```typescript
{
  repository_id: string  // Repository to test
}
```

**Output**:
```json
{
  "success": true,
  "message": "Connection successful",
  "serverVersion": "4.2.0",
  "responseTime": 245
}
```

## Implementation Plan

### Phase 1: Security & Configuration Infrastructure (PRIORITY)
1. **Security Setup**
   - Add `.env`, `*.local.json`, `redmine-repositories.local.json` to `.gitignore`
   - Create `.env.example` template file
   - Create `redmine-repositories.example.json` template
   
2. **Core Interfaces & Schemas**
   - Create `RedmineRepository` and `RedmineConfig` interfaces
   - Implement Zod validation schemas with `secretSource` support
   - Add `configVersion` field for future migrations

3. **Secrets Resolution Module**
   - Implement `SecretsResolver` utility class
   - Add environment variable resolution (`${VAR_NAME}` pattern)
   - Implement API key validation and masking functions
   - Add error handling for missing environment variables

4. **Repository Manager Core**
   - Implement `RedmineRepositoryManager` class
   - Add configuration file loading with priority order
   - Implement backward compatibility with environment variables
   - Add configuration validation on load

### Phase 2: Tool Integration
1. Update existing Redmine tools to accept optional `repository_id` parameter
2. Modify API request functions to resolve API keys at runtime
3. Ensure all API keys are masked in logs and error messages
4. Add connection validation before first use
5. Maintain backward compatibility (default repository when `repository_id` not specified)

### Phase 3: Repository Management Tools
1. Implement `redmine_list_repositories` (without exposing API keys)
2. Implement `redmine_get_default_repository`
3. Implement `redmine_set_default_repository`
4. Implement `redmine_get_repository` (with masked API keys)
5. Implement `redmine_update_repository_defaults`
6. Implement `redmine_test_repository_connection` (validates API key)

### Phase 4: Documentation and Testing
1. **Documentation**
   - Update README.md with security best practices
   - Document environment variable reference pattern
   - Create setup guide for multiple repositories
   - Add examples for Docker deployment
   - Document Claude Desktop integration

2. **Configuration Examples**
   - Create `redmine-repositories.example.json`
   - Create `.env.example` with all required variables
   - Add Docker Compose example with secrets

3. **Testing**
   - Write unit tests for `SecretsResolver`
   - Write unit tests for `RedmineRepositoryManager`
   - Create integration tests for multi-repository scenarios
   - Test environment variable resolution
   - Test backward compatibility

4. **Security Validation**
   - Verify no secrets in committed files
   - Test API key masking in all logs
   - Validate file permission recommendations
   - Test error messages don't expose secrets

## Backward Compatibility

To ensure seamless migration for existing users:

1. **Environment Variable Fallback**: 
   - If no configuration file exists, automatically generate an in-memory config from `REDMINE_URL` and `REDMINE_API_KEY`
   - Create a single "default" repository entry
   - Log a warning suggesting migration to the new configuration format

2. **Optional Repository ID**: 
   - All tools default to the default repository if `repository_id` is not specified
   - Existing tool calls work without modification
   - No breaking changes to the tool API

3. **Configuration Migration Helper**:
   - Provide a migration tool/command to convert environment variables to configuration file
   - Generate secure configuration with `${VAR}` references
   - Create corresponding `.env` file with actual values
   - Add appropriate entries to `.gitignore`

4. **Gradual Migration Path**:
   ```typescript
   // Old way (still works)
   process.env.REDMINE_URL = "https://redmine.example.com"
   process.env.REDMINE_API_KEY = "abc123"
   
   // New way (recommended)
   // redmine-repositories.json with ${REDMINE_API_KEY}
   // .env file with actual key
   ```

5. **Validation Messages**:
   - Detect old-style configuration and suggest migration
   - Provide clear upgrade path in documentation
   - Include migration examples

## Security Considerations

### Critical Security Requirements (2025 Best Practices)

1. **Never Store Secrets in Configuration Files**
   - Configuration files committed to Git MUST use `${ENV_VAR}` references only
   - Actual API keys MUST be in `.env` files or environment variables
   - Add all secret-containing files to `.gitignore`

2. **Environment Variable Resolution**
   - Support `${VARIABLE_NAME}` pattern in configuration files
   - Fail fast if referenced environment variable is missing
   - Validate environment variable format and content

3. **API Key Protection**
   - Mask API keys in all log outputs (show first 4 characters only)
   - Never include full API keys in error messages
   - Implement sensitive data redaction in stack traces

4. **File System Security**
   - Configuration files with real secrets: `chmod 600` (owner read/write only)
   - Restrict access to `.env` files
   - Document proper file permissions in setup guide

5. **Validation & Error Handling**
   - Validate all repository configurations on load
   - Check API key format and minimum length
   - Detect placeholder values (e.g., "your_key_here", "example", "${")
   - Provide clear error messages without exposing secrets

6. **Audit & Monitoring**
   - Log repository access (with masked API keys)
   - Log configuration changes
   - Track API key usage patterns
   - Log authentication failures

7. **Future Extensibility**
   - Design supports external secrets managers (AWS, Vault, Azure)
   - `secretSource` field for declaring secret origin
   - `secretPath` for external secret references
   - Pluggable secret resolution architecture

## Required .gitignore Entries

**CRITICAL**: Add these entries to your `.gitignore` file to prevent committing secrets:

```gitignore
# Environment files with secrets
.env
.env.local
.env.*.local

# Local configuration overrides
*.local.json
redmine-repositories.local.json

# Backup files that might contain secrets
*.backup
*.bak

# Log files that might contain API keys
*.log
logs/

# OS-specific files
.DS_Store
Thumbs.db

# IDE files
.vscode/settings.json
.idea/
```

**Safe to commit**:
- `.env.example` - Template with placeholder values
- `redmine-repositories.json` - Configuration with `${VAR}` references
- `redmine-repositories.example.json` - Template configuration

## Example Usage Scenarios

### Scenario 1: Using Default Repository
```json
// Tool call without repository_id uses default
{
  "name": "redmine_list_issues",
  "arguments": {
    "project_id": 1
  }
}
```

### Scenario 2: Switching to Different Repository
```json
// Explicitly specify repository
{
  "name": "redmine_list_issues",
  "arguments": {
    "repository_id": "dev",
    "project_id": 5
  }
}
```

### Scenario 3: Changing Default Repository
```json
{
  "name": "redmine_set_default_repository",
  "arguments": {
    "repository_id": "dev"
  }
}
```

## Configuration File Examples

### Example 1: Minimal Configuration (Recommended)
**File: redmine-repositories.json** (safe to commit to Git)
```json
{
  "configVersion": "1.0",
  "defaultRepositoryId": "main",
  "repositories": [
    {
      "id": "main",
      "displayName": "Main Server",
      "url": "https://redmine.example.com",
      "apiKey": "${REDMINE_MAIN_API_KEY}",
      "secretSource": "environment",
      "enabled": true
    }
  ]
}
```

**File: .env** (MUST be in .gitignore)
```bash
REDMINE_MAIN_API_KEY=abc123def456ghi789
```

**File: .env.example** (template, safe to commit)
```bash
# Redmine API Keys
REDMINE_MAIN_API_KEY=your_main_redmine_api_key_here
```

---

### Example 2: Full Multi-Environment Configuration (Recommended)
**File: redmine-repositories.json** (safe to commit to Git)
```json
{
  "configVersion": "1.0",
  "defaultRepositoryId": "production",
  "repositories": [
    {
      "id": "production",
      "displayName": "Production Redmine",
      "url": "https://redmine.example.com",
      "apiKey": "${REDMINE_PROD_API_KEY}",
      "description": "Production environment issue tracking",
      "secretSource": "environment",
      "defaults": {
        "projectId": 1,
        "trackerId": 2,
        "statusId": 1,
        "priorityId": 2
      },
      "enabled": true
    },
    {
      "id": "staging",
      "displayName": "Staging Redmine",
      "url": "https://staging-redmine.example.com",
      "apiKey": "${REDMINE_STAGING_API_KEY}",
      "description": "Staging environment for testing",
      "secretSource": "environment",
      "defaults": {
        "projectId": 10,
        "trackerId": 1
      },
      "enabled": true
    },
    {
      "id": "development",
      "displayName": "Development Redmine",
      "url": "https://dev-redmine.example.com",
      "apiKey": "${REDMINE_DEV_API_KEY}",
      "description": "Local development server",
      "secretSource": "environment",
      "defaults": {
        "projectId": 5,
        "trackerId": 1
      },
      "enabled": true
    }
  ]
}
```

**File: .env** (MUST be in .gitignore)
```bash
# Production Redmine
REDMINE_PROD_API_KEY=prod_abc123def456ghi789

# Staging Redmine
REDMINE_STAGING_API_KEY=staging_xyz987uvw654rst321

# Development Redmine
REDMINE_DEV_API_KEY=dev_local_key_123456
```

---

### Example 3: Future-Ready Configuration (With Secrets Manager Support)
**File: redmine-repositories.json**
```json
{
  "configVersion": "1.0",
  "defaultRepositoryId": "production",
  "repositories": [
    {
      "id": "production",
      "displayName": "Production Redmine",
      "url": "https://redmine.example.com",
      "apiKey": "${REDMINE_PROD_API_KEY}",
      "secretSource": "environment",
      "description": "Production - uses environment variables",
      "enabled": true
    },
    {
      "id": "production-vault",
      "displayName": "Production (Vault)",
      "url": "https://redmine.example.com",
      "apiKey": "placeholder",
      "secretSource": "vault",
      "secretPath": "secret/redmine/production/api-key",
      "description": "Production - uses HashiCorp Vault (future implementation)",
      "enabled": false
    },
    {
      "id": "production-aws",
      "displayName": "Production (AWS)",
      "url": "https://redmine.example.com",
      "apiKey": "placeholder",
      "secretSource": "aws-secrets-manager",
      "secretPath": "prod/redmine/api-key",
      "description": "Production - uses AWS Secrets Manager (future implementation)",
      "enabled": false
    }
  ]
}
```

## Implementation Details: Secrets Resolution

### SecretsResolver Utility Class

```typescript
// src/config/secrets-resolver.ts
export class SecretsResolver {
  /**
   * Resolve environment variable references in format ${VAR_NAME}
   * @param value - String that may contain ${VAR_NAME} patterns
   * @returns Resolved string with environment variables substituted
   * @throws Error if referenced environment variable is not defined
   */
  static resolve(value: string): string {
    const envVarPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
    
    return value.replace(envVarPattern, (match, varName) => {
      const envValue = process.env[varName];
      
      if (envValue === undefined) {
        throw new Error(
          `Environment variable '${varName}' is not defined. ` +
          `Please set it in your .env file or system environment.`
        );
      }
      
      return envValue;
    });
  }

  /**
   * Check if a string contains environment variable references
   */
  static containsReference(value: string): boolean {
    return /\$\{[A-Z_][A-Z0-9_]*\}/.test(value);
  }

  /**
   * Mask sensitive value for logging
   * @param value - Sensitive string to mask
   * @param visibleChars - Number of characters to show (default: 4)
   */
  static mask(value: string, visibleChars: number = 4): string {
    if (!value || value.length <= visibleChars) {
      return '***';
    }
    return value.slice(0, visibleChars) + '***';
  }

  /**
   * Validate API key format and content
   * @returns Object with validation result and error message if invalid
   */
  static validate(apiKey: string): { valid: boolean; error?: string } {
    // Check minimum length
    if (apiKey.length < 16) {
      return { valid: false, error: 'API key must be at least 16 characters' };
    }
    
    // Check for placeholder values
    const placeholders = ['your_', 'example', 'placeholder', 'changeme', 'xxx'];
    if (placeholders.some(p => apiKey.toLowerCase().includes(p))) {
      return { valid: false, error: 'API key appears to be a placeholder value' };
    }
    
    // Check for unresolved environment variable references
    if (this.containsReference(apiKey)) {
      return { valid: false, error: 'API key contains unresolved environment variable' };
    }
    
    return { valid: true };
  }

  /**
   * Redact API keys from error messages and logs
   */
  static redactFromText(text: string, secrets: string[]): string {
    let redacted = text;
    for (const secret of secrets) {
      if (secret && secret.length > 4) {
        const masked = this.mask(secret);
        redacted = redacted.replace(new RegExp(secret, 'g'), masked);
      }
    }
    return redacted;
  }
}
```

### RedmineRepositoryManager Implementation

```typescript
// src/config/redmine-repository-manager.ts
import { SecretsResolver } from './secrets-resolver';

export class RedmineRepositoryManager {
  private config: RedmineConfig;
  private configPath: string | null = null;
  private resolvedApiKeys: Map<string, string> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.validateAllRepositories();
  }

  /**
   * Load configuration with priority order
   */
  private loadConfig(): RedmineConfig {
    const configPaths = [
      process.env.REDMINE_CONFIG_PATH,
      path.join(process.cwd(), 'redmine-repositories.local.json'),
      path.join(process.cwd(), 'redmine-repositories.json'),
      path.join(os.homedir(), '.mcp-integrated-search', 'redmine-repositories.json'),
    ].filter(Boolean) as string[];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`Loading Redmine configuration from: ${configPath}`);
        this.configPath = configPath;
        const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return this.parseAndValidateConfig(rawConfig);
      }
    }

    // Fallback: Generate from environment variables (backward compatibility)
    console.warn('No configuration file found. Using environment variables (legacy mode).');
    return this.createConfigFromEnvironment();
  }

  /**
   * Resolve API key for a repository
   */
  private async resolveApiKey(repo: RedmineRepository): Promise<string> {
    // Check cache first
    if (this.resolvedApiKeys.has(repo.id)) {
      return this.resolvedApiKeys.get(repo.id)!;
    }

    let apiKey: string;

    switch (repo.secretSource) {
      case 'environment':
      default:
        apiKey = SecretsResolver.resolve(repo.apiKey);
        break;

      // Future implementations
      case 'aws-secrets-manager':
        throw new Error('AWS Secrets Manager integration not yet implemented');
      case 'vault':
        throw new Error('HashiCorp Vault integration not yet implemented');
      case 'azure-keyvault':
        throw new Error('Azure Key Vault integration not yet implemented');
    }

    // Validate the resolved API key
    const validation = SecretsResolver.validate(apiKey);
    if (!validation.valid) {
      throw new Error(`Invalid API key for repository '${repo.id}': ${validation.error}`);
    }

    // Cache the resolved key
    this.resolvedApiKeys.set(repo.id, apiKey);
    
    return apiKey;
  }

  /**
   * Get repository with resolved API key
   */
  async getRepository(id: string): Promise<RedmineRepository | null> {
    const repo = this.config.repositories.find(r => r.id === id);
    if (!repo) return null;

    return {
      ...repo,
      apiKey: await this.resolveApiKey(repo),
    };
  }

  /**
   * List repositories without exposing API keys
   */
  listRepositories(includeDisabled = false): Omit<RedmineRepository, 'apiKey'>[] {
    return this.config.repositories
      .filter(r => includeDisabled || r.enabled)
      .map(r => {
        const { apiKey, ...rest } = r;
        return {
          ...rest,
          apiKeyConfigured: !!apiKey,
          apiKeyMasked: SecretsResolver.mask(apiKey),
        };
      });
  }

  /**
   * Test repository connection
   */
  async testConnection(id: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const repo = await this.getRepository(id);
      if (!repo) {
        return { success: false, message: `Repository '${id}' not found` };
      }

      // Perform actual connection test (implement based on Redmine API)
      const response = await axios.get(`${repo.url}/users/current.json`, {
        headers: { 'X-Redmine-API-Key': repo.apiKey },
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: `Connected successfully to ${repo.displayName}`,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const message = error.response?.status === 401
        ? 'Authentication failed - invalid API key'
        : `Connection failed: ${error.message}`;
      
      // Redact API key from error message
      const redactedMessage = SecretsResolver.redactFromText(
        message,
        Array.from(this.resolvedApiKeys.values())
      );
      
      return {
        success: false,
        message: redactedMessage,
        responseTime,
      };
    }
  }
}
```

## Benefits

1. **Security First**: Follows 2025 industry best practices for secret management
2. **Flexibility**: Easily manage multiple Redmine instances from a single MCP server
3. **Convenience**: Default repository reduces the need to specify repository_id repeatedly
4. **Organization**: Clear separation of different environments (production, staging, development)
5. **Reusability**: Repository defaults reduce repetition in tool calls
6. **Backward Compatibility**: Existing users can continue using environment variables
7. **Discoverability**: New repository management tools make configuration transparent
8. **Future-Proof**: Extensible design supports external secrets managers
9. **Developer Experience**: Clear error messages and validation feedback
10. **Audit Ready**: All secret access is logged (with masking)

## Future Enhancements

### Phase 1 Extensions (Near-term)
1. **Secrets Manager Integration**
   - AWS Secrets Manager support
   - HashiCorp Vault integration
   - Azure Key Vault support
   - Google Secret Manager support

2. **API Key Rotation**
   - Automatic key rotation notifications
   - Multi-key support during rotation period
   - Grace period for key transitions

3. **Enhanced Validation**
   - Connection health checks on startup
   - API key expiration warnings
   - Rate limit monitoring per repository

### Phase 2 Extensions (Medium-term)
4. **Repository Groups**: Organize repositories into logical groups (dev, staging, prod)
5. **Repository Profiles**: Quick-switch between predefined repository sets
6. **Connection Pooling**: Optimize API calls across multiple repositories
7. **Cache Per Repository**: Separate caching for each repository with TTL
8. **Audit Dashboard**: Visualize repository usage and access patterns

### Phase 3 Extensions (Long-term)
9. **Alternative Authentication**: Support OAuth, SAML (if Redmine supports)
10. **Configuration Sync**: Synchronize configuration across team members (via Git)
11. **Encrypted Configuration**: GPG or age encryption for sensitive configs
12. **Dynamic Repository Discovery**: Auto-discover Redmine instances in network
13. **Federation**: Connect multiple MCP servers with different repository sets
