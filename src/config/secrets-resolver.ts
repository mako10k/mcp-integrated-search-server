/**
 * Secrets Resolver Utility
 * 
 * Handles secure resolution and validation of API keys and other secrets.
 * Supports environment variable references with ${VAR_NAME} syntax.
 * 
 * Security Features:
 * - Resolves ${VAR_NAME} references from environment variables
 * - Validates API key format and detects placeholders
 * - Masks secrets for logging (shows only first 4 characters)
 * - Redacts secrets from error messages
 */

/**
 * Validation result for API keys
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Patterns that indicate placeholder or example API keys
 */
const PLACEHOLDER_PATTERNS = [
  /^your[_-]?/i,
  /^example[_-]?/i,
  /^test[_-]?/i,
  /^dummy[_-]?/i,
  /^placeholder/i,
  /^x{3,}/i,
  /^changeme/i,
  /^replace[_-]?me/i,
  /<[^>]+>/,  // <your_key_here>
  /\[.*\]/,   // [your_key_here]
  // Note: unresolved ${VAR} is checked separately for clearer error message
];

export class SecretsResolver {
  /**
   * Resolve environment variable references in format ${VAR_NAME}
   * 
   * @param value - String that may contain ${VAR_NAME} patterns
   * @returns Resolved string with environment variables substituted
   * @throws Error if referenced environment variable is not defined
   * 
   * @example
   * // With REDMINE_API_KEY=abc123 in environment
   * SecretsResolver.resolve('${REDMINE_API_KEY}') // Returns: 'abc123'
   * SecretsResolver.resolve('prefix-${API_KEY}-suffix') // Returns: 'prefix-xyz789-suffix'
   */
  static resolve(value: string): string {
    if (!value) {
      throw new Error('Cannot resolve empty value');
    }

    // Pattern to match ${VAR_NAME}
    const pattern = /\$\{([^}]+)\}/g;
    const matches = value.match(pattern);

    if (!matches) {
      // No environment variable references, return as-is
      return value;
    }

    let resolved = value;
    const missingVars: string[] = [];

    // Replace all ${VAR_NAME} with actual values
    resolved = value.replace(pattern, (match, varName) => {
      const envValue = process.env[varName];
      
      if (envValue === undefined) {
        missingVars.push(varName);
        return match; // Keep original if not found
      }
      
      return envValue;
    });

    if (missingVars.length > 0) {
      throw new Error(
        `Environment variable(s) not defined: ${missingVars.join(', ')}. ` +
        `Set them in your .env file or environment.`
      );
    }

    return resolved;
  }

  /**
   * Validate API key format and detect placeholder values
   * 
   * @param apiKey - API key to validate
   * @returns Validation result with error message if invalid
   * 
   * @example
   * SecretsResolver.validate('abc123def456789') // { valid: true }
   * SecretsResolver.validate('your_key_here') // { valid: false, error: '...' }
   * SecretsResolver.validate('short') // { valid: false, error: '...' }
   */
  static validate(apiKey: string): ValidationResult {
    // Check minimum length
    if (apiKey.length < 16) {
      return {
        valid: false,
        error: `API key too short (${apiKey.length} chars, minimum 16 required)`
      };
    }

    // Check for unresolved environment variable references first
    if (apiKey.includes('${')) {
      return {
        valid: false,
        error: 'API key contains unresolved environment variable reference. Ensure all referenced variables are defined.'
      };
    }

    // Check for placeholder patterns
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(apiKey)) {
        return {
          valid: false,
          error: 'API key appears to be a placeholder or example value. ' +
                 'Replace it with your actual API key.'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Mask API key for safe logging
   * Shows only the first 4 characters followed by asterisks
   * 
   * @param apiKey - API key to mask
   * @returns Masked API key safe for logging
   * 
   * @example
   * SecretsResolver.mask('abc123def456789') // Returns: 'abc1***'
   * SecretsResolver.mask('short') // Returns: '****'
   */
  static mask(apiKey: string): string {
    if (!apiKey) {
      return '****';
    }

    if (apiKey.length <= 4) {
      return '****';
    }

    return apiKey.substring(0, 4) + '***';
  }

  /**
   * Redact secrets from error messages and logs
   * Replaces any occurrence of the secret with masked version
   * 
   * @param text - Text that may contain secrets
   * @param secrets - Array of secret strings to redact
   * @returns Text with secrets replaced by masked versions
   * 
   * @example
   * const apiKey = 'abc123def456';
   * const error = `Failed to connect with key: ${apiKey}`;
   * SecretsResolver.redactFromText(error, [apiKey])
   * // Returns: 'Failed to connect with key: abc1***'
   */
  static redactFromText(text: string, secrets: string[]): string {
    if (!text || secrets.length === 0) {
      return text;
    }

    let redacted = text;

    for (const secret of secrets) {
      if (!secret || secret.length === 0) {
        continue;
      }

      // Escape special regex characters in the secret
      const escapedSecret = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedSecret, 'g');
      
      redacted = redacted.replace(regex, this.mask(secret));
    }

    return redacted;
  }

  /**
   * Resolve and validate API key in one operation
   * Convenience method combining resolve() and validate()
   * 
   * @param value - String that may contain ${VAR_NAME} pattern
   * @returns Resolved and validated API key
   * @throws Error if resolution fails or validation fails
   * 
   * @example
   * SecretsResolver.resolveAndValidate('${REDMINE_API_KEY}')
   * // Returns API key if valid, throws error otherwise
   */
  static resolveAndValidate(value: string): string {
    const resolved = this.resolve(value);
    const validation = this.validate(resolved);

    if (!validation.valid) {
      throw new Error(`Invalid API key: ${validation.error}`);
    }

    return resolved;
  }
}
