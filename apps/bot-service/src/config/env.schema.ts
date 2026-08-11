import { z } from 'zod';

export const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Claude
  CLAUDE_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default('claude-sonnet-5'),

  // AWS General
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // SQS
  SQS_QUEUE_URL: z.string().url(),
  SQS_MAX_MESSAGES: z.coerce.number().min(1).max(10).default(10),
  SQS_WAIT_TIME: z.coerce.number().min(0).max(20).default(20),
  SQS_VISIBILITY_TIMEOUT: z.coerce.number().default(30),

  // DynamoDB
  DYNAMODB_TABLE: z.string().default('bot_conversations'),
  DYNAMODB_REGION: z.string().default('us-east-1'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SESSION_CACHE_TTL: z.coerce.number().default(3600),

  // LIS Backend
  LIS_BACKEND_URL: z.string().url(),
  LIS_API_KEY: z.string().min(1),

  // WhatsApp Service
  WHATSAPP_SERVICE_URL: z.string().url().default('http://whatsapp-service:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Environment validation failed:\n${result.error.errors
        .map((e) => `  ${e.path.join('.')}: ${e.message}`)
        .join('\n')}`,
    );
  }
  return result.data;
}
