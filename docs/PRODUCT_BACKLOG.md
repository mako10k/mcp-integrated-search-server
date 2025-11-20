# Product Backlog: Multi-Redmine Repository Support

**Project**: MCP Integrated Search Server - Multi-Redmine Support
**Version**: 1.0
**Last Updated**: 2025-11-20

## Overview

This backlog tracks the implementation of multi-repository support for Redmine instances, following 2025 security best practices for secret management.

---

## Epic 1: Security & Configuration Infrastructure 🔐

**Priority**: CRITICAL | **Sprint**: 1

### Story 1.1: Security Foundation Setup
**Points**: 3 | **Priority**: P0

**Description**: Set up security infrastructure to prevent secrets from being committed to Git.

**Acceptance Criteria**:
- [ ] Update `.gitignore` with all secret-related files
- [ ] Create `.env.example` template file
- [ ] Create `redmine-repositories.example.json` template
- [ ] Add security warnings to README.md
- [ ] Verify no existing secrets in Git history

**Tasks**:
- [ ] Update `.gitignore` file
- [ ] Create `.env.example` with placeholder values
- [ ] Create example configuration file
- [ ] Document security requirements in README
- [ ] Run git-secrets or similar tool to scan for existing secrets

---

### Story 1.2: Secrets Resolver Utility
**Points**: 5 | **Priority**: P0

**Description**: Implement utility class for resolving and managing secrets securely.

**Acceptance Criteria**:
- [ ] Resolve `${VAR_NAME}` pattern to environment variables
- [ ] Validate API key format and content
- [ ] Mask API keys in logs (show first 4 chars only)
- [ ] Detect placeholder values
- [ ] Redact secrets from error messages
- [ ] 100% test coverage for SecretsResolver

**Tasks**:
- [ ] Create `src/config/secrets-resolver.ts`
- [ ] Implement `resolve()` method with env var pattern matching
- [ ] Implement `validate()` method with checks for placeholders
- [ ] Implement `mask()` method for logging
- [ ] Implement `redactFromText()` for error messages
- [ ] Write comprehensive unit tests
- [ ] Add JSDoc documentation

**Technical Notes**:
```typescript
// Pattern: /\$\{([A-Z_][A-Z0-9_]*)\}/g
// Validate: min 16 chars, no placeholders
// Mask: show first 4 chars + "***"
```

---

### Story 1.3: Configuration Schema & Validation
**Points**: 5 | **Priority**: P0

**Description**: Define TypeScript interfaces and Zod schemas for repository configuration.

**Acceptance Criteria**:
- [ ] Define `RedmineRepository` interface with `secretSource` field
- [ ] Define `RedmineConfig` interface with `configVersion`
- [ ] Implement Zod validation schemas
- [ ] Validate configuration on load
- [ ] Support schema versioning for future migrations
- [ ] Provide clear validation error messages

**Tasks**:
- [ ] Create `src/config/types.ts` with interfaces
- [ ] Create `src/config/schemas.ts` with Zod schemas
- [ ] Add `secretSource` enum validation
- [ ] Add `configVersion` validation
- [ ] Implement schema migration logic (for future use)
- [ ] Write validation tests

**Technical Notes**:
```typescript
secretSource: 'environment' | 'aws-secrets-manager' | 'vault' | 'azure-keyvault'
configVersion: "1.0" (semantic versioning)
```

---

### Story 1.4: Repository Manager Core
**Points**: 8 | **Priority**: P0

**Description**: Implement core RedmineRepositoryManager class with config loading and secret resolution.

**Acceptance Criteria**:
- [ ] Load configuration from prioritized file locations
- [ ] Resolve API keys using SecretsResolver
- [ ] Cache resolved API keys in memory
- [ ] Validate all repositories on load
- [ ] Generate config from env vars (backward compatibility)
- [ ] Log configuration source (with masked keys)
- [ ] Handle missing configuration gracefully

**Tasks**:
- [ ] Create `src/config/redmine-repository-manager.ts`
- [ ] Implement `loadConfig()` with priority order
- [ ] Implement `resolveApiKey()` with caching
- [ ] Implement `validateAllRepositories()`
- [ ] Implement `createConfigFromEnvironment()` for legacy mode
- [ ] Add comprehensive error handling
- [ ] Write integration tests
- [ ] Add performance tests for config loading

**Configuration Priority Order**:
1. `REDMINE_CONFIG_PATH` environment variable
2. `./redmine-repositories.local.json`
3. `./redmine-repositories.json`
4. `~/.mcp-integrated-search/redmine-repositories.json`
5. Generate from environment variables (legacy)

---

## Epic 2: Repository Management 📚

**Priority**: HIGH | **Sprint**: 2

### Story 2.1: Get Repository with Resolved Secrets
**Points**: 3 | **Priority**: P1

**Description**: Implement method to retrieve repository configuration with resolved API keys.

**Acceptance Criteria**:
- [ ] Get repository by ID
- [ ] Resolve API key at runtime
- [ ] Return null if repository not found
- [ ] Cache resolved keys for performance
- [ ] Handle disabled repositories appropriately

**Tasks**:
- [ ] Implement `getRepository(id: string)` method
- [ ] Add error handling for resolution failures
- [ ] Write unit tests
- [ ] Document method behavior

---

### Story 2.2: List Repositories (Secure)
**Points**: 3 | **Priority**: P1

**Description**: Implement method to list repositories without exposing API keys.

**Acceptance Criteria**:
- [ ] Return repository list with masked API keys
- [ ] Include `apiKeyConfigured` boolean flag
- [ ] Show masked API key (first 4 chars)
- [ ] Filter by enabled/disabled status
- [ ] Sort repositories by ID

**Tasks**:
- [ ] Implement `listRepositories(includeDisabled?: boolean)` method
- [ ] Omit actual API keys from response
- [ ] Add masked key display
- [ ] Write unit tests

---

### Story 2.3: Default Repository Management
**Points**: 3 | **Priority**: P1

**Description**: Implement methods for managing the default repository.

**Acceptance Criteria**:
- [ ] Get current default repository
- [ ] Set new default repository by ID
- [ ] Validate repository exists before setting as default
- [ ] Persist default repository selection
- [ ] Return resolved repository configuration

**Tasks**:
- [ ] Implement `getDefaultRepository()` method
- [ ] Implement `setDefaultRepository(id: string)` method
- [ ] Add validation logic
- [ ] Update configuration file on change
- [ ] Write unit tests

---

### Story 2.4: Connection Testing
**Points**: 5 | **Priority**: P1

**Description**: Implement repository connection testing with actual API calls.

**Acceptance Criteria**:
- [ ] Test connection to Redmine API
- [ ] Validate API key authentication
- [ ] Measure response time
- [ ] Return clear success/failure messages
- [ ] Redact API keys from error messages
- [ ] Handle timeout scenarios (5 second timeout)

**Tasks**:
- [ ] Implement `testConnection(id: string)` method
- [ ] Use `/users/current.json` endpoint for testing
- [ ] Add timeout handling
- [ ] Implement error message redaction
- [ ] Write integration tests with mock server
- [ ] Add retry logic (optional)

---

## Epic 3: Tool Integration 🔧

**Priority**: HIGH | **Sprint**: 2-3

### Story 3.1: Add Repository ID Parameter to Tools
**Points**: 8 | **Priority**: P1

**Description**: Update all existing Redmine tools to accept optional `repository_id` parameter.

**Acceptance Criteria**:
- [ ] Add `repository_id` parameter to all Redmine tool schemas
- [ ] Parameter is optional (defaults to default repository)
- [ ] Update tool descriptions
- [ ] Maintain backward compatibility
- [ ] All existing tests still pass

**Affected Tools**:
- [ ] `redmine_list_issues`
- [ ] `redmine_create_issue`
- [ ] `redmine_list_projects`
- [ ] `redmine_get_issue`
- [ ] `redmine_update_issue`
- [ ] `redmine_bulk_update_issues`

**Tasks**:
- [ ] Update tool input schemas
- [ ] Add repository_id parameter to Zod schemas
- [ ] Update tool descriptions with repository parameter info
- [ ] Update example usage in documentation

---

### Story 3.2: Update API Request Functions
**Points**: 8 | **Priority**: P1

**Description**: Modify Redmine API request functions to use repository-specific configuration.

**Acceptance Criteria**:
- [ ] Resolve repository ID to configuration
- [ ] Use repository-specific URL and API key
- [ ] Fall back to default repository if ID not provided
- [ ] Mask API keys in all log outputs
- [ ] Handle repository not found errors
- [ ] Update all API call sites

**Tasks**:
- [ ] Create helper function `getRedmineConfig(repository_id?: string)`
- [ ] Update all axios calls to use repository config
- [ ] Add error handling for missing repositories
- [ ] Update logging to mask API keys
- [ ] Refactor common API request logic
- [ ] Write integration tests

---

### Story 3.3: Backward Compatibility Testing
**Points**: 5 | **Priority**: P1

**Description**: Ensure all existing tool usage patterns still work without modification.

**Acceptance Criteria**:
- [ ] Tools work without `repository_id` parameter
- [ ] Environment variable configuration still works
- [ ] Legacy `.env` setup is supported
- [ ] Clear migration path for existing users
- [ ] All existing tests pass without modification

**Tasks**:
- [ ] Run existing test suite
- [ ] Add tests for legacy environment variable mode
- [ ] Document migration guide
- [ ] Create migration script/helper
- [ ] Test with real Claude Desktop configuration

---

## Epic 4: New Repository Management Tools 🆕

**Priority**: MEDIUM | **Sprint**: 3

### Story 4.1: List Repositories Tool
**Points**: 3 | **Priority**: P2

**Description**: Implement MCP tool to list all configured repositories.

**Acceptance Criteria**:
- [ ] Return list of all repositories
- [ ] Include display name, URL, description
- [ ] Show masked API keys
- [ ] Indicate which is default
- [ ] Option to include disabled repositories
- [ ] Return JSON format compatible with MCP

**Tool Schema**:
```typescript
{
  name: "redmine_list_repositories",
  description: "List all configured Redmine repositories",
  inputSchema: {
    type: "object",
    properties: {
      include_disabled: {
        type: "boolean",
        description: "Include disabled repositories (default: false)"
      }
    }
  }
}
```

**Tasks**:
- [ ] Implement tool handler
- [ ] Add tool schema to ListToolsRequest
- [ ] Write tool tests
- [ ] Document tool usage

---

### Story 4.2: Get Default Repository Tool
**Points**: 2 | **Priority**: P2

**Description**: Implement MCP tool to get the current default repository.

**Acceptance Criteria**:
- [ ] Return current default repository configuration
- [ ] Mask API key in response
- [ ] Include all repository metadata
- [ ] Handle case when no default is set

**Tool Schema**:
```typescript
{
  name: "redmine_get_default_repository",
  description: "Get the currently configured default Redmine repository",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
```

**Tasks**:
- [ ] Implement tool handler
- [ ] Add tool schema
- [ ] Write tool tests
- [ ] Document tool usage

---

### Story 4.3: Set Default Repository Tool
**Points**: 3 | **Priority**: P2

**Description**: Implement MCP tool to change the default repository.

**Acceptance Criteria**:
- [ ] Set new default repository by ID
- [ ] Validate repository exists
- [ ] Validate repository is enabled
- [ ] Persist change to configuration file
- [ ] Return success confirmation

**Tool Schema**:
```typescript
{
  name: "redmine_set_default_repository",
  description: "Change the default Redmine repository",
  inputSchema: {
    type: "object",
    properties: {
      repository_id: {
        type: "string",
        description: "ID of the repository to set as default"
      }
    },
    required: ["repository_id"]
  }
}
```

**Tasks**:
- [ ] Implement tool handler
- [ ] Add validation logic
- [ ] Add configuration persistence
- [ ] Write tool tests
- [ ] Document tool usage

---

### Story 4.4: Get Repository Details Tool
**Points**: 2 | **Priority**: P2

**Description**: Implement MCP tool to get detailed information about a specific repository.

**Acceptance Criteria**:
- [ ] Return full repository configuration
- [ ] Mask API key in response
- [ ] Include defaults and metadata
- [ ] Handle repository not found

**Tool Schema**:
```typescript
{
  name: "redmine_get_repository",
  description: "Get detailed information about a specific Redmine repository",
  inputSchema: {
    type: "object",
    properties: {
      repository_id: {
        type: "string",
        description: "ID of the repository to query"
      }
    },
    required: ["repository_id"]
  }
}
```

**Tasks**:
- [ ] Implement tool handler
- [ ] Add tool schema
- [ ] Write tool tests
- [ ] Document tool usage

---

### Story 4.5: Update Repository Defaults Tool
**Points**: 3 | **Priority**: P3

**Description**: Implement MCP tool to update default values for a repository.

**Acceptance Criteria**:
- [ ] Update repository default settings
- [ ] Validate all provided values
- [ ] Persist changes to configuration
- [ ] Return updated configuration
- [ ] Support partial updates

**Tool Schema**:
```typescript
{
  name: "redmine_update_repository_defaults",
  description: "Update default values for a Redmine repository",
  inputSchema: {
    type: "object",
    properties: {
      repository_id: { type: "string" },
      defaults: {
        type: "object",
        properties: {
          projectId: { type: "number" },
          trackerId: { type: "number" },
          statusId: { type: "number" },
          priorityId: { type: "number" },
          assignedToId: { type: "number" }
        }
      }
    },
    required: ["repository_id", "defaults"]
  }
}
```

**Tasks**:
- [ ] Implement tool handler
- [ ] Add validation for default values
- [ ] Add configuration persistence
- [ ] Write tool tests
- [ ] Document tool usage

---

### Story 4.6: Test Repository Connection Tool
**Points**: 3 | **Priority**: P2

**Description**: Implement MCP tool to test connectivity and authentication for a repository.

**Acceptance Criteria**:
- [ ] Test connection to specified repository
- [ ] Return success/failure status
- [ ] Include response time
- [ ] Show Redmine server version if available
- [ ] Provide clear error messages
- [ ] Redact API keys from responses

**Tool Schema**:
```typescript
{
  name: "redmine_test_repository_connection",
  description: "Test connectivity and authentication for a Redmine repository",
  inputSchema: {
    type: "object",
    properties: {
      repository_id: {
        type: "string",
        description: "ID of the repository to test"
      }
    },
    required: ["repository_id"]
  }
}
```

**Tasks**:
- [ ] Implement tool handler
- [ ] Add actual connection testing
- [ ] Add timeout handling
- [ ] Write tool tests with mock server
- [ ] Document tool usage

---

## Epic 5: Documentation & Examples 📖

**Priority**: MEDIUM | **Sprint**: 3-4

### Story 5.1: Update README.md
**Points**: 5 | **Priority**: P2

**Description**: Update main README with multi-repository configuration instructions.

**Acceptance Criteria**:
- [ ] Add security best practices section
- [ ] Document environment variable reference pattern
- [ ] Provide configuration file examples
- [ ] Explain priority order for config files
- [ ] Add troubleshooting section
- [ ] Include migration guide from single to multi-repo

**Tasks**:
- [ ] Write security section
- [ ] Add configuration examples
- [ ] Create quick start guide
- [ ] Add troubleshooting FAQ
- [ ] Document all new tools

---

### Story 5.2: Create Setup Guides
**Points**: 3 | **Priority**: P2

**Description**: Create detailed setup guides for various deployment scenarios.

**Acceptance Criteria**:
- [ ] Local development setup guide
- [ ] Docker deployment guide
- [ ] Claude Desktop integration guide
- [ ] CI/CD setup guide
- [ ] Each guide includes security considerations

**Tasks**:
- [ ] Create `docs/SETUP_LOCAL.md`
- [ ] Create `docs/SETUP_DOCKER.md`
- [ ] Create `docs/SETUP_CLAUDE_DESKTOP.md`
- [ ] Create `docs/SETUP_CICD.md`
- [ ] Review and test all guides

---

### Story 5.3: Configuration File Templates
**Points**: 2 | **Priority**: P2

**Description**: Create comprehensive configuration file templates.

**Acceptance Criteria**:
- [ ] Minimal configuration example
- [ ] Multi-environment configuration example
- [ ] Future-ready configuration with secrets managers
- [ ] Well-commented templates
- [ ] All templates use environment variable references

**Tasks**:
- [ ] Create `redmine-repositories.example.json`
- [ ] Create `.env.example`
- [ ] Add inline comments explaining each field
- [ ] Create example for each use case
- [ ] Validate all examples

---

### Story 5.4: Migration Guide
**Points**: 3 | **Priority**: P2

**Description**: Create comprehensive migration guide for existing users.

**Acceptance Criteria**:
- [ ] Step-by-step migration instructions
- [ ] Before/after comparison
- [ ] Rollback instructions
- [ ] Troubleshooting common issues
- [ ] Validation checklist

**Tasks**:
- [ ] Create `docs/MIGRATION_GUIDE.md`
- [ ] Document environment variable to config file migration
- [ ] Provide migration script or commands
- [ ] Add validation steps
- [ ] Include common pitfalls

---

### Story 5.5: API Documentation
**Points**: 3 | **Priority**: P3

**Description**: Generate comprehensive API documentation for new functionality.

**Acceptance Criteria**:
- [ ] Document all public interfaces
- [ ] Include code examples
- [ ] Document error conditions
- [ ] Add TypeScript type definitions
- [ ] Generate JSDoc documentation

**Tasks**:
- [ ] Add JSDoc comments to all public methods
- [ ] Generate API documentation
- [ ] Create code examples
- [ ] Document error codes and messages
- [ ] Set up documentation site (optional)

---

## Epic 6: Testing & Quality Assurance ✅

**Priority**: HIGH | **Sprint**: 2-4

### Story 6.1: Unit Tests - SecretsResolver
**Points**: 3 | **Priority**: P1

**Description**: Comprehensive unit tests for secrets resolution functionality.

**Acceptance Criteria**:
- [ ] 100% code coverage
- [ ] Test all environment variable patterns
- [ ] Test validation logic
- [ ] Test masking functionality
- [ ] Test error conditions
- [ ] Test edge cases

**Tasks**:
- [ ] Write tests for `resolve()` method
- [ ] Write tests for `validate()` method
- [ ] Write tests for `mask()` method
- [ ] Write tests for `redactFromText()` method
- [ ] Test error handling
- [ ] Run coverage report

---

### Story 6.2: Unit Tests - Repository Manager
**Points**: 5 | **Priority**: P1

**Description**: Comprehensive unit tests for repository manager functionality.

**Acceptance Criteria**:
- [ ] 90%+ code coverage
- [ ] Test configuration loading from all sources
- [ ] Test priority order
- [ ] Test API key resolution
- [ ] Test caching mechanism
- [ ] Test error handling

**Tasks**:
- [ ] Write tests for config loading
- [ ] Write tests for repository CRUD operations
- [ ] Write tests for default repository management
- [ ] Write tests for validation
- [ ] Mock file system operations
- [ ] Mock environment variables

---

### Story 6.3: Integration Tests - Multi-Repository
**Points**: 5 | **Priority**: P1

**Description**: End-to-end integration tests for multi-repository scenarios.

**Acceptance Criteria**:
- [ ] Test switching between repositories
- [ ] Test concurrent access to multiple repositories
- [ ] Test with real configuration files
- [ ] Test backward compatibility mode
- [ ] Test error scenarios

**Tasks**:
- [ ] Set up test fixtures
- [ ] Create mock Redmine server
- [ ] Write multi-repository workflow tests
- [ ] Test environment variable resolution
- [ ] Test configuration file priority
- [ ] Test error conditions

---

### Story 6.4: Integration Tests - Tools
**Points**: 5 | **Priority**: P1

**Description**: Integration tests for all MCP tools with repository_id parameter.

**Acceptance Criteria**:
- [ ] Test each tool with explicit repository_id
- [ ] Test each tool without repository_id (default)
- [ ] Test with invalid repository_id
- [ ] Test with disabled repository
- [ ] Verify API key masking in responses

**Tasks**:
- [ ] Update existing tool tests
- [ ] Add multi-repository test cases
- [ ] Test error conditions
- [ ] Verify backward compatibility
- [ ] Test with mock MCP client

---

### Story 6.5: Security Testing
**Points**: 5 | **Priority**: P1

**Description**: Security-focused testing to ensure no secret leakage.

**Acceptance Criteria**:
- [ ] Verify no secrets in logs
- [ ] Verify no secrets in error messages
- [ ] Verify no secrets in stack traces
- [ ] Verify API key validation works
- [ ] Verify masking works correctly
- [ ] Scan for hardcoded secrets

**Tasks**:
- [ ] Run git-secrets or similar tool
- [ ] Review all log outputs
- [ ] Review all error messages
- [ ] Test with intentionally invalid keys
- [ ] Verify redaction in all code paths
- [ ] Document security test results

---

### Story 6.6: Performance Testing
**Points**: 3 | **Priority**: P3

**Description**: Performance tests for configuration loading and API key resolution.

**Acceptance Criteria**:
- [ ] Config loading under 100ms
- [ ] API key resolution cached efficiently
- [ ] No performance regression vs. single repository
- [ ] Memory usage reasonable with many repositories
- [ ] Concurrent access performs well

**Tasks**:
- [ ] Write performance benchmarks
- [ ] Test with 10+ repositories
- [ ] Test concurrent access patterns
- [ ] Profile memory usage
- [ ] Document performance characteristics

---

## Epic 7: Deployment & DevOps 🚀

**Priority**: MEDIUM | **Sprint**: 4

### Story 7.1: Docker Support
**Points**: 3 | **Priority**: P2

**Description**: Add Docker support with secure secret management.

**Acceptance Criteria**:
- [ ] Update Dockerfile
- [ ] Create docker-compose.yml example
- [ ] Support environment variables in containers
- [ ] Document secret injection methods
- [ ] Support Docker secrets

**Tasks**:
- [ ] Update Dockerfile to copy example configs
- [ ] Create docker-compose.yml
- [ ] Add docker-compose.prod.yml example
- [ ] Document Docker deployment
- [ ] Test Docker builds

---

### Story 7.2: Claude Desktop Integration
**Points**: 3 | **Priority**: P2

**Description**: Document and test Claude Desktop integration with multi-repository support.

**Acceptance Criteria**:
- [ ] Update claude_desktop_config.json example
- [ ] Document environment variable setup
- [ ] Test with real Claude Desktop
- [ ] Provide troubleshooting guide
- [ ] Include screenshots/examples

**Tasks**:
- [ ] Create example config for Claude Desktop
- [ ] Test configuration loading
- [ ] Document setup process
- [ ] Create troubleshooting guide
- [ ] Update existing Claude Desktop docs

---

### Story 7.3: CI/CD Pipeline Updates
**Points**: 3 | **Priority**: P3

**Description**: Update CI/CD pipelines to support multi-repository testing.

**Acceptance Criteria**:
- [ ] Add secret scanning to CI
- [ ] Test with multiple repository configurations
- [ ] Validate security requirements in CI
- [ ] Add integration tests to pipeline
- [ ] Document CI/CD setup

**Tasks**:
- [ ] Add git-secrets or similar to CI
- [ ] Add security validation steps
- [ ] Update test scripts
- [ ] Document CI/CD requirements
- [ ] Test pipeline with multi-repo configs

---

## Epic 8: Future Enhancements (Backlog) 🔮

**Priority**: LOW | **Sprint**: Future

### Story 8.1: AWS Secrets Manager Integration
**Points**: 8 | **Priority**: P4

**Description**: Implement AWS Secrets Manager as a secret source.

**Tasks**:
- [ ] Design AWS integration architecture
- [ ] Implement AWS SDK integration
- [ ] Add AWS authentication
- [ ] Update configuration schema
- [ ] Write integration tests
- [ ] Document AWS setup

---

### Story 8.2: HashiCorp Vault Integration
**Points**: 8 | **Priority**: P4

**Description**: Implement HashiCorp Vault as a secret source.

**Tasks**:
- [ ] Design Vault integration architecture
- [ ] Implement Vault SDK integration
- [ ] Add Vault authentication
- [ ] Update configuration schema
- [ ] Write integration tests
- [ ] Document Vault setup

---

### Story 8.3: API Key Rotation Support
**Points**: 8 | **Priority**: P4

**Description**: Implement automatic API key rotation support.

**Tasks**:
- [ ] Design rotation architecture
- [ ] Implement rotation logic
- [ ] Add grace period support
- [ ] Add expiration warnings
- [ ] Write tests
- [ ] Document rotation process

---

## Definition of Done

A story is considered "Done" when:

- [ ] All acceptance criteria are met
- [ ] Code is written and reviewed
- [ ] Unit tests written and passing (90%+ coverage)
- [ ] Integration tests written and passing (where applicable)
- [ ] Documentation updated
- [ ] Security review completed
- [ ] No secrets exposed in code or logs
- [ ] Performance is acceptable
- [ ] Changes are merged to main branch

---

## Sprint Planning Recommendations

### Sprint 1 (Security Foundation) - 24 Points
- Story 1.1: Security Foundation Setup (3)
- Story 1.2: Secrets Resolver Utility (5)
- Story 1.3: Configuration Schema & Validation (5)
- Story 1.4: Repository Manager Core (8)
- Story 6.1: Unit Tests - SecretsResolver (3)

### Sprint 2 (Core Functionality) - 26 Points
- Story 2.1: Get Repository with Resolved Secrets (3)
- Story 2.2: List Repositories (Secure) (3)
- Story 2.3: Default Repository Management (3)
- Story 2.4: Connection Testing (5)
- Story 3.1: Add Repository ID Parameter to Tools (8)
- Story 6.2: Unit Tests - Repository Manager (5)

### Sprint 3 (Tool Integration & Management) - 25 Points
- Story 3.2: Update API Request Functions (8)
- Story 3.3: Backward Compatibility Testing (5)
- Story 4.1: List Repositories Tool (3)
- Story 4.2: Get Default Repository Tool (2)
- Story 4.3: Set Default Repository Tool (3)
- Story 4.4: Get Repository Details Tool (2)
- Story 4.6: Test Repository Connection Tool (3)

### Sprint 4 (Polish & Documentation) - 29 Points
- Story 4.5: Update Repository Defaults Tool (3)
- Story 5.1: Update README.md (5)
- Story 5.2: Create Setup Guides (3)
- Story 5.3: Configuration File Templates (2)
- Story 5.4: Migration Guide (3)
- Story 6.3: Integration Tests - Multi-Repository (5)
- Story 6.4: Integration Tests - Tools (5)
- Story 6.5: Security Testing (5)
- Story 7.1: Docker Support (3)
- Story 7.2: Claude Desktop Integration (3)

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Secret leakage to Git | Critical | Medium | Automated scanning, strict .gitignore, code review |
| Breaking existing users | High | Medium | Comprehensive backward compatibility testing |
| Performance degradation | Medium | Low | Performance testing, caching strategy |
| Complex migration path | Medium | Medium | Clear documentation, migration tools |
| Environment variable conflicts | Low | Medium | Clear naming conventions, validation |

---

## Dependencies

- Node.js 18+
- TypeScript 5.0+
- Zod 3.x
- Axios 1.x
- dotenv 16.x
- @modelcontextprotocol/sdk 1.x

---

## Success Metrics

- [ ] 0 secrets committed to Git
- [ ] 90%+ test coverage
- [ ] 100% backward compatibility
- [ ] All security checks passing
- [ ] Migration completed for existing users
- [ ] Documentation completeness score: 100%
- [ ] Zero security vulnerabilities in audit
