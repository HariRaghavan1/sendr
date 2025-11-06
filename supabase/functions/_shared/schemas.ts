/**
 * Shared validation schemas for edge functions
 *
 * Uses Zod for runtime type validation to prevent malicious or malformed inputs
 */

import { z } from 'https://esm.sh/zod@3.25.76';

/**
 * Workflow execution request schema
 */
export const ExecuteWorkflowSchema = z.object({
  workflow_id: z.string().uuid('Invalid workflow ID format'),
  execution_id: z.string().uuid('Invalid execution ID format'),
});

/**
 * Campaign execution request schema
 */
export const ExecuteCampaignSchema = z.object({
  campaign_id: z.string().uuid('Invalid campaign ID format'),
  execution_type: z.enum(['test', 'production'], {
    errorMap: () => ({ message: 'Execution type must be either "test" or "production"' })
  }),
  max_prospects: z.number()
    .int('Max prospects must be an integer')
    .positive('Max prospects must be positive')
    .max(20, 'Test runs limited to 20 prospects')
    .optional(),
  skip_sending: z.boolean().optional(),
});

/**
 * Send email request schema
 */
export const SendEmailSchema = z.object({
  email_id: z.string().uuid('Invalid email ID format'),
});

/**
 * Campaign chat message schema
 */
export const CampaignChatMessageSchema = z.object({
  conversation_id: z.string().uuid('Invalid conversation ID format').optional(),
  campaign_id: z.string().uuid('Invalid campaign ID format').optional(),
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long (max 5000 characters)'),
  instructions: z.string()
    .max(2000, 'Instructions too long (max 2000 characters)')
    .optional(),
});

/**
 * Target criteria schema
 */
export const TargetCriteriaSchema = z.object({
  job_titles: z.string().max(200, 'Job titles too long').optional(),
  industry: z.string().max(100, 'Industry too long').optional(),
  location: z.string().max(100, 'Location too long').optional(),
  company_size: z.string().max(100, 'Company size too long').optional(),
  keywords: z.string().max(200, 'Keywords too long').optional(),
});

/**
 * Campaign configuration schema
 */
export const CampaignConfigSchema = z.object({
  name: z.string()
    .min(1, 'Campaign name required')
    .max(100, 'Campaign name too long'),
  tone: z.enum(['formal', 'casual', 'witty'], {
    errorMap: () => ({ message: 'Tone must be formal, casual, or witty' })
  }).optional().default('casual'),
  goal: z.enum(['demo', 'meeting', 'partnership', 'other'], {
    errorMap: () => ({ message: 'Invalid goal' })
  }).optional().default('meeting'),
  target_criteria: TargetCriteriaSchema.optional(),
  max_prospects: z.number()
    .int('Max prospects must be an integer')
    .positive('Max prospects must be positive')
    .max(10000, 'Max prospects cannot exceed 10,000')
    .optional(),
});

/**
 * API key validation schemas
 */
export const ApiKeySchemas = {
  clado: z.string()
    .min(1, 'Clado API key required')
    .regex(/^lk_/, 'Clado API key must start with "lk_"'),
  composio: z.string()
    .min(1, 'Composio API key required'),
  openai: z.string()
    .min(1, 'OpenAI API key required')
    .regex(/^sk-/, 'OpenAI API key must start with "sk-"'),
};

/**
 * User settings schema
 */
export const UserSettingsSchema = z.object({
  clado_api_key: z.string().optional(),
  composio_api_key: z.string().optional(),
});

/**
 * Email content schema (for security - prevent XSS, injection)
 */
export const EmailContentSchema = z.object({
  subject: z.string()
    .min(1, 'Subject required')
    .max(200, 'Subject too long')
    // Prevent potentially dangerous characters
    .regex(/^[^<>{}[\]]*$/, 'Subject contains invalid characters'),
  body: z.string()
    .min(1, 'Email body required')
    .max(5000, 'Email body too long')
    // Allow basic characters but prevent script tags
    .refine(
      (val) => !/<script|javascript:|onerror=/i.test(val),
      'Email body contains potentially dangerous content'
    ),
});

/**
 * Prospect data schema
 */
export const ProspectSchema = z.object({
  name: z.string().min(1, 'Prospect name required').max(200),
  email: z.string().email('Invalid email format').max(255),
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  linkedin_url: z.string().url('Invalid LinkedIn URL').max(500).optional(),
});

/**
 * Helper function to validate and sanitize input
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
}

/**
 * Helper to safely extract Authorization header
 */
export function extractAuthToken(headers: Headers): string {
  const authHeader = headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid Authorization format (expected Bearer token)');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    throw new Error('Empty Authorization token');
  }

  return token;
}

/**
 * Helper to validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Rate limiting helper (simple in-memory implementation)
 * For production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    // New window
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (record.count >= maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  // Increment count
  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute
