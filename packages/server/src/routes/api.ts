import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  addRenderJob,
  addBulkRenderJobs,
  getJobStatus,
  getQueueStats,
} from '../services/queue';
import {
  imageExists,
  getImageStream,
  getImageStats,
  getImageKey,
} from '../services/storage';
import { COMPOSITIONS, CompositionId } from '../services/renderer';

export const apiRoutes = new OpenAPIHono();

// ============================================================================
// OpenAPI Schemas
// ============================================================================

const CompositionIdSchema = z
  .enum(COMPOSITIONS as unknown as [string, ...string[]])
  .openapi({
    description: 'Available composition IDs for rendering',
    example: 'readme-dark-gemini',
  });

const PrioritySchema = z.enum(['high', 'normal', 'low']).openapi({
  description: 'Job priority level',
  example: 'normal',
});

const ThemeSchema = z.enum(['light', 'dark', 'all']).openapi({
  description: 'Theme filter for compositions',
  example: 'dark',
});

const UsernameParamSchema = z.string().min(1).max(39).openapi({
  param: { name: 'username', in: 'path' },
  description: 'GitHub username',
  example: 'octocat',
});

const CompositionParamSchema = z.string().openapi({
  param: { name: 'composition', in: 'path' },
  description: 'Composition ID',
  example: 'readme-dark-gemini',
});

const JobIdParamSchema = z.string().openapi({
  param: { name: 'jobId', in: 'path' },
  description: 'Render job ID',
  example: 'render:octocat:readme-dark-gemini',
});

// Request schemas
const RenderRequestSchema = z
  .object({
    username: z.string().min(1).max(39),
    compositionId: CompositionIdSchema,
    priority: PrioritySchema.optional().default('normal'),
  })
  .openapi('RenderRequest');

const BulkRenderRequestSchema = z
  .object({
    username: z.string().min(1).max(39),
    compositions: z.array(CompositionIdSchema).optional(),
    theme: ThemeSchema.optional().default('all'),
    priority: PrioritySchema.optional().default('normal'),
  })
  .openapi('BulkRenderRequest');

// Response schemas
const ErrorResponseSchema = z
  .object({
    error: z.string(),
    message: z.string().optional(),
    valid: z.array(z.string()).optional(),
  })
  .openapi('ErrorResponse');

const RenderQueuedResponseSchema = z
  .object({
    status: z.literal('rendering'),
    jobId: z.string(),
    message: z.string(),
    statusUrl: z.string(),
  })
  .openapi('RenderQueuedResponse');

const RenderSuccessResponseSchema = z
  .object({
    success: z.literal(true),
    jobId: z.string(),
    statusUrl: z.string(),
  })
  .openapi('RenderSuccessResponse');

const BulkRenderResponseSchema = z
  .object({
    success: z.literal(true),
    jobCount: z.number(),
    jobs: z.array(
      z.object({
        id: z.string(),
        compositionId: z.string(),
        statusUrl: z.string(),
      })
    ),
  })
  .openapi('BulkRenderResponse');

const JobStatusResponseSchema = z
  .object({
    jobId: z.string(),
    state: z.string(),
    progress: z.number(),
    result: z
      .object({
        success: z.boolean(),
        imageKey: z.string().optional(),
        imageUrl: z.string().optional(),
        error: z.string().optional(),
        renderedAt: z.number(),
        durationMs: z.number(),
      })
      .optional(),
    imageUrl: z.string().optional(),
    error: z.string().optional(),
  })
  .openapi('JobStatusResponse');

const QueueStatsResponseSchema = z
  .object({
    queue: z.string(),
    stats: z.object({
      waiting: z.number(),
      active: z.number(),
      completed: z.number(),
      failed: z.number(),
      delayed: z.number(),
    }),
  })
  .openapi('QueueStatsResponse');

const CompositionsResponseSchema = z
  .object({
    total: z.number(),
    compositions: z.array(z.string()),
    grouped: z.object({
      readme: z.array(z.string()),
      commitStreak: z.array(z.string()),
      topLanguages: z.array(z.string()),
      contribution: z.array(z.string()),
      commitGraph: z.array(z.string()),
    }),
  })
  .openapi('CompositionsResponse');

const HealthResponseSchema = z
  .object({
    status: z.string(),
  })
  .openapi('HealthResponse');

// ============================================================================
// Route Definitions
// ============================================================================

// GET /api/compositions
const listCompositionsRoute = createRoute({
  method: 'get',
  path: '/compositions',
  tags: ['Compositions'],
  summary: 'List available compositions',
  description: 'Returns all available composition IDs grouped by type',
  responses: {
    200: {
      description: 'List of compositions',
      content: {
        'application/json': {
          schema: CompositionsResponseSchema,
        },
      },
    },
  },
});

apiRoutes.openapi(listCompositionsRoute, (c) => {
  const grouped = {
    readme: COMPOSITIONS.filter((id) => id.startsWith('readme-')),
    commitStreak: COMPOSITIONS.filter((id) => id.startsWith('commit-streak-')),
    topLanguages: COMPOSITIONS.filter((id) => id.startsWith('top-languages-')),
    contribution: COMPOSITIONS.filter((id) => id.startsWith('contribution-')),
    commitGraph: COMPOSITIONS.filter((id) => id.startsWith('commit-graph-')),
  };

  return c.json({
    total: COMPOSITIONS.length,
    compositions: [...COMPOSITIONS],
    grouped,
  });
});

// GET /api/image/:username/:composition
const getImageRoute = createRoute({
  method: 'get',
  path: '/image/{username}/{composition}',
  tags: ['Images'],
  summary: 'Get rendered GIF for a user',
  description:
    'Returns the rendered GIF image for a user. If not available, queues a render job.',
  request: {
    params: z.object({
      username: UsernameParamSchema,
      composition: CompositionParamSchema,
    }),
    query: z.object({
      refresh: z
        .string()
        .optional()
        .openapi({
          description: 'Set to "true" to force re-render',
          example: 'false',
        }),
    }),
  },
  responses: {
    200: {
      description: 'GIF image',
      content: {
        'image/gif': {
          schema: z.any().openapi({ type: 'string', format: 'binary' }),
        },
      },
    },
    202: {
      description: 'Render job queued',
      content: {
        'application/json': {
          schema: RenderQueuedResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid composition',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

apiRoutes.openapi(getImageRoute, async (c) => {
  const { username, composition } = c.req.valid('param');
  const { refresh } = c.req.valid('query');
  const shouldRefresh = refresh === 'true';

  // Validate composition
  if (!COMPOSITIONS.includes(composition as CompositionId)) {
    return c.json(
      {
        error: 'Invalid composition',
        valid: [...COMPOSITIONS],
      },
      400
    );
  }

  const compositionId = composition as CompositionId;
  const imageKey = getImageKey(username, compositionId);

  // Check if image exists in storage
  const exists = await imageExists(imageKey);

  if (exists && !shouldRefresh) {
    const stats = await getImageStats(imageKey);
    const stream = await getImageStream(imageKey);

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=3600',
        ...(stats?.etag && { ETag: stats.etag }),
        ...(stats?.lastModified && { 'Last-Modified': stats.lastModified.toUTCString() }),
      },
    });
  }

  // Image doesn't exist or refresh requested - queue a render
  const job = await addRenderJob({
    username,
    compositionId,
    theme: compositionId.includes('light') ? 'light' : 'dark',
    priority: 'normal',
    triggeredBy: 'api',
    requestedAt: Date.now(),
  });

  return c.json(
    {
      status: 'rendering' as const,
      jobId: job.id!,
      message: 'Image is being rendered. Check status at /api/status/:jobId',
      statusUrl: `/api/status/${job.id}`,
    },
    202
  );
});

// POST /api/render
const renderRoute = createRoute({
  method: 'post',
  path: '/render',
  tags: ['Rendering'],
  summary: 'Request a new render',
  description: 'Queue a render job for a specific composition',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RenderRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Render job created',
      content: {
        'application/json': {
          schema: RenderSuccessResponseSchema,
        },
      },
    },
  },
});

apiRoutes.openapi(renderRoute, async (c) => {
  const { username, compositionId, priority } = c.req.valid('json');

  const job = await addRenderJob({
    username,
    compositionId,
    theme: compositionId.includes('light') ? 'light' : 'dark',
    priority,
    triggeredBy: 'api',
    requestedAt: Date.now(),
  });

  return c.json({
    success: true as const,
    jobId: job.id!,
    statusUrl: `/api/status/${job.id}`,
  });
});

// POST /api/render/bulk
const bulkRenderRoute = createRoute({
  method: 'post',
  path: '/render/bulk',
  tags: ['Rendering'],
  summary: 'Request bulk renders',
  description: 'Queue render jobs for multiple compositions at once',
  request: {
    body: {
      content: {
        'application/json': {
          schema: BulkRenderRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Render jobs created',
      content: {
        'application/json': {
          schema: BulkRenderResponseSchema,
        },
      },
    },
  },
});

apiRoutes.openapi(bulkRenderRoute, async (c) => {
  const { username, compositions, theme, priority } = c.req.valid('json');

  let compositionsToRender: string[];

  if (compositions && compositions.length > 0) {
    compositionsToRender = compositions;
  } else if (theme === 'all') {
    compositionsToRender = [...COMPOSITIONS];
  } else {
    compositionsToRender = COMPOSITIONS.filter((id) => id.includes(theme));
  }

  const jobs = await addBulkRenderJobs(username, compositionsToRender, {
    priority,
    triggeredBy: 'api',
  });

  return c.json({
    success: true as const,
    jobCount: jobs.length,
    jobs: jobs.map((job) => ({
      id: job.id!,
      compositionId: job.data.compositionId,
      statusUrl: `/api/status/${job.id}`,
    })),
  });
});

// GET /api/status/:jobId
const jobStatusRoute = createRoute({
  method: 'get',
  path: '/status/{jobId}',
  tags: ['Jobs'],
  summary: 'Check render job status',
  description: 'Get the current status and result of a render job',
  request: {
    params: z.object({
      jobId: JobIdParamSchema,
    }),
  },
  responses: {
    200: {
      description: 'Job status',
      content: {
        'application/json': {
          schema: JobStatusResponseSchema,
        },
      },
    },
    404: {
      description: 'Job not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

apiRoutes.openapi(jobStatusRoute, async (c) => {
  const { jobId } = c.req.valid('param');

  const status = await getJobStatus(jobId);

  if (!status) {
    return c.json({ error: 'Job not found' }, 404);
  }

  return c.json({
    jobId,
    state: status.state,
    progress: status.progress,
    result: status.result,
    imageUrl: status.result?.imageUrl,
    error: status.failedReason,
  }, 200);
});

// GET /api/queue
const queueStatsRoute = createRoute({
  method: 'get',
  path: '/queue',
  tags: ['Jobs'],
  summary: 'Get queue statistics',
  description: 'Returns current queue statistics including job counts by state',
  responses: {
    200: {
      description: 'Queue statistics',
      content: {
        'application/json': {
          schema: QueueStatsResponseSchema,
        },
      },
    },
  },
});

apiRoutes.openapi(queueStatsRoute, async (c) => {
  const stats = await getQueueStats();

  return c.json({
    queue: 'render-jobs',
    stats,
  });
});

// GET /api/health
const apiHealthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'API health check',
  description: 'Simple health check for the API routes',
  responses: {
    200: {
      description: 'Healthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

apiRoutes.openapi(apiHealthRoute, (c) => {
  return c.json({ status: 'healthy' });
});
