#!/usr/bin/env tsx
/**
 * Test script to compare MP4 and WebP file sizes after optimization
 *
 * Usage: tsx packages/server/src/scripts/test-file-sizes.ts <username> <compositionId>
 * Example: tsx packages/server/src/scripts/test-file-sizes.ts LukeHagar commit-streak-dark
 */

import { renderComposition } from "../services/renderer";
import { fetchUserStats } from "../services/github";
import { getInstallationId } from "../services/installations";
import { env } from "../config/env";

async function testFileSizes(username: string, compositionId: string) {
  console.log(`\n🧪 Testing file sizes for ${username}/${compositionId}\n`);

  try {
    // Get installation ID
    const installationId = await getInstallationId(username);
    if (!installationId) {
      console.error("❌ GitHub App installation required");
      process.exit(1);
    }

    // Fetch user stats
    console.log("📊 Fetching user stats...");
    const userStats = await fetchUserStats(installationId, username);
    console.log("✅ User stats fetched\n");

    // Track file sizes
    let mp4Size = 0;
    let webpSize = 0;

    // Render with progress tracking
    console.log("🎬 Starting render...\n");
    const result = await renderComposition({
      compositionId: compositionId as any,
      userStats,
      username,
      onProgress: (event) => {
        if (event.stage === "readOutput") {
          // MP4 size will be logged by renderer
        } else if (event.stage === "convert" && event.progress === 1) {
          // WebP size will be logged by renderer
        }
      },
    });

    if (!result.success) {
      console.error(`❌ Render failed: ${result.error}`);
      process.exit(1);
    }

    console.log("\n📈 Results:");
    console.log(`   Image URL: ${result.imageUrl}`);
    console.log(`   Render time: ${result.durationMs}ms`);
    console.log("\n💡 Check the logs above for MP4 and WebP file sizes");
    console.log("   Look for lines like:");
    console.log('   - "[render ...] read X bytes" (MP4 size)');
    console.log('   - "[render ...] converted to WebP: X bytes" (WebP size)');
    console.log("\n✅ Expected: WebP should be 50-70% smaller than MP4\n");
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error(
    "Usage: tsx packages/server/src/scripts/test-file-sizes.ts <username> <compositionId>"
  );
  console.error(
    "Example: tsx packages/server/src/scripts/test-file-sizes.ts LukeHagar commit-streak-dark"
  );
  process.exit(1);
}

const [username, compositionId] = args;
testFileSizes(username, compositionId).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
