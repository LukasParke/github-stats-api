import { Hono } from 'hono';
import { redis } from '../services/queue';
import { minioClient, ensureBucket } from '../services/storage';
import { env } from '../config/env';

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
  };

  // Check Redis
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG';
  } catch {
    checks.redis = false;
  }

  // Check MinIO - ensure bucket exists (will create if missing)
  try {
    await ensureBucket();
    checks.minio = true;
  } catch {
    checks.minio = false;
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
