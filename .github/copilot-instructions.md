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

## Code Quality Principles (CRITICAL)

### 1. Fail-Fast Policy (フェイルファスト方針)
**Detect and report errors immediately. Never hide problems.**

```typescript
// ✅ CORRECT: Fail fast with clear error
function getRepository(id: string): RedmineRepository {
  const repo = repositories.get(id);
  if (!repo) {
    throw new Error(
      `Repository '${id}' not found. Available: ${Array.from(repositories.keys()).join(', ')}`
    );
  }
  return repo;
}

// ❌ WRONG: Silent failure
function getRepository(id: string): RedmineRepository | undefined {
  return repositories.get(id); // Returns undefined silently
}
```

**Rules:**
- Throw errors for invalid inputs, missing configuration, or unexpected states
- Use `throw` instead of returning `undefined` or `null` for error conditions
- Validate inputs at function entry points
- Never swallow errors in catch blocks without re-throwing or proper handling

### 2. No Silent Fallback Policy (サイレントフォールバック禁止方針)
**Never use fallback values without explicit user acknowledgment.**

```typescript
// ✅ CORRECT: Explicit error with guidance
const apiKey = process.env.REDMINE_API_KEY;
if (!apiKey) {
  throw new Error(
    'REDMINE_API_KEY environment variable is required. ' +
    'Set it in your .env file or environment.'
  );
}

// ❌ WRONG: Silent fallback
const apiKey = process.env.REDMINE_API_KEY || 'default-key'; // Dangerous!

// ✅ ACCEPTABLE: Explicit fallback with warning
const timeout = process.env.REQUEST_TIMEOUT 
  ? parseInt(process.env.REQUEST_TIMEOUT) 
  : 5000;
console.warn(`[Config] REQUEST_TIMEOUT not set, using default: ${timeout}ms`);
```

**Rules:**
- No default values for critical configuration (API keys, URLs)
- Fallbacks for optional settings must be logged with `console.warn`
- User must be informed when fallback behavior is triggered
- Document all fallback behavior in error messages

### 3. No Backward Compatibility by Default (後方互換は基本無考慮方針)
**Focus on current requirements. Add compatibility only when explicitly needed.**

```typescript
// ✅ CORRECT: Clean current implementation
interface RedmineConfig {
  configVersion: string;
  repositories: RedmineRepository[];
}

// ❌ WRONG: Premature compatibility code
interface RedmineConfig {
  configVersion: string;
  repositories: RedmineRepository[];
  // Legacy support for old format (not needed yet!)
  legacyUrl?: string;
  legacyApiKey?: string;
}
```

**Rules:**
- Design for current requirements only
- Add compatibility code when migration is actually needed
- When backward compatibility is required (e.g., legacy env vars), document it clearly
- Remove deprecated compatibility code after migration period

**Exception:** Current project requires legacy environment variable support (`REDMINE_URL`, `REDMINE_API_KEY`) as explicitly documented. This is intentional compatibility, not accidental complexity.

### 4. Linting Policy (Lint方針)
**Zero tolerance for lint errors. Warnings must be addressed or justified.**

```typescript
// ✅ CORRECT: Clean code passing all lint rules
async function fetchIssue(id: number): Promise<RedmineIssue> {
  const response = await axios.get(`/issues/${id}.json`);
  return response.data.issue;
}

// ❌ WRONG: Disabling lints without justification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchIssue(id: any): Promise<any> { // Bad!
  const response = await axios.get(`/issues/${id}.json`);
  return response.data.issue;
}
```

**Rules:**
- `npm run lint` must pass with zero errors and zero warnings
- Never commit code with lint errors
- Lint warnings must be fixed before PR merge
- Use `eslint-disable` only with explicit justification (see Policy #8)
- Configure ESLint with strict rules:
  - `@typescript-eslint/no-explicit-any`: error
  - `@typescript-eslint/explicit-function-return-type`: warn
  - `@typescript-eslint/no-unused-vars`: error
  - `no-console`: off (we use console for MCP server logging)

### 5. Complexity Suppression Policy (複雑度の抑制方針)
**Keep functions simple. Extract complex logic into smaller units.**

```typescript
// ✅ CORRECT: Low complexity, clear logic
function validateApiKey(key: string): ValidationResult {
  if (key.length < 16) {
    return { valid: false, error: 'API key too short (min 16 chars)' };
  }
  if (PLACEHOLDER_PATTERNS.some(p => p.test(key))) {
    return { valid: false, error: 'API key appears to be placeholder' };
  }
  return { valid: true };
}

// ❌ WRONG: High complexity, nested conditions
function processConfig(config: any): ProcessedConfig {
  if (config) {
    if (config.repositories) {
      if (Array.isArray(config.repositories)) {
        for (const repo of config.repositories) {
          if (repo.apiKey) {
            if (repo.apiKey.startsWith('${')) {
              // ... 10 more levels of nesting
            }
          }
        }
      }
    }
  }
  // What are we even doing here?
}
```

**Rules:**
- Maximum cyclomatic complexity: 10 per function
- Maximum nesting depth: 3 levels
- Functions longer than 50 lines should be refactored
- Use early returns to reduce nesting
- Extract complex conditions into named helper functions

**Measurement:**
```bash
# Install complexity checker
npm install --save-dev eslint-plugin-complexity

# Add to .eslintrc.json
{
  "rules": {
    "complexity": ["error", 10],
    "max-depth": ["error", 3],
    "max-lines-per-function": ["warn", 50]
  }
}
```

### 6. Early Code Clone Elimination (コードクローンの早期排除方針)
**Eliminate duplication immediately. Extract common logic before second repetition.**

```typescript
// ✅ CORRECT: Extract common pattern
function fetchFromRedmine<T>(
  repository: RedmineRepository, 
  endpoint: string
): Promise<T> {
  return axios.get(`${repository.url}${endpoint}`, {
    headers: { 'X-Redmine-API-Key': repository.apiKey }
  }).then(res => res.data);
}

// Use for all endpoints
const issues = await fetchFromRedmine<IssuesResponse>(repo, '/issues.json');
const projects = await fetchFromRedmine<ProjectsResponse>(repo, '/projects.json');

// ❌ WRONG: Repeated code
async function fetchIssues(repo: RedmineRepository) {
  return axios.get(`${repo.url}/issues.json`, {
    headers: { 'X-Redmine-API-Key': repo.apiKey }
  }).then(res => res.data);
}

async function fetchProjects(repo: RedmineRepository) {
  return axios.get(`${repo.url}/projects.json`, {
    headers: { 'X-Redmine-API-Key': repo.apiKey }
  }).then(res => res.data);
}
// This is code duplication!
```

**Rules:**
- **One Strike Rule**: First time is implementation, second time is duplication - extract it
- No copy-paste programming - extract into function/class
- Use generics to handle similar patterns with different types
- Share validation logic through common schemas
- Maximum of 5 lines of duplicate code allowed anywhere in codebase

**Detection:**
```bash
# Install duplication detector
npm install --save-dev jscpd

# Run duplication check
npx jscpd src/
```

### 7. No Type Assertion Hacks (as unknown as 禁止方針)
**Never use `as unknown as` to bypass type checking. Fix the types properly.**

```typescript
// ✅ CORRECT: Proper type handling
interface ApiResponse<T> {
  data: T;
  status: number;
}

function parseResponse<T>(response: unknown): ApiResponse<T> {
  // Validate at runtime
  if (!isObject(response)) {
    throw new Error('Invalid response: not an object');
  }
  if (!('data' in response) || !('status' in response)) {
    throw new Error('Invalid response: missing required fields');
  }
  return response as ApiResponse<T>; // Safe assertion after validation
}

// ❌ WRONG: Type assertion hack
const response = apiCall() as unknown as ApiResponse<User>; // Dangerous!

// ❌ WRONG: Bypassing type system
const config: RedmineConfig = JSON.parse(fileContent) as unknown as RedmineConfig;
// Use Zod validation instead!
```

**Rules:**
- **NEVER** use `as unknown as Type` - it's a code smell
- Use type guards (`is` predicates) for runtime validation
- Use Zod schemas for parsing untrusted data
- If you think you need `as unknown as`, you have a design problem - fix it
- Single `as` assertions are acceptable only after runtime validation

**Proper Pattern:**
```typescript
// Define type guard
function isRedmineConfig(value: unknown): value is RedmineConfig {
  return (
    isObject(value) &&
    'configVersion' in value &&
    'repositories' in value
  );
}

// Or use Zod (preferred)
const config = RedmineConfigSchema.parse(JSON.parse(fileContent));
```

### 8. Explicit Consent for Suppression (Lint抑制などは明示同意方針)
**Never suppress warnings/errors without documented justification.**

```typescript
// ✅ CORRECT: Justified suppression with clear comment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseUnknownApiResponse(response: any): RedmineIssue {
  // Justification: Third-party Redmine API returns untyped JSON.
  // We validate with Zod schema immediately below.
  return RedmineIssueSchema.parse(response);
}

// ❌ WRONG: Suppression without explanation
// eslint-disable-next-line
function doSomething(data: any) { // Why is this suppressed?
  return data.value;
}

// ❌ WRONG: File-level suppression
/* eslint-disable @typescript-eslint/no-explicit-any */
// ... entire file ... // Too broad!
```

**Rules:**
- Every lint suppression requires a comment explaining WHY
- Comment must be on the line immediately before suppression
- Format: `// Justification: [specific reason]`
- Suppressions must be reviewed in code review
- Prefer fixing the issue over suppressing
- File-level suppressions are prohibited
- No `@ts-ignore` or `@ts-expect-error` without justification

**Acceptable Justifications:**
- "Third-party library has incorrect types"
- "Runtime validation via Zod schema follows"
- "Performance-critical code with verified safety"
- "Temporary workaround for [issue-link]"

**Unacceptable Justifications:**
- "Too hard to fix"
- "It works"
- "Legacy code"
- No comment at all

---

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
