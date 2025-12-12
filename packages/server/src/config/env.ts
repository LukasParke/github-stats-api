import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    // Server
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // GitHub App
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_WEBHOOK_SECRET: z.string().min(1),

    // Redis
    REDIS_URL: z.string().url().default('redis://localhost:6379'),

    // MinIO
    MINIO_ENDPOINT: z.string().default('localhost'),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET: z.string().default('github-stats'),
    MINIO_USE_SSL: z.coerce.boolean().default(false),

    // Rendering
    RENDER_CONCURRENCY: z.coerce.number().default(2),
    RENDER_TIMEOUT_MS: z.coerce.number().default(60000),

    // Public URL for serving images (required in production)
    PUBLIC_URL: z
      .string()
      .url()
      .optional()
      .refine(
        (val) => {
          // In production, PUBLIC_URL must be set to an external URL
          const nodeEnv = process.env.NODE_ENV;
          if (nodeEnv === 'production') {
            return val !== undefined && val.length > 0;
          }
          return true; // Optional in development
        },
        {
          message: 'PUBLIC_URL is required in production and must be an external URL (e.g., https://storage.example.com)',
        }
      ),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type Env = typeof env;

