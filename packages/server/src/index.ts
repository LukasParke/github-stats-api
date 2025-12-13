import { OpenAPIHono } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './config/env';
import { logLoadedConfig, runStartupChecks } from './config/startup';
import { apiRoutes } from './routes/api';
import { webhookRoutes } from './routes/webhooks';
import { healthRoutes } from './routes/health';
import { redis, closeQueue } from './services/queue';

const app = new OpenAPIHono();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: '*', // Allow embedding in any README
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
  })
);

// Error handling
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

// Not found handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Mount routes
app.route('/health', healthRoutes);
app.route('/api', apiRoutes);
app.route('/webhooks', webhookRoutes);

// OpenAPI JSON spec endpoint
app.doc('/api/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'GitHub Stats API',
    version: '1.0.0',
    description:
      'API for generating animated GitHub statistics GIFs. Renders dynamic visualizations of user GitHub activity, contribution graphs, language breakdowns, and more.',
    contact: {
      name: 'GitHub Stats',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: env.NODE_ENV === 'production' ? (env.PUBLIC_URL || '') : `http://localhost:${env.PORT}`,
      description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
    },
  ],
  tags: [
    { name: 'Images', description: 'Retrieve rendered GIF images' },
    { name: 'Rendering', description: 'Queue render jobs' },
    { name: 'Jobs', description: 'Monitor render job status' },
    { name: 'Compositions', description: 'Available composition templates' },
    { name: 'Health', description: 'Service health checks' },
  ],
});

// Scalar API Reference UI
app.get(
  '/api/docs',
  apiReference({
    spec: {
      url: '/api/openapi.json',
    },
    theme: 'kepler',
    layout: 'modern',
    defaultHttpClient: {
      targetKey: 'js',
      clientKey: 'fetch',
    },
    metaData: {
      title: 'GitHub Stats API Documentation',
      description: 'Interactive API documentation for GitHub Stats GIF generation',
    },
  })
);

// Root route
app.get('/', (c) => {
  return c.json({
    name: 'GitHub Stats API',
    version: '1.0.0',
    docs: '/api/docs',
    openapi: '/api/openapi.json',
  });
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down server...');

  try {
    await closeQueue();
    console.log('Server shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle Redis connection errors
redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

// Start server
const port = env.PORT;

logLoadedConfig('api');
await runStartupChecks({ role: 'api' });

console.log(`🚀 Server starting on port ${port}`);
console.log(`📚 API docs available at http://localhost:${port}/api/docs`);

export default {
  port,
  fetch: app.fetch,
};
