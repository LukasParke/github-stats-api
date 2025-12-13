import { Worker, Job } from "bullmq";
import {
  redis,
  RENDER_QUEUE,
  RenderJobData,
  RenderJobResult,
  cache,
  renderQueueEvents,
  renderQueue,
} from "../services/queue";
import { renderComposition, CompositionId } from "../services/renderer";
import { fetchUserStats } from "../services/github";
import { env } from "../config/env";
import { logLoadedConfig, runStartupChecks } from "../config/startup";

logLoadedConfig("worker");
await runStartupChecks({ role: "worker" });

console.log("🚀 Starting render worker...");

// If the queue was paused previously, jobs can remain stuck (often showing as "prioritized").
// This can persist across restarts because the paused flag lives in Redis.
try {
  const paused = await renderQueue.isPaused();
  console.log(`Queue paused: ${paused}`);
  if (paused) {
    console.warn("Queue is paused. Resuming now...");
    await renderQueue.resume();
    console.log("Queue resumed");
  }
} catch (error) {
  console.error("Failed to check/resume queue paused state:", error);
}

// Process-level crash visibility
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection in worker:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in worker:", error);
  process.exit(1);
});

// Redis connection visibility (the API already logs these; worker should too)
redis.on("connect", () => console.log("Redis connected (worker)"));
redis.on("ready", () => console.log("Redis ready (worker)"));
redis.on("reconnecting", (delay: number) =>
  console.warn(`Redis reconnecting (worker) in ${delay}ms`)
);
redis.on("close", () => console.warn("Redis connection closed (worker)"));
redis.on("end", () => console.warn("Redis connection ended (worker)"));
redis.on("error", (error) =>
  console.error("Redis connection error (worker):", error)
);

// Process render jobs
const worker = new Worker<RenderJobData, RenderJobResult>(
  RENDER_QUEUE,
  async (job: Job<RenderJobData, RenderJobResult>) => {
    const { username, compositionId, installationId, triggeredBy } = job.data;
    const startTime = Date.now();

    const prefix = `[job ${job.id}]`;
    console.log(
      `${prefix} start: composition=${compositionId} username=${username} triggeredBy=${triggeredBy} installationId=${
        installationId ?? "none"
      }`
    );
    console.log(`${prefix} data: ${JSON.stringify(job.data)}`);

    try {
      // Update progress
      await job.updateProgress(10);
      console.log(`${prefix} progress=10 (starting)`);

      // Fetch fresh user stats
      let userStats;
      try {
        const t0 = Date.now();
        console.log(`${prefix} fetching GitHub stats...`);
        userStats = await fetchUserStats(installationId, username);
        console.log(`${prefix} fetched GitHub stats in ${Date.now() - t0}ms`);
        await job.updateProgress(30);
        console.log(`${prefix} progress=30 (stats fetched)`);
      } catch (error) {
        console.error(`Failed to fetch stats for ${username}:`, error);
        throw new Error(
          `Failed to fetch user stats: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      // Render the composition
      await job.updateProgress(40);
      console.log(`${prefix} progress=40 (render starting)`);
      const renderStart = Date.now();

      const result = await renderComposition({
        compositionId: compositionId as CompositionId,
        userStats,
        username,
      });

      console.log(
        `${prefix} render finished in ${Date.now() - renderStart}ms success=${
          result.success
        }`
      );
      await job.updateProgress(90);
      console.log(`${prefix} progress=90 (render done)`);

      if (!result.success) {
        throw new Error(result.error || "Render failed");
      }

      // Cache the image URL
      if (result.imageUrl) {
        console.log(`${prefix} caching imageUrl=${result.imageUrl}`);
        await cache.setImageUrl(username, compositionId, result.imageUrl, 3600);
        console.log(`${prefix} cached imageUrl`);
      }

      await job.updateProgress(100);
      console.log(`${prefix} progress=100 (done)`);

      const durationMs = Date.now() - startTime;
      console.log(
        `${prefix} completed in ${durationMs}ms imageKey=${
          result.imageKey ?? "none"
        } imageUrl=${result.imageUrl ?? "none"}`
      );

      return {
        success: true,
        imageKey: result.imageKey,
        imageUrl: result.imageUrl,
        renderedAt: Date.now(),
        durationMs,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`${prefix} failed: ${errorMessage}`);

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
worker.on("ready", () => {
  console.log(
    `Worker ready. Queue=${RENDER_QUEUE}, concurrency=${env.RENDER_CONCURRENCY}`
  );
});

worker.on("active", (job) => {
  console.log(`Job ${job.id} active: ${job.name}`);
});

worker.on("progress", (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}`);
});

worker.on("completed", (job, result) => {
  console.log(
    `Job ${job.id} completed:`,
    result.success ? "success" : "failed"
  );
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error.message);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});

worker.on("stalled", (jobId) => {
  console.warn(`Job ${jobId} stalled`);
});

worker.on("closed", () => {
  console.log("Worker closed");
});

// Queue-level visibility (this helps even if worker never picks a job)
renderQueueEvents.on("waiting", ({ jobId }) => {
  console.log(`QueueEvent: job waiting: ${jobId}`);
});

renderQueueEvents.on("active", ({ jobId, prev }) => {
  console.log(`QueueEvent: job active: ${jobId} (prev=${prev})`);
});

renderQueueEvents.on("completed", ({ jobId }) => {
  console.log(`QueueEvent: job completed: ${jobId}`);
});

renderQueueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`QueueEvent: job failed: ${jobId}: ${failedReason}`);
});

renderQueueEvents.on("stalled", ({ jobId }) => {
  console.warn(`QueueEvent: job stalled: ${jobId}`);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log("Shutting down worker...");

  await worker.close();
  await redis.quit();

  console.log("Worker shut down complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`Worker started with concurrency: ${env.RENDER_CONCURRENCY}`);
