import { Worker, Job } from 'bullmq';
import { redis, RENDER_QUEUE, RenderJobData, RenderJobResult, cache } from '../services/queue';
import { renderComposition, CompositionId } from '../services/renderer';
import { fetchUserStats } from '../services/github';
import { env } from '../config/env';
import { logLoadedConfig, runStartupChecks } from '../config/startup';

logLoadedConfig('worker');
await runStartupChecks({ role: 'worker' });

console.log('🚀 Starting render worker...');

// Process render jobs
const worker = new Worker<RenderJobData, RenderJobResult>(
  RENDER_QUEUE,
  async (job: Job<RenderJobData, RenderJobResult>) => {
    const { username, compositionId, installationId, triggeredBy } = job.data;
    const startTime = Date.now();

    console.log(`Processing job ${job.id}: ${compositionId} for ${username} (triggered by ${triggeredBy})`);

    try {
      // Update progress
      await job.updateProgress(10);

      // Fetch fresh user stats
      let userStats;
      try {
        userStats = await fetchUserStats(installationId, username);
        await job.updateProgress(30);
      } catch (error) {
        console.error(`Failed to fetch stats for ${username}:`, error);
        throw new Error(`Failed to fetch user stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Render the composition
      await job.updateProgress(40);

      const result = await renderComposition({
        compositionId: compositionId as CompositionId,
        userStats,
        username,
      });

      await job.updateProgress(90);

      if (!result.success) {
        throw new Error(result.error || 'Render failed');
      }

      // Cache the image URL
      if (result.imageUrl) {
        await cache.setImageUrl(username, compositionId, result.imageUrl, 3600);
      }

      await job.updateProgress(100);

      const durationMs = Date.now() - startTime;
      console.log(`✓ Completed job ${job.id} in ${durationMs}ms`);

      return {
        success: true,
        imageKey: result.imageKey,
        imageUrl: result.imageUrl,
        renderedAt: Date.now(),
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`✗ Failed job ${job.id}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        renderedAt: Date.now(),
        durationMs: Date.now() - startTime,
      };
    }
  },
  {
    connection: redis,
    concurrency: env.RENDER_CONCURRENCY,
    limiter: {
      max: 10,
      duration: 60000, // 10 jobs per minute max
    },
  }
);

// Worker event handlers
worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result.success ? 'success' : 'failed');
});

worker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error) => {
  console.error('Worker error:', error);
});

worker.on('stalled', (jobId) => {
  console.warn(`Job ${jobId} stalled`);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down worker...');

  await worker.close();
  await redis.quit();

  console.log('Worker shut down complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`Worker started with concurrency: ${env.RENDER_CONCURRENCY}`);

