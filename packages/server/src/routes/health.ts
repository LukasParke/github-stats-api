import { Hono } from 'hono';
import { checkGitHubAppReachable, checkMinioReachable, checkRedisReachable } from '../config/startup';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get('/ready', async (c) => {
  const checks: Record<string, boolean> = {
    server: true,
    redis: false,
    minio: false,
    github: false,
  };

  // Check Redis (fast probe; don't block healthcheck for long)
  try {
    await checkRedisReachable({ attempts: 1, timeoutMs: 1500, delayMs: 0 });
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  // Check MinIO - ensure bucket exists (will create if missing)
  try {
    await checkMinioReachable({ attempts: 1, timeoutMs: 4000, delayMs: 0 });
    checks.minio = true;
  } catch {
    checks.minio = false;
  }

  // Check GitHub App auth (fast probe)
  try {
    await checkGitHubAppReachable({ attempts: 1, timeoutMs: 4000, delayMs: 0 });
    checks.github = true;
  } catch {
    checks.github = false;
  }

  const allHealthy = Object.values(checks).every(Boolean);

  return c.json(
    {
      status: allHealthy ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    allHealthy ? 200 : 503
  );
});

healthRoutes.get('/live', (c) => {
  return c.json({ status: 'alive' });
});
