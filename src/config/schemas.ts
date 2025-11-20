import { z } from 'zod';

export const RedmineRepositoryDefaultsSchema = z.object({
  projectId: z.union([z.number(), z.string()]).nullable().optional(),
  trackerId: z.union([z.number(), z.string()]).nullable().optional(),
  statusId: z.union([z.number(), z.string()]).nullable().optional(),
  priorityId: z.union([z.number(), z.string()]).nullable().optional(),
});

export const SecretSourceSchema = z.enum([
  'environment',
  'aws-secrets-manager',
  'vault',
  'azure-keyvault',
]);

export const RedmineRepositorySchema = z.object({
  id: z
    .string()
    .min(1, 'Repository id is required')
    .regex(/^[a-z0-9-_]+$/, 'Repository id must be lowercase alphanumeric with - or _'),
  displayName: z.string().min(1, 'displayName is required'),
  url: z
    .string()
    .url('Invalid URL format')
    .refine((u) => !u.endsWith('/'), 'URL should not end with slash'),
  apiKey: z.string().min(1, 'apiKey is required'),
  secretSource: SecretSourceSchema,
  defaults: RedmineRepositoryDefaultsSchema.optional(),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
});

export const RedmineConfigSchema = z.object({
  configVersion: z.string().min(1, 'configVersion is required'),
  defaultRepositoryId: z.string().optional(),
  repositories: z.array(RedmineRepositorySchema).min(1, 'At least one repository is required'),
});

export type RedmineRepositoryDefaults = z.infer<typeof RedmineRepositoryDefaultsSchema>;
export type RedmineRepository = z.infer<typeof RedmineRepositorySchema>;
export type RedmineConfig = z.infer<typeof RedmineConfigSchema>;
