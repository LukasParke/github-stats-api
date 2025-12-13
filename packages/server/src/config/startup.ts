import { env, validateEnv } from './env';
import { redis } from '../services/queue';
import { ensureBucket } from '../services/storage';
import { checkGitHubAppAuth } from '../services/github';

type ServiceRole = 'api' | 'worker';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { name: string; attempts?: number; delayMs?: number; timeoutMs?: number }
): Promise<T> {
  const { name, attempts = 10, delayMs = 1500, timeoutMs = 15000 } = opts;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (attempt > 1) console.log(`↻ ${name}: retry ${attempt}/${attempts}...`);
      const res = await withTimeout(fn(), timeoutMs, name);
      return res;
    } catch (err) {
      lastErr = err;
      console.error(`✗ ${name} attempt ${attempt}/${attempts} failed: ${formatError(err)}`);
      if (attempt < attempts) await sleep(delayMs);
    }
  }

  throw new Error(`${name} failed after ${attempts} attempts: ${formatError(lastErr)}`);
}

/**
 * Logs all validated configuration values.
 * Note: per user requirement, this prints secrets in full.
 */
export function logLoadedConfig(role: ServiceRole): void {
  // Explicit validation for call-site clarity
  validateEnv();

  console.log('==================== CONFIG LOADED ====================');
  console.log(`ROLE=${role}`);

  const entries: Array<[string, unknown]> = [
    ['NODE_ENV', env.NODE_ENV],
    ['PORT', env.PORT],
    ['REDIS_URL', env.REDIS_URL],
    ['MINIO_ENDPOINT', env.MINIO_ENDPOINT],
    ['MINIO_PORT', env.MINIO_PORT],
    ['MINIO_USE_SSL', env.MINIO_USE_SSL],
    ['MINIO_BUCKET', env.MINIO_BUCKET],
    ['MINIO_ACCESS_KEY', env.MINIO_ACCESS_KEY],
    ['MINIO_SECRET_KEY', env.MINIO_SECRET_KEY],
    ['PUBLIC_URL', env.PUBLIC_URL],
    ['RENDER_CONCURRENCY', env.RENDER_CONCURRENCY],
    ['RENDER_TIMEOUT_MS', env.RENDER_TIMEOUT_MS],
    ['GITHUB_APP_ID', env.GITHUB_APP_ID],
    ['GITHUB_WEBHOOK_SECRET', env.GITHUB_WEBHOOK_SECRET],
    ['GITHUB_APP_PRIVATE_KEY', env.GITHUB_APP_PRIVATE_KEY],
  ];

  for (const [key, value] of entries) {
    console.log(`${key}=${JSON.stringify(value)}`);
  }

  console.log('=======================================================');
}

export async function checkRedisReachable(opts: { attempts?: number; delayMs?: number; timeoutMs?: number } = {}): Promise<void> {
  await withRetry(
    async () => {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis PING response: ${pong}`);
      }
    },
    { name: `Redis reachable (REDIS_URL=${env.REDIS_URL})`, attempts: opts.attempts ?? 10, delayMs: opts.delayMs ?? 1500, timeoutMs: opts.timeoutMs ?? 5000 }
  );
}

export async function checkMinioReachable(opts: { attempts?: number; delayMs?: number; timeoutMs?: number } = {}): Promise<void> {
  await withRetry(
    async () => {
      await ensureBucket();
    },
    {
      name: `MinIO reachable (endpoint=${env.MINIO_ENDPOINT}:${env.MINIO_PORT}, bucket=${env.MINIO_BUCKET})`,
      attempts: opts.attempts ?? 10,
      delayMs: opts.delayMs ?? 2000,
      timeoutMs: opts.timeoutMs ?? 15000,
    }
  );
}

export async function checkGitHubAppReachable(opts: { attempts?: number; delayMs?: number; timeoutMs?: number } = {}): Promise<void> {
  await withRetry(
    async () => {
      await checkGitHubAppAuth();
    },
    {
      name: `GitHub reachable + App auth valid (appId=${env.GITHUB_APP_ID})`,
      attempts: opts.attempts ?? 5,
      delayMs: opts.delayMs ?? 2000,
      timeoutMs: opts.timeoutMs ?? 15000,
    }
  );
}

export async function checkRendererWarmup(): Promise<void> {
  await withRetry(
    async () => {
      const { warmupBundle } = await import('../services/renderer');
      await warmupBundle();
    },
    { name: 'Remotion bundle warmup', attempts: 3, delayMs: 2000, timeoutMs: 120000 }
  );
}

export async function runStartupChecks(opts: { role: ServiceRole }): Promise<void> {
  const { role } = opts;

  console.log('================== STARTUP CHECKS ==================');
  console.log(`ROLE=${role}`);

  // Validate config early (explicit)
  validateEnv();
  console.log('✓ Env validation passed');

  // External dependencies
  await checkRedisReachable();
  console.log('✓ Redis reachable');

  await checkMinioReachable();
  console.log('✓ MinIO reachable');

  await checkGitHubAppReachable();
  console.log('✓ GitHub reachable + App auth valid');

  if (role === 'worker') {
    await checkRendererWarmup();
    console.log('✓ Remotion bundle warmed up');
  }

  console.log('====================================================');
}


