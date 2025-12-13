import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Server
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    // GitHub App
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_WEBHOOK_SECRET: z.string().min(1),

    // Redis
    REDIS_URL: z.string().url().default("redis://localhost:6379"),

    // MinIO
    MINIO_ENDPOINT: z.string().default("localhost"),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET: z.string().default("github-stats"),
    // Accept only explicit string values from process.env to avoid truthiness bugs (e.g. "false" => true)
    MINIO_USE_SSL: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

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
          if (nodeEnv === "production") {
            return val !== undefined && val.length > 0;
          }
          return true; // Optional in development
        },
        {
          message:
            "PUBLIC_URL is required in production and must be an external URL (e.g., https://storage.example.com)",
        }
      ),
  },
  runtimeEnvStrict: {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_PORT: process.env.MINIO_PORT,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_BUCKET: process.env.MINIO_BUCKET,
    MINIO_USE_SSL: process.env.MINIO_USE_SSL,
    RENDER_CONCURRENCY: process.env.RENDER_CONCURRENCY,
    RENDER_TIMEOUT_MS: process.env.RENDER_TIMEOUT_MS,
    PUBLIC_URL: process.env.PUBLIC_URL,
  },
  emptyStringAsUndefined: true,
  onValidationError: (error) => {
    console.error("❌ Environment validation failed:");
    const issues = (
      error as {
        issues?: Array<{ path?: Array<string | number>; message: string }>;
      }
    ).issues;
    if (Array.isArray(issues)) {
      for (const issue of issues) {
        const path = issue.path?.join(".") || "unknown";
        console.error(`  - ${path}: ${issue.message}`);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  },
});

export type Env = typeof env;

/**
 * Explicitly validate and return the parsed environment.
 * (Validation happens during module initialization; this is for call-site clarity.)
 */
export function validateEnv(): Env {
  return env;
}
