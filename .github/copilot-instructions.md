# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a Model Context Protocol (MCP) server project for Google Custom Search and Multi-Redmine Repository integration.

You can find more info and examples at https://modelcontextprotocol.io/llms-full.txt

## Project Overview

This project implements:
1. Google Custom Search API integration
2. Multi-repository Redmine API integration with secure secret management
3. MCP server for AI assistant integration (Claude, etc.)

## Architecture & Design Documents

**READ THESE FIRST** when working on multi-Redmine features:
- Design Document: `docs/MULTI_REDMINE_DESIGN.md`
- Product Backlog: `docs/PRODUCT_BACKLOG.md`
- Implementation Guide: `docs/IMPLEMENTATION_GUIDE.md`

## Core Technologies

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 18+
- **Framework**: Model Context Protocol (MCP) SDK
- **Validation**: Zod schemas
- **HTTP Client**: Axios
- **Environment**: dotenv for configuration

## Code Style & Standards

### TypeScript Guidelines

1. **Strict Type Safety**
   - Enable all strict TypeScript compiler options
   - Avoid `any` types - use proper interfaces or `unknown`
   - Define explicit return types for all functions
   - Use TypeScript 5.0+ features appropriately

2. **Interface Naming**
   - Interface names should be descriptive: `RedmineRepository`, `ConnectionTestResult`
   - No `I` prefix (bad: `IRepository`, good: `Repository`)
   - Use `type` for unions/aliases, `interface` for object shapes

3. **File Organization**
   ```
   src/
     config/          # Configuration management
       types.ts       # Type definitions
       schemas.ts     # Zod validation schemas
       secrets-resolver.ts
       redmine-repository-manager.ts
     index.ts         # Main MCP server entry point
   ```

### Security-First Development (CRITICAL)

**2025 Best Practices - NEVER compromise on these:**

1. **No Secrets in Code**
   - ❌ NEVER hardcode API keys, passwords, or tokens
   - ❌ NEVER commit `.env` files to Git
   - ✅ ALWAYS use `${VARIABLE_NAME}` references in config files
   - ✅ ALWAYS add secret files to `.gitignore`

2. **Environment Variable Pattern**
   ```typescript
   // ✅ CORRECT: Use environment variable references
   {
     "apiKey": "${REDMINE_MAIN_API_KEY}"
   }
   
   // ❌ WRONG: Hardcoded secrets
   {
     "apiKey": "abc123def456"
   }
   ```

3. **API Key Masking**
   - Always mask API keys in logs: show first 4 chars only
   - Use `SecretsResolver.mask()` for all logging
   - Redact secrets from error messages with `SecretsResolver.redactFromText()`

4. **Validation Requirements**
   - Validate API key format (min 16 chars)
   - Detect placeholder values ("your_key", "example", etc.)
   - Check for unresolved environment variable references

### Error Handling

1. **Descriptive Errors**
   ```typescript
   throw new Error(
     `Repository '${id}' not found. Available: ${availableIds.join(', ')}`
   );
   ```

2. **Error Context**
   - Include what went wrong
   - Include what was attempted
   - Suggest how to fix it
   - NEVER expose secrets in error messages

3. **Async Error Handling**
   ```typescript
   try {
     const result = await someAsyncOperation();
   } catch (error: any) {
     const safeMessage = SecretsResolver.redactFromText(
       error.message, 
       [apiKey]
     );
     throw new Error(`Operation failed: ${safeMessage}`);
   }
   ```

### Testing Standards

1. **Unit Tests Required**
   - 90%+ code coverage for new code
   - Use Jest with TypeScript
   - Test both success and failure paths
   - Mock external dependencies (filesystem, network)

2. **Test Naming**
   ```typescript
   describe('SecretsResolver', () => {
     describe('resolve', () => {
       it('should resolve single environment variable', () => {
         // test implementation
       });
       
       it('should throw error for undefined variable', () => {
         // test implementation
       });
     });
   });
   ```

3. **Security Tests**
   - Verify no secrets in logs
   - Verify masking works correctly
   - Test error message redaction

### Configuration Management

1. **Priority Order** (when loading config):
   1. `REDMINE_CONFIG_PATH` env var
   2. `./redmine-repositories.local.json` (gitignored)
   3. `./redmine-repositories.json` (Git committed, uses ${VAR})
   4. `~/.mcp-integrated-search/redmine-repositories.json`
   5. Generate from legacy environment variables

2. **Config File Structure**
   ```json
   {
     "configVersion": "1.0",
     "defaultRepositoryId": "main",
     "repositories": [{
       "id": "main",
       "displayName": "Main Server",
       "url": "https://redmine.example.com",
       "apiKey": "${REDMINE_MAIN_API_KEY}",
       "secretSource": "environment",
       "enabled": true
     }]
   }
   ```

### Zod Schema Patterns

```typescript
// Always validate with clear error messages
const schema = z.object({
  id: z.string()
    .min(1, 'ID is required')
    .regex(/^[a-z0-9-_]+$/, 'ID must be lowercase alphanumeric'),
  
  url: z.string()
    .url('Invalid URL format')
    .refine(url => !url.endsWith('/'), 'URL should not end with slash'),
});

// Use .safeParse() for user input, .parse() for internal
const result = schema.safeParse(input);
if (!result.success) {
  // Handle validation error
}
```

### Logging Standards

1. **Log Levels**
   - `console.log`: Regular info (with `[Component]` prefix)
   - `console.warn`: Warnings and fallback behavior
   - `console.error`: Errors (with masked secrets)

2. **Log Format**
   ```typescript
   console.log(`[RedmineRepositoryManager] Loading config from: ${path}`);
   console.log(`[SecretsResolver] API key resolved: ${SecretsResolver.mask(key)}`);
   console.error(`[Component] Operation failed:`, safeErrorMessage);
   ```

### Documentation

1. **JSDoc for Public APIs**
   ```typescript
   /**
    * Resolve environment variable references in format ${VAR_NAME}
    * @param value - String that may contain ${VAR_NAME} patterns
    * @returns Resolved string with environment variables substituted
    * @throws Error if referenced environment variable is not defined
    */
   static resolve(value: string): string {
     // implementation
   }
   ```

2. **README Updates**
   - Update README.md when adding new features
   - Include setup instructions
   - Provide configuration examples
   - Document all environment variables

## Multi-Redmine Implementation

### Current Sprint: Sprint 1 - Security Foundation

**Active Stories** (follow IMPLEMENTATION_GUIDE.md):
1. Story 1.1: Security Foundation Setup ✅
2. Story 1.2: Secrets Resolver Utility (IN PROGRESS)
3. Story 1.3: Configuration Schema & Validation (TODO)
4. Story 1.4: Repository Manager Core (TODO)

### Key Implementation Rules

1. **Backward Compatibility**
   - All existing tools must continue to work
   - Support legacy `REDMINE_URL` and `REDMINE_API_KEY` env vars
   - Default to default repository when `repository_id` not specified

2. **New Tool Parameter**
   - Add optional `repository_id?: string` to all Redmine tools
   - Validate repository exists and is enabled
   - Use `RedmineRepositoryManager.getRepository()` to resolve config

3. **API Key Resolution**
   - Never pass raw config to API calls
   - Always resolve through `RedmineRepositoryManager`
   - Cache resolved keys for performance
   - Clear cache when needed

### File Structure for Multi-Redmine

```
src/
  config/
    types.ts                    # TypeScript interfaces
    schemas.ts                  # Zod validation schemas  
    secrets-resolver.ts         # Secret handling utilities
    redmine-repository-manager.ts  # Core config manager
  index.ts                      # MCP server (update tool handlers)

.github/
  copilot-instructions.md      # This file

docs/
  MULTI_REDMINE_DESIGN.md      # Architecture and design
  PRODUCT_BACKLOG.md           # Sprint planning
  IMPLEMENTATION_GUIDE.md      # Step-by-step guide

# Configuration files (examples committed to Git)
.env.example                   # Environment variable template
redmine-repositories.example.json  # Config template

# Configuration files (NEVER commit these)
.env                           # Actual secrets
*.local.json                   # Local overrides
```

## Common Tasks & Patterns

### Adding a New Redmine Tool

1. Define input schema with Zod (include optional `repository_id`)
2. Add tool to `ListToolsRequestSchema` handler
3. Implement tool handler with repository resolution
4. Write unit tests
5. Update documentation

### Resolving Repository Configuration

```typescript
// In tool handler
const repoManager = new RedmineRepositoryManager();
const repository = await repoManager.getRepository(
  params.repository_id || undefined
);

if (!repository) {
  throw new McpError(
    ErrorCode.InvalidRequest,
    `Repository '${params.repository_id}' not found or disabled`
  );
}

// Use repository.url and repository.apiKey for API calls
```

### Working with Secrets

```typescript
// ✅ ALWAYS resolve and validate
const apiKey = SecretsResolver.resolve(configValue);
const validation = SecretsResolver.validate(apiKey);
if (!validation.valid) {
  throw new Error(`Invalid API key: ${validation.error}`);
}

// ✅ ALWAYS mask in logs
console.log(`Using API key: ${SecretsResolver.mask(apiKey)}`);

// ✅ ALWAYS redact from errors
catch (error: any) {
  const safe = SecretsResolver.redactFromText(error.message, [apiKey]);
  throw new Error(safe);
}
```

## Git Workflow

### Branch Strategy
- `main`: Production-ready code
- `feature/sprint-N-description`: Feature branches
- Merge to main after sprint completion

### Commit Messages
```bash
# Format: type(scope): description
feat(config): implement SecretsResolver utility
fix(auth): resolve API key masking in error logs
docs(readme): update multi-repository setup guide
test(secrets): add comprehensive validation tests
```

### Pre-Commit Checklist
- [ ] All tests pass (`npm test`)
- [ ] No secrets in code (run git-secrets scan)
- [ ] TypeScript compiles without errors
- [ ] Updated relevant documentation
- [ ] Added/updated tests for changes

## Common Pitfalls to Avoid

1. ❌ **Forgetting to mask API keys in logs**
   - Always use `SecretsResolver.mask()`

2. ❌ **Not handling missing environment variables**
   - Check and provide clear error messages

3. ❌ **Hardcoding repository IDs**
   - Use configuration, not hardcoded values

4. ❌ **Breaking backward compatibility**
   - Test with legacy env var setup

5. ❌ **Insufficient error context**
   - Include what failed, why, and how to fix

## Quick Reference

### Key Files to Read
1. `docs/MULTI_REDMINE_DESIGN.md` - Architecture
2. `docs/IMPLEMENTATION_GUIDE.md` - Step-by-step instructions
3. `docs/PRODUCT_BACKLOG.md` - Sprint planning
4. `src/config/types.ts` - Type definitions
5. `src/config/schemas.ts` - Validation rules

### Key Classes
- `SecretsResolver` - Secret handling utilities
- `RedmineRepositoryManager` - Config and repository management
- `IntegratedSearchServer` - Main MCP server class

### Environment Variables
```bash
# Google APIs
GOOGLE_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=

# Redmine (Multi-Repository)
REDMINE_MAIN_API_KEY=
REDMINE_DEV_API_KEY=
REDMINE_STAGING_API_KEY=

# Redmine (Legacy - single repository)
REDMINE_URL=
REDMINE_API_KEY=

# Configuration
REDMINE_CONFIG_PATH=  # Optional: custom config file path
LOG_LEVEL=info
```

## When in Doubt

1. Check the design document (`docs/MULTI_REDMINE_DESIGN.md`)
2. Follow the implementation guide (`docs/IMPLEMENTATION_GUIDE.md`)
3. Look at existing code patterns in `src/config/`
4. Write tests first (TDD approach)
5. Always prioritize security over convenience

## Support & Resources

- MCP Documentation: https://modelcontextprotocol.io/
- Redmine API: https://www.redmine.org/projects/redmine/wiki/Rest_api
- TypeScript: https://www.typescriptlang.org/docs/
- Zod: https://zod.dev/
