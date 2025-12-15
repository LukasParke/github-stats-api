import { Worker, Job } from "bullmq";
import {
  redis,
  RENDER_QUEUE,
  RenderJobData,
  RenderJobResult,
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

    const reportProgress = (() => {
      let lastAt = 0;
      let lastValue = -1;
      return async (value: number) => {
        const next = Math.max(0, Math.min(100, Math.round(value)));
        const now = Date.now();
        if (next === lastValue) return;
        // Throttle progress updates to avoid overwhelming Redis.
        if (next !== 100 && now - lastAt < 250) return;
        lastAt = now;
        lastValue = next;
        await job.updateProgress(next);
      };
    })();

    const toOverallProgress = (stage: string, stageProgress01: number): number => {
      const p = Math.max(0, Math.min(1, stageProgress01));
      switch (stage) {
        case "bundle":
          // 35..50
          return 35 + p * 15;
        case "selectComposition":
          // 50..55
          return 50 + p * 5;
        case "renderMedia":
          // 55..95
          return 55 + p * 40;
        case "readOutput":
          // 95..97
          return 95 + p * 2;
        case "upload":
          // 97..99
          return 97 + p * 2;
        case "cleanup":
          // 99..100
          return 99 + p * 1;
        default:
          return p * 100;
      }
    };

    try {
      if (!installationId) {
        throw new Error(`Install required: ${env.GITHUB_APP_INSTALL_URL}`);
      }

      await reportProgress(5);
      console.log(`${prefix} progress=5 (starting)`);

      // Fetch fresh user stats
      let userStats;
      try {
        const t0 = Date.now();
        console.log(`${prefix} fetching GitHub stats...`);
        userStats = await fetchUserStats(installationId, username);
        console.log(`${prefix} fetched GitHub stats in ${Date.now() - t0}ms`);
        await reportProgress(35);
        console.log(`${prefix} progress=35 (stats fetched)`);
      } catch (error) {
        console.error(`Failed to fetch stats for ${username}:`, error);
        throw new Error(
          `Failed to fetch user stats: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      // Render the composition
      await reportProgress(40);
      console.log(`${prefix} progress=40 (render starting)`);
      const renderStart = Date.now();

      const result = await renderComposition({
        compositionId: compositionId as CompositionId,
        userStats,
        username,
        onProgress: async (event) => {
          const overall = toOverallProgress(event.stage, event.progress);
          await reportProgress(overall);
        },
      });

      console.log(
        `${prefix} render finished in ${Date.now() - renderStart}ms success=${
          result.success
        }`
      );
      await reportProgress(95);
      console.log(`${prefix} progress=95 (render done)`);

      if (!result.success) {
        throw new Error(result.error || "Render failed");
      }

      // Note: We intentionally do not cache image URLs in Redis anymore.
      // The API serves images directly from MinIO via /api/image/:username/:composition.

      await reportProgress(100);
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
      max: 20,
      duration: 60000, // 20 jobs per minute max
    },
  }
);

// Periodic visibility into what the worker sees in Redis
setInterval(async () => {
  try {
    const counts = await renderQueue.getJobCounts(
      "wait",
      "prioritized",
      "active",
      "delayed",
      "failed",
      "completed"
    );
    console.log(
      `QueueCounts: wait=${counts.wait ?? 0} prioritized=${
        counts.prioritized ?? 0
      } active=${counts.active ?? 0} delayed=${counts.delayed ?? 0} failed=${
        counts.failed ?? 0
      } completed=${counts.completed ?? 0}`
    );
  } catch (error) {
    console.error("QueueCounts: failed to fetch counts:", error);
  }
}, 10000);

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
