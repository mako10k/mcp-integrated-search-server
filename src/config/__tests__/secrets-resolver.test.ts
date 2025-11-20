/**
 * Unit Tests for SecretsResolver
 * 
 * Tests environment variable resolution, validation, masking, and redaction.
 */

import { SecretsResolver, ValidationResult } from '../secrets-resolver';

describe('SecretsResolver', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('resolve', () => {
    it('should resolve single environment variable', () => {
      process.env.TEST_API_KEY = 'abc123def456789';
      const result = SecretsResolver.resolve('${TEST_API_KEY}');
      expect(result).toBe('abc123def456789');
    });

    it('should resolve multiple environment variables', () => {
      process.env.PREFIX = 'pre';
      process.env.SUFFIX = 'post';
      const result = SecretsResolver.resolve('${PREFIX}-middle-${SUFFIX}');
      expect(result).toBe('pre-middle-post');
    });

    it('should return value as-is if no variable references', () => {
      const result = SecretsResolver.resolve('plain-string-value');
      expect(result).toBe('plain-string-value');
    });

    it('should throw error for undefined environment variable', () => {
      expect(() => {
        SecretsResolver.resolve('${UNDEFINED_VAR}');
      }).toThrow('Environment variable(s) not defined: UNDEFINED_VAR');
    });

    it('should throw error for multiple undefined variables', () => {
      expect(() => {
        SecretsResolver.resolve('${VAR1}-${VAR2}');
      }).toThrow(/VAR1.*VAR2/);
    });

    it('should throw error for empty value', () => {
      expect(() => {
        SecretsResolver.resolve('');
      }).toThrow('Cannot resolve empty value');
    });

    it('should handle partial resolution when some vars are missing', () => {
      process.env.EXISTING = 'exists';
      expect(() => {
        SecretsResolver.resolve('${EXISTING}-${MISSING}');
      }).toThrow('Environment variable(s) not defined: MISSING');
    });
  });

  describe('validate', () => {
    it('should accept valid API key', () => {
      const result = SecretsResolver.validate('abc123def456789012345');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject API key shorter than 16 characters', () => {
      const result = SecretsResolver.validate('short123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
      expect(result.error).toContain('8 chars');
    });

    it('should reject placeholder patterns', () => {
      const placeholders = [
        'your_api_key_here',
        'example_key_12345678',
        'test_key_1234567890',
        'dummy_api_key_12345',
        'placeholder_key_123',
        'xxx123456789012345',
        'changeme12345678901',
        'replace_me_12345678',
        '<your_key_here>12345',
        '[api_key]1234567890',
      ];

      for (const placeholder of placeholders) {
        const result = SecretsResolver.validate(placeholder);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('placeholder');
      }
    });

    it('should reject unresolved environment variable references', () => {
      const result = SecretsResolver.validate('${UNRESOLVED_VAR}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unresolved environment variable');
    });

    it('should accept valid production-like API keys', () => {
      const validKeys = [
        'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        '9f86d081884c7d659a2feaa0c55ad015',
        'sk-1234567890abcdef1234567890abcdef',
      ];

      for (const key of validKeys) {
        const result = SecretsResolver.validate(key);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('mask', () => {
    it('should mask long API key showing first 4 chars', () => {
      const result = SecretsResolver.mask('abc123def456789');
      expect(result).toBe('abc1***');
    });

    it('should mask short strings completely', () => {
      expect(SecretsResolver.mask('abc')).toBe('****');
      expect(SecretsResolver.mask('ab')).toBe('****');
      expect(SecretsResolver.mask('a')).toBe('****');
    });

    it('should mask empty string', () => {
      expect(SecretsResolver.mask('')).toBe('****');
    });

    it('should mask exactly 4 characters', () => {
      expect(SecretsResolver.mask('abcd')).toBe('****');
    });

    it('should mask 5 characters showing first 4', () => {
      expect(SecretsResolver.mask('abcde')).toBe('abcd***');
    });
  });

  describe('redactFromText', () => {
    it('should redact single secret from text', () => {
      const secret = 'abc123def456789';
      const text = `API key is: ${secret}`;
      const result = SecretsResolver.redactFromText(text, [secret]);
      expect(result).toBe('API key is: abc1***');
    });

    it('should redact multiple occurrences of same secret', () => {
      const secret = 'secret123456789';
      const text = `First: ${secret}, Second: ${secret}`;
      const result = SecretsResolver.redactFromText(text, [secret]);
      expect(result).toBe('First: secr***, Second: secr***');
    });

    it('should redact multiple different secrets', () => {
      const secrets = ['secret1234567890', 'key9876543210abcd'];
      const text = `Secret: secret1234567890, Key: key9876543210abcd`;
      const result = SecretsResolver.redactFromText(text, secrets);
      expect(result).toBe('Secret: secr***, Key: key9***');
    });

    it('should handle text without secrets', () => {
      const result = SecretsResolver.redactFromText('No secrets here', ['abc123456789']);
      expect(result).toBe('No secrets here');
    });

    it('should handle empty text', () => {
      const result = SecretsResolver.redactFromText('', ['secret']);
      expect(result).toBe('');
    });

    it('should handle empty secrets array', () => {
      const result = SecretsResolver.redactFromText('Some text', []);
      expect(result).toBe('Some text');
    });

    it('should escape regex special characters in secrets', () => {
      const secret = 'key.with.dots.123456';
      const text = `Secret is: ${secret}`;
      const result = SecretsResolver.redactFromText(text, [secret]);
      expect(result).toBe('Secret is: key.***');
    });

    it('should handle secrets with regex special characters', () => {
      const specialSecrets = [
        'key$with$dollar123',
        'key(with)parens123',
        'key[with]brackets1',
        'key*with*stars1234',
        'key+with+plus12345',
      ];

      for (const secret of specialSecrets) {
        const text = `Secret: ${secret}`;
        const result = SecretsResolver.redactFromText(text, [secret]);
        expect(result).not.toContain(secret);
        expect(result).toContain('***');
      }
    });
  });

  describe('resolveAndValidate', () => {
    it('should resolve and validate in one operation', () => {
      process.env.VALID_API_KEY = 'validkey123456789';
      const result = SecretsResolver.resolveAndValidate('${VALID_API_KEY}');
      expect(result).toBe('validkey123456789');
    });

    it('should throw error for undefined environment variable', () => {
      expect(() => {
        SecretsResolver.resolveAndValidate('${UNDEFINED_VAR}');
      }).toThrow('Environment variable(s) not defined');
    });

    it('should throw error for invalid API key format', () => {
      process.env.INVALID_KEY = 'short';
      expect(() => {
        SecretsResolver.resolveAndValidate('${INVALID_KEY}');
      }).toThrow('Invalid API key');
    });

    it('should throw error for placeholder API key', () => {
      process.env.PLACEHOLDER_KEY = 'your_api_key_here_123456';
      expect(() => {
        SecretsResolver.resolveAndValidate('${PLACEHOLDER_KEY}');
      }).toThrow('Invalid API key');
      expect(() => {
        SecretsResolver.resolveAndValidate('${PLACEHOLDER_KEY}');
      }).toThrow('placeholder');
    });

    it('should accept valid resolved API key', () => {
      process.env.PRODUCTION_KEY = 'prod_key_abc123def456789';
      const result = SecretsResolver.resolveAndValidate('${PRODUCTION_KEY}');
      expect(result).toBe('prod_key_abc123def456789');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle typical configuration resolution flow', () => {
      // Setup environment
      process.env.REDMINE_MAIN_API_KEY = 'main_key_123456789abc';
      process.env.REDMINE_DEV_API_KEY = 'dev_key_xyz987654321';

      // Resolve both keys
      const mainKey = SecretsResolver.resolveAndValidate('${REDMINE_MAIN_API_KEY}');
      const devKey = SecretsResolver.resolveAndValidate('${REDMINE_DEV_API_KEY}');

      expect(mainKey).toBe('main_key_123456789abc');
      expect(devKey).toBe('dev_key_xyz987654321');

      // Mask for logging
      expect(SecretsResolver.mask(mainKey)).toBe('main***');
      expect(SecretsResolver.mask(devKey)).toBe('dev_***');

      // Redact from error message
      const errorMsg = `Failed to connect to main: ${mainKey} or dev: ${devKey}`;
      const safe = SecretsResolver.redactFromText(errorMsg, [mainKey, devKey]);
      expect(safe).not.toContain(mainKey);
      expect(safe).not.toContain(devKey);
      expect(safe).toContain('main***');
      expect(safe).toContain('dev_***');
    });

    it('should handle configuration with missing variable gracefully', () => {
      process.env.EXISTING_KEY = 'existing_key_12345678';
      // MISSING_KEY is not set

      // This should work
      expect(() => {
        SecretsResolver.resolveAndValidate('${EXISTING_KEY}');
      }).not.toThrow();

      // This should fail with clear error
      expect(() => {
        SecretsResolver.resolveAndValidate('${MISSING_KEY}');
      }).toThrow('Environment variable(s) not defined: MISSING_KEY');
    });
  });
});
