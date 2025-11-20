# Implementation Guide: Multi-Redmine Repository Support

**Project**: MCP Integrated Search Server - Multi-Redmine Support
**Version**: 1.0
**Date**: 2025-11-20

---

## 📋 Overview

This guide provides step-by-step instructions for implementing multi-repository support for Redmine instances, following the design document and product backlog.

**Key Documents**:
- Design Document: `docs/MULTI_REDMINE_DESIGN.md`
- Product Backlog: `docs/PRODUCT_BACKLOG.md`
- Current Implementation: `src/index.ts`

---

## 🎯 Implementation Strategy

### Approach
- **Incremental**: Implement in 4 sprints, maintaining backward compatibility
- **Test-Driven**: Write tests before or alongside implementation
- **Security-First**: Ensure no secrets are exposed at any step
- **Review Early**: Commit and review after each story completion

### Branch Strategy
```bash
main (protected)
  ├── feature/sprint-1-security-foundation
  ├── feature/sprint-2-core-functionality
  ├── feature/sprint-3-tool-integration
  └── feature/sprint-4-documentation
```

---

## 📅 Sprint 1: Security Foundation (Week 1)

**Goal**: Establish secure configuration infrastructure with no secrets in code

### Prerequisites
```bash
# Ensure clean working directory
git status

# Create feature branch
git checkout -b feature/sprint-1-security-foundation
```

---

### Story 1.1: Security Foundation Setup (3 points)

**Objective**: Prevent secrets from being committed to Git

#### Step 1: Update .gitignore
```bash
# Edit .gitignore and add:
```

```gitignore
# Environment files with secrets
.env
.env.local
.env.*.local
.env.production
.env.staging
.env.development

# Local configuration overrides
*.local.json
redmine-repositories.local.json
config/*.local.json

# Backup files that might contain secrets
*.backup
*.bak
*.swp
*~

# Log files that might contain API keys
*.log
logs/
npm-debug.log*

# OS-specific files
.DS_Store
Thumbs.db
desktop.ini

# IDE files (extend existing)
.vscode/settings.json
.idea/
*.sublime-*
```

#### Step 2: Create .env.example
```bash
# Create file: .env.example
```

```bash
# Google Custom Search API Configuration
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here

# Redmine API Keys (Multi-Repository Support)
# Main/Production Redmine
REDMINE_MAIN_API_KEY=your_production_redmine_api_key_here

# Development Redmine
REDMINE_DEV_API_KEY=your_development_redmine_api_key_here

# Staging Redmine (optional)
REDMINE_STAGING_API_KEY=your_staging_redmine_api_key_here

# Legacy Single Repository Support (Backward Compatibility)
REDMINE_URL=https://redmine.example.com
REDMINE_API_KEY=your_legacy_api_key_here

# Logging
LOG_LEVEL=info
```

#### Step 3: Create redmine-repositories.example.json
```bash
# Create file: redmine-repositories.example.json
```

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
      "description": "Primary Redmine server for production",
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
      "id": "dev",
      "displayName": "Development Redmine",
      "url": "https://dev-redmine.example.com",
      "apiKey": "${REDMINE_DEV_API_KEY}",
      "description": "Development and testing server",
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

#### Step 4: Verify No Existing Secrets
```bash
# Install git-secrets (if not installed)
# Windows (via Scoop or Chocolatey):
# scoop install git-secrets
# or
# choco install git-secrets

# Initialize git-secrets
git secrets --install
git secrets --register-aws

# Scan repository
git secrets --scan

# Scan history (may take time)
git secrets --scan-history
```

#### Step 5: Update README.md Security Section
Add to README.md (create new section):

```markdown
## 🔐 Security Best Practices

**CRITICAL**: Never commit secrets to Git!

### Setup for Multi-Repository Support

1. Copy example files:
   ```bash
   cp .env.example .env
   cp redmine-repositories.example.json redmine-repositories.json
   ```

2. Edit `.env` and add your actual API keys
3. Edit `redmine-repositories.json` if needed (keep ${VAR} references)
4. Verify `.env` is in `.gitignore`

### Environment Variables

All API keys must be stored in environment variables, not in configuration files committed to Git.

Configuration files use `${VARIABLE_NAME}` syntax to reference environment variables.
```

**Commit Point**:
```bash
git add .gitignore .env.example redmine-repositories.example.json README.md
git commit -m "feat: add security foundation - prevent secret exposure"
```

---

### Story 1.2: Secrets Resolver Utility (5 points)

**Objective**: Implement utility for secure secret handling

#### Step 1: Create Directory Structure
```bash
mkdir -p src/config
```

#### Step 2: Create secrets-resolver.ts
```bash
# Create file: src/config/secrets-resolver.ts
```

```typescript
/**
 * Utility class for resolving and managing secrets securely
 * Following 2025 best practices for secret management
 */
export class SecretsResolver {
  /**
   * Resolve environment variable references in format ${VAR_NAME}
   * @param value - String that may contain ${VAR_NAME} patterns
   * @returns Resolved string with environment variables substituted
   * @throws Error if referenced environment variable is not defined
   */
  static resolve(value: string): string {
    // Pattern matches ${VARIABLE_NAME} where VARIABLE_NAME starts with A-Z or _
    // and contains only uppercase letters, numbers, and underscores
    const envVarPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
    
    return value.replace(envVarPattern, (match, varName) => {
      const envValue = process.env[varName];
      
      if (envValue === undefined) {
        throw new Error(
          `Environment variable '${varName}' is not defined. ` +
          `Please set it in your .env file or system environment.\n` +
          `Reference: ${match} in value: ${this.mask(value, 20)}`
        );
      }
      
      return envValue;
    });
  }

  /**
   * Check if a string contains environment variable references
   * @param value - String to check
   * @returns True if value contains ${VAR_NAME} pattern
   */
  static containsReference(value: string): boolean {
    return /\$\{[A-Z_][A-Z0-9_]*\}/.test(value);
  }

  /**
   * Mask sensitive value for logging
   * @param value - Sensitive string to mask
   * @param visibleChars - Number of characters to show at the start (default: 4)
   * @returns Masked string (e.g., "abc1***")
   */
  static mask(value: string, visibleChars: number = 4): string {
    if (!value) {
      return '***';
    }
    
    if (value.length <= visibleChars) {
      return '***';
    }
    
    return value.slice(0, visibleChars) + '***';
  }

  /**
   * Validate API key format and content
   * @param apiKey - API key to validate
   * @returns Object with validation result and error message if invalid
   */
  static validate(apiKey: string): { valid: boolean; error?: string } {
    if (!apiKey || typeof apiKey !== 'string') {
      return { valid: false, error: 'API key is required and must be a string' };
    }

    // Check minimum length (most API keys are at least 16 characters)
    if (apiKey.length < 16) {
      return { 
        valid: false, 
        error: 'API key must be at least 16 characters. Current length: ' + apiKey.length 
      };
    }
    
    // Check for common placeholder values
    const placeholders = [
      'your_',
      'example',
      'placeholder',
      'changeme',
      'replace',
      'xxx',
      'test',
      'dummy',
      'sample',
    ];
    
    const lowerKey = apiKey.toLowerCase();
    for (const placeholder of placeholders) {
      if (lowerKey.includes(placeholder)) {
        return { 
          valid: false, 
          error: `API key appears to be a placeholder value (contains '${placeholder}')` 
        };
      }
    }
    
    // Check for unresolved environment variable references
    if (this.containsReference(apiKey)) {
      return { 
        valid: false, 
        error: 'API key contains unresolved environment variable reference' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Redact API keys and secrets from error messages and logs
   * @param text - Text that may contain secrets
   * @param secrets - Array of secret strings to redact
   * @returns Text with secrets replaced by masked values
   */
  static redactFromText(text: string, secrets: string[]): string {
    if (!text) return text;
    
    let redacted = text;
    
    for (const secret of secrets) {
      if (secret && secret.length > 4) {
        const masked = this.mask(secret);
        // Use global regex to replace all occurrences
        const regex = new RegExp(this.escapeRegExp(secret), 'g');
        redacted = redacted.replace(regex, masked);
      }
    }
    
    return redacted;
  }

  /**
   * Escape special regex characters in a string
   * @private
   */
  private static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract all environment variable references from a string
   * @param value - String to extract from
   * @returns Array of variable names (without ${ })
   */
  static extractReferences(value: string): string[] {
    const envVarPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/g;
    const matches: string[] = [];
    let match;
    
    while ((match = envVarPattern.exec(value)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  /**
   * Validate that all required environment variables are set
   * @param requiredVars - Array of required variable names
   * @returns Object with validation result and list of missing variables
   */
  static validateEnvironment(requiredVars: string[]): { 
    valid: boolean; 
    missing: string[]; 
  } {
    const missing: string[] = [];
    
    for (const varName of requiredVars) {
      if (process.env[varName] === undefined) {
        missing.push(varName);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
```

#### Step 3: Create Unit Tests
```bash
# Create file: src/config/secrets-resolver.test.ts
```

```typescript
import { SecretsResolver } from './secrets-resolver';

describe('SecretsResolver', () => {
  describe('resolve', () => {
    beforeEach(() => {
      // Set up test environment variables
      process.env.TEST_API_KEY = 'test_secret_key_12345';
      process.env.ANOTHER_VAR = 'another_value';
    });

    afterEach(() => {
      // Clean up
      delete process.env.TEST_API_KEY;
      delete process.env.ANOTHER_VAR;
    });

    it('should resolve single environment variable', () => {
      const result = SecretsResolver.resolve('${TEST_API_KEY}');
      expect(result).toBe('test_secret_key_12345');
    });

    it('should resolve multiple environment variables', () => {
      const result = SecretsResolver.resolve('${TEST_API_KEY}:${ANOTHER_VAR}');
      expect(result).toBe('test_secret_key_12345:another_value');
    });

    it('should return unchanged string without references', () => {
      const result = SecretsResolver.resolve('no_variables_here');
      expect(result).toBe('no_variables_here');
    });

    it('should throw error for undefined variable', () => {
      expect(() => {
        SecretsResolver.resolve('${UNDEFINED_VAR}');
      }).toThrow("Environment variable 'UNDEFINED_VAR' is not defined");
    });
  });

  describe('validate', () => {
    it('should accept valid API key', () => {
      const result = SecretsResolver.validate('valid_api_key_1234567890');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject short API key', () => {
      const result = SecretsResolver.validate('short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 16 characters');
    });

    it('should reject placeholder values', () => {
      const result = SecretsResolver.validate('your_api_key_here');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('placeholder');
    });

    it('should reject unresolved references', () => {
      const result = SecretsResolver.validate('${UNRESOLVED_VAR}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unresolved');
    });
  });

  describe('mask', () => {
    it('should mask long string', () => {
      const result = SecretsResolver.mask('secret_key_12345');
      expect(result).toBe('secr***');
    });

    it('should mask short string', () => {
      const result = SecretsResolver.mask('abc');
      expect(result).toBe('***');
    });

    it('should handle empty string', () => {
      const result = SecretsResolver.mask('');
      expect(result).toBe('***');
    });
  });

  describe('redactFromText', () => {
    it('should redact secrets from text', () => {
      const secrets = ['secret123', 'password456'];
      const text = 'The secret123 is exposed and password456 too';
      const result = SecretsResolver.redactFromText(text, secrets);
      expect(result).toBe('The secr*** is exposed and pass*** too');
    });

    it('should handle multiple occurrences', () => {
      const secrets = ['secret'];
      const text = 'secret is secret';
      const result = SecretsResolver.redactFromText(text, secrets);
      expect(result).not.toContain('secret');
    });
  });
});
```

#### Step 4: Run Tests
```bash
# Install test dependencies if needed
npm install --save-dev @types/jest jest ts-jest

# Add to package.json scripts:
# "test": "jest",
# "test:watch": "jest --watch",
# "test:coverage": "jest --coverage"

# Run tests
npm test src/config/secrets-resolver.test.ts
```

**Commit Point**:
```bash
git add src/config/
git commit -m "feat: implement SecretsResolver utility with tests"
```

---

### Story 1.3: Configuration Schema & Validation (5 points)

**Objective**: Define TypeScript interfaces and Zod schemas

#### Step 1: Create types.ts
```bash
# Create file: src/config/types.ts
```

```typescript
/**
 * Type definitions for multi-repository Redmine configuration
 */

/**
 * Source of the API key secret
 */
export type SecretSource = 
  | 'environment'           // From environment variables (default)
  | 'aws-secrets-manager'   // AWS Secrets Manager (future)
  | 'vault'                 // HashiCorp Vault (future)
  | 'azure-keyvault';       // Azure Key Vault (future)

/**
 * Default values for Redmine operations
 */
export interface RedmineDefaults {
  projectId?: number;
  trackerId?: number;
  statusId?: number;
  priorityId?: number;
  assignedToId?: number;
}

/**
 * Redmine repository configuration
 */
export interface RedmineRepository {
  /** Unique identifier for this repository */
  id: string;
  
  /** Human-readable display name */
  displayName: string;
  
  /** Base URL of the Redmine instance */
  url: string;
  
  /** API key or environment variable reference (${VAR_NAME}) */
  apiKey: string;
  
  /** Optional description of this repository */
  description?: string;
  
  /** Source of the secret (default: environment) */
  secretSource?: SecretSource;
  
  /** Path to secret in external secret manager (for future use) */
  secretPath?: string;
  
  /** Default values for this repository */
  defaults?: RedmineDefaults;
  
  /** Whether this repository is enabled */
  enabled: boolean;
}

/**
 * Complete Redmine configuration
 */
export interface RedmineConfig {
  /** Configuration schema version */
  configVersion: string;
  
  /** ID of the default repository */
  defaultRepositoryId: string;
  
  /** List of configured repositories */
  repositories: RedmineRepository[];
}

/**
 * Repository information for listing (without sensitive data)
 */
export interface RedmineRepositoryInfo extends Omit<RedmineRepository, 'apiKey'> {
  /** Whether API key is configured */
  apiKeyConfigured: boolean;
  
  /** Masked API key for display */
  apiKeyMasked: string;
  
  /** Whether this is the default repository */
  isDefault?: boolean;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  /** Whether connection was successful */
  success: boolean;
  
  /** Human-readable message */
  message: string;
  
  /** Response time in milliseconds */
  responseTime?: number;
  
  /** Redmine server version (if available) */
  serverVersion?: string;
}
```

#### Step 2: Create schemas.ts
```bash
# Create file: src/config/schemas.ts
```

```typescript
import { z } from 'zod';

/**
 * Zod validation schemas for Redmine configuration
 */

export const SecretSourceSchema = z.enum([
  'environment',
  'aws-secrets-manager',
  'vault',
  'azure-keyvault',
]);

export const RedmineDefaultsSchema = z.object({
  projectId: z.number().int().positive().optional(),
  trackerId: z.number().int().positive().optional(),
  statusId: z.number().int().positive().optional(),
  priorityId: z.number().int().positive().optional(),
  assignedToId: z.number().int().positive().optional(),
}).optional();

export const RedmineRepositorySchema = z.object({
  id: z.string()
    .min(1, 'Repository ID is required')
    .regex(/^[a-z0-9-_]+$/, 'Repository ID must contain only lowercase letters, numbers, hyphens, and underscores'),
  
  displayName: z.string().min(1, 'Display name is required'),
  
  url: z.string()
    .url('Invalid Redmine URL')
    .refine(url => !url.endsWith('/'), 'URL should not end with a slash'),
  
  apiKey: z.string().min(1, 'API key or environment variable reference is required'),
  
  description: z.string().optional(),
  
  secretSource: SecretSourceSchema.optional().default('environment'),
  
  secretPath: z.string().optional(),
  
  defaults: RedmineDefaultsSchema,
  
  enabled: z.boolean().default(true),
});

export const RedmineConfigSchema = z.object({
  configVersion: z.string()
    .regex(/^\d+\.\d+$/, 'Config version must be in format "X.Y"')
    .default('1.0'),
  
  defaultRepositoryId: z.string().min(1, 'Default repository ID is required'),
  
  repositories: z.array(RedmineRepositorySchema)
    .min(1, 'At least one repository is required')
    .refine(
      repos => {
        const ids = repos.map(r => r.id);
        return ids.length === new Set(ids).size;
      },
      'Repository IDs must be unique'
    ),
}).refine(
  config => config.repositories.some(r => r.id === config.defaultRepositoryId),
  config => ({
    message: `Default repository '${config.defaultRepositoryId}' not found in repositories list`,
    path: ['defaultRepositoryId'],
  })
);

/**
 * Type inference from Zod schemas
 */
export type RedmineRepositoryInput = z.input<typeof RedmineRepositorySchema>;
export type RedmineConfigInput = z.input<typeof RedmineConfigSchema>;
```

#### Step 3: Create Tests
```bash
# Create file: src/config/schemas.test.ts
```

```typescript
import { RedmineConfigSchema, RedmineRepositorySchema } from './schemas';

describe('Redmine Configuration Schemas', () => {
  describe('RedmineRepositorySchema', () => {
    it('should validate valid repository', () => {
      const validRepo = {
        id: 'main',
        displayName: 'Main Server',
        url: 'https://redmine.example.com',
        apiKey: '${REDMINE_API_KEY}',
        enabled: true,
      };
      
      const result = RedmineRepositorySchema.safeParse(validRepo);
      expect(result.success).toBe(true);
    });

    it('should reject invalid repository ID', () => {
      const invalidRepo = {
        id: 'Main Server',  // Contains spaces
        displayName: 'Main',
        url: 'https://redmine.example.com',
        apiKey: 'key',
      };
      
      const result = RedmineRepositorySchema.safeParse(invalidRepo);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL', () => {
      const invalidRepo = {
        id: 'main',
        displayName: 'Main',
        url: 'not-a-url',
        apiKey: 'key',
      };
      
      const result = RedmineRepositorySchema.safeParse(invalidRepo);
      expect(result.success).toBe(false);
    });

    it('should apply defaults', () => {
      const repo = {
        id: 'main',
        displayName: 'Main',
        url: 'https://redmine.example.com',
        apiKey: 'key',
      };
      
      const result = RedmineRepositorySchema.parse(repo);
      expect(result.enabled).toBe(true);
      expect(result.secretSource).toBe('environment');
    });
  });

  describe('RedmineConfigSchema', () => {
    it('should validate valid config', () => {
      const validConfig = {
        configVersion: '1.0',
        defaultRepositoryId: 'main',
        repositories: [
          {
            id: 'main',
            displayName: 'Main',
            url: 'https://redmine.example.com',
            apiKey: 'key',
            enabled: true,
          },
        ],
      };
      
      const result = RedmineConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject duplicate repository IDs', () => {
      const invalidConfig = {
        configVersion: '1.0',
        defaultRepositoryId: 'main',
        repositories: [
          { id: 'main', displayName: 'Main 1', url: 'https://r1.com', apiKey: 'k1' },
          { id: 'main', displayName: 'Main 2', url: 'https://r2.com', apiKey: 'k2' },
        ],
      };
      
      const result = RedmineConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject if default repository not in list', () => {
      const invalidConfig = {
        configVersion: '1.0',
        defaultRepositoryId: 'nonexistent',
        repositories: [
          { id: 'main', displayName: 'Main', url: 'https://r.com', apiKey: 'k' },
        ],
      };
      
      const result = RedmineConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });
});
```

**Commit Point**:
```bash
git add src/config/types.ts src/config/schemas.ts src/config/schemas.test.ts
git commit -m "feat: add configuration types and Zod validation schemas"
```

---

### Story 1.4: Repository Manager Core (8 points)

**Objective**: Implement core repository management functionality

#### Step 1: Create redmine-repository-manager.ts

This is a large file. Create it in stages:

```bash
# Create file: src/config/redmine-repository-manager.ts
```

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { SecretsResolver } from './secrets-resolver';
import { RedmineConfig, RedmineRepository, RedmineRepositoryInfo, ConnectionTestResult } from './types';
import { RedmineConfigSchema } from './schemas';

/**
 * Manager for Redmine repository configurations
 * Handles loading, validation, and secret resolution
 */
export class RedmineRepositoryManager {
  private config: RedmineConfig;
  private configPath: string | null = null;
  private resolvedApiKeys: Map<string, string> = new Map();

  constructor(configPathOverride?: string) {
    this.config = this.loadConfig(configPathOverride);
    this.validateAllRepositories();
  }

  /**
   * Load configuration from file or environment variables
   * Searches in priority order
   */
  private loadConfig(configPathOverride?: string): RedmineConfig {
    const configPaths = [
      configPathOverride,
      process.env.REDMINE_CONFIG_PATH,
      path.join(process.cwd(), 'redmine-repositories.local.json'),
      path.join(process.cwd(), 'redmine-repositories.json'),
      path.join(os.homedir(), '.mcp-integrated-search', 'redmine-repositories.json'),
    ].filter(Boolean) as string[];

    // Try to load from file
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`[RedmineRepositoryManager] Loading configuration from: ${configPath}`);
        this.configPath = configPath;
        
        try {
          const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          return this.parseAndValidateConfig(rawConfig);
        } catch (error: any) {
          console.error(`[RedmineRepositoryManager] Error loading config from ${configPath}:`, error.message);
          throw new Error(`Failed to load configuration from ${configPath}: ${error.message}`);
        }
      }
    }

    // Fallback: Generate from environment variables (backward compatibility)
    console.warn('[RedmineRepositoryManager] No configuration file found. Using environment variables (legacy mode).');
    return this.createConfigFromEnvironment();
  }

  /**
   * Parse and validate configuration
   */
  private parseAndValidateConfig(rawConfig: any): RedmineConfig {
    try {
      const validated = RedmineConfigSchema.parse(rawConfig);
      console.log(`[RedmineRepositoryManager] Configuration validated successfully. Found ${validated.repositories.length} repositories.`);
      return validated;
    } catch (error: any) {
      console.error('[RedmineRepositoryManager] Configuration validation failed:', error.message);
      throw new Error(`Invalid configuration: ${error.message}`);
    }
  }

  /**
   * Create configuration from environment variables (backward compatibility)
   */
  private createConfigFromEnvironment(): RedmineConfig {
    const redmineUrl = process.env.REDMINE_URL;
    const redmineApiKey = process.env.REDMINE_API_KEY;

    if (!redmineUrl || !redmineApiKey) {
      throw new Error(
        'No configuration file found and REDMINE_URL or REDMINE_API_KEY environment variables are not set. ' +
        'Please create a redmine-repositories.json file or set environment variables.'
      );
    }

    console.log('[RedmineRepositoryManager] Generated configuration from environment variables');
    
    return {
      configVersion: '1.0',
      defaultRepositoryId: 'default',
      repositories: [
        {
          id: 'default',
          displayName: 'Default Redmine Server',
          url: redmineUrl,
          apiKey: redmineApiKey,
          description: 'Auto-generated from environment variables (legacy mode)',
          secretSource: 'environment',
          enabled: true,
        },
      ],
    };
  }

  /**
   * Validate all repositories on load
   */
  private validateAllRepositories(): void {
    for (const repo of this.config.repositories) {
      if (!repo.enabled) continue;

      // Check if API key is a reference
      if (SecretsResolver.containsReference(repo.apiKey)) {
        const refs = SecretsResolver.extractReferences(repo.apiKey);
        const envCheck = SecretsResolver.validateEnvironment(refs);
        
        if (!envCheck.valid) {
          throw new Error(
            `Repository '${repo.id}': Missing environment variables: ${envCheck.missing.join(', ')}`
          );
        }
      }
    }
  }

  /**
   * Resolve API key for a repository
   * Caches resolved keys for performance
   */
  private async resolveApiKey(repo: RedmineRepository): Promise<string> {
    // Check cache first
    if (this.resolvedApiKeys.has(repo.id)) {
      return this.resolvedApiKeys.get(repo.id)!;
    }

    let apiKey: string;

    try {
      switch (repo.secretSource) {
        case 'environment':
        case undefined:
          apiKey = SecretsResolver.resolve(repo.apiKey);
          break;

        case 'aws-secrets-manager':
          throw new Error('AWS Secrets Manager integration not yet implemented');
        
        case 'vault':
          throw new Error('HashiCorp Vault integration not yet implemented');
        
        case 'azure-keyvault':
          throw new Error('Azure Key Vault integration not yet implemented');
        
        default:
          throw new Error(`Unknown secret source: ${repo.secretSource}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to resolve API key for repository '${repo.id}': ${error.message}`);
    }

    // Validate the resolved API key
    const validation = SecretsResolver.validate(apiKey);
    if (!validation.valid) {
      throw new Error(`Invalid API key for repository '${repo.id}': ${validation.error}`);
    }

    // Cache the resolved key
    this.resolvedApiKeys.set(repo.id, apiKey);
    
    console.log(`[RedmineRepositoryManager] API key resolved for repository '${repo.id}': ${SecretsResolver.mask(apiKey)}`);
    
    return apiKey;
  }

  /**
   * Get repository with resolved API key
   */
  async getRepository(id: string): Promise<RedmineRepository | null> {
    const repo = this.config.repositories.find(r => r.id === id);
    if (!repo) {
      console.warn(`[RedmineRepositoryManager] Repository '${id}' not found`);
      return null;
    }

    if (!repo.enabled) {
      console.warn(`[RedmineRepositoryManager] Repository '${id}' is disabled`);
      return null;
    }

    return {
      ...repo,
      apiKey: await this.resolveApiKey(repo),
    };
  }

  /**
   * Get default repository
   */
  async getDefaultRepository(): Promise<RedmineRepository | null> {
    return this.getRepository(this.config.defaultRepositoryId);
  }

  /**
   * Set default repository
   */
  setDefaultRepository(id: string): boolean {
    const repo = this.config.repositories.find(r => r.id === id);
    
    if (!repo) {
      console.error(`[RedmineRepositoryManager] Cannot set default: Repository '${id}' not found`);
      return false;
    }

    if (!repo.enabled) {
      console.error(`[RedmineRepositoryManager] Cannot set default: Repository '${id}' is disabled`);
      return false;
    }

    this.config.defaultRepositoryId = id;
    this.saveConfig();
    
    console.log(`[RedmineRepositoryManager] Default repository set to '${id}'`);
    return true;
  }

  /**
   * List repositories without exposing API keys
   */
  listRepositories(includeDisabled = false): RedmineRepositoryInfo[] {
    return this.config.repositories
      .filter(r => includeDisabled || r.enabled)
      .map(r => {
        const { apiKey, ...rest } = r;
        return {
          ...rest,
          apiKeyConfigured: !!apiKey,
          apiKeyMasked: SecretsResolver.mask(apiKey),
          isDefault: r.id === this.config.defaultRepositoryId,
        };
      });
  }

  /**
   * Test repository connection
   */
  async testConnection(id: string): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      const repo = await this.getRepository(id);
      if (!repo) {
        return { 
          success: false, 
          message: `Repository '${id}' not found or is disabled` 
        };
      }

      console.log(`[RedmineRepositoryManager] Testing connection to '${id}' (${repo.url})`);

      // Test connection using Redmine API
      const response = await axios.get(`${repo.url}/users/current.json`, {
        headers: { 
          'X-Redmine-API-Key': repo.apiKey,
          'User-Agent': 'MCP-Integrated-Search-Server/1.0',
        },
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: `Successfully connected to ${repo.displayName}`,
        responseTime,
        serverVersion: response.headers['x-redmine-api-version'] || 'unknown',
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      let message: string;
      if (error.response?.status === 401) {
        message = 'Authentication failed - invalid API key';
      } else if (error.code === 'ECONNREFUSED') {
        message = 'Connection refused - server may be down';
      } else if (error.code === 'ETIMEDOUT') {
        message = 'Connection timeout - server not responding';
      } else {
        message = `Connection failed: ${error.message}`;
      }
      
      // Redact API key from error message
      const redactedMessage = SecretsResolver.redactFromText(
        message,
        Array.from(this.resolvedApiKeys.values())
      );
      
      console.error(`[RedmineRepositoryManager] Connection test failed for '${id}':`, redactedMessage);
      
      return {
        success: false,
        message: redactedMessage,
        responseTime,
      };
    }
  }

  /**
   * Save configuration to file
   */
  saveConfig(): void {
    if (!this.configPath) {
      console.warn('[RedmineRepositoryManager] No configuration file path set. Cannot save.');
      return;
    }

    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      console.log(`[RedmineRepositoryManager] Configuration saved to ${this.configPath}`);
    } catch (error: any) {
      console.error(`[RedmineRepositoryManager] Failed to save configuration:`, error.message);
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration file path (for debugging)
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Get configuration version
   */
  getConfigVersion(): string {
    return this.config.configVersion;
  }

  /**
   * Clear resolved API key cache
   */
  clearCache(): void {
    this.resolvedApiKeys.clear();
    console.log('[RedmineRepositoryManager] API key cache cleared');
  }
}
```

**File is large - continue in next step for tests and integration**

#### Step 2: Test Setup
```bash
npm test
```

**Commit Point**:
```bash
git add src/config/redmine-repository-manager.ts
git commit -m "feat: implement RedmineRepositoryManager core functionality"
```

---

### Sprint 1 Complete

**Merge and Review**:
```bash
# Run all tests
npm test

# Check coverage
npm run test:coverage

# Merge to main
git checkout main
git merge feature/sprint-1-security-foundation
git push origin main

# Tag release
git tag v0.1.0-sprint1
git push origin v0.1.0-sprint1
```

---

## 📅 Sprint 2-4: Coming Next

Due to length constraints, the detailed implementation guides for Sprints 2-4 are in separate sections:

- **Sprint 2**: Core Functionality (`docs/SPRINT_2_GUIDE.md`)
- **Sprint 3**: Tool Integration (`docs/SPRINT_3_GUIDE.md`)
- **Sprint 4**: Documentation & Polish (`docs/SPRINT_4_GUIDE.md`)

---

## 🔍 Testing Strategy

### Unit Tests
- Run after each story completion
- Aim for 90%+ coverage
- Use Jest with TypeScript

### Integration Tests
- Test multi-repository scenarios
- Mock Redmine API responses
- Test backward compatibility

### Security Tests
- Run git-secrets on every commit
- Verify no API keys in logs
- Test error message redaction

---

## 📊 Progress Tracking

Create issues in GitHub for each story:
```bash
# Example
gh issue create --title "Story 1.1: Security Foundation Setup" \
  --label "sprint-1,security" \
  --milestone "Sprint 1" \
  --body "See PRODUCT_BACKLOG.md"
```

---

## 🚨 Troubleshooting

### Common Issues

**Issue**: Tests fail with environment variable errors
**Solution**: Ensure `.env` file exists and is loaded in tests

**Issue**: Configuration not loading
**Solution**: Check file paths and permissions (chmod 600)

**Issue**: API key validation fails
**Solution**: Verify key length and format, check for placeholders

---

## ✅ Definition of Done Checklist

For each story:

- [ ] Code implemented and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing (if applicable)
- [ ] Documentation updated
- [ ] No secrets in code or logs
- [ ] Security review completed
- [ ] Committed and pushed to feature branch

---

## 📚 Additional Resources

- Design Document: `docs/MULTI_REDMINE_DESIGN.md`
- Product Backlog: `docs/PRODUCT_BACKLOG.md`
- Redmine API Documentation: https://www.redmine.org/projects/redmine/wiki/Rest_api
- MCP SDK Documentation: https://github.com/modelcontextprotocol/sdk

---

**Next Steps**: Begin Sprint 1, Story 1.1 - Security Foundation Setup
