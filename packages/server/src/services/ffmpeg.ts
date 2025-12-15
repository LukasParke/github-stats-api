import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { TEMP_DIR } from './renderer';

const execAsync = promisify(exec);

/**
 * Convert H.264 MP4 video to animated WebP using FFmpeg
 * 
 * @param videoBuffer - Input H.264 MP4 video as Buffer
 * @param options - Conversion options
 * @returns WebP buffer
 */
export async function convertVideoToWebP(
  videoBuffer: Buffer,
  options?: { quality?: number; fps?: number }
): Promise<Buffer> {
  const quality = options?.quality ?? 85;
  const fps = options?.fps ?? 30;

  // Create temporary file paths
  const inputPath = join(TEMP_DIR, `input-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);
  const outputPath = join(TEMP_DIR, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`);

  try {
    // Write input video to temp file
    await writeFile(inputPath, videoBuffer);

    // FFmpeg command to convert MP4 to animated WebP (optimized for file size)
    // -i: input file
    // -vf "fps=30": set frame rate (reduced from 50fps for web optimization)
    // -c:v libwebp: explicitly use libwebp codec (required for proper encoding)
    // -quality 85: WebP quality (0-100, balanced quality/size)
    // -compression_level 6: maximum compression (slower but much smaller files)
    // -method 6: highest quality encoding method
    // -loop 0: enable looping
    // -pix_fmt yuv420p: required pixel format for WebP encoding
    // -an: remove audio
    // -vsync 0: passthrough timestamps
    // -y: overwrite output file
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -vf "fps=${fps}" -c:v libwebp -quality ${quality} -compression_level 6 -method 6 -loop 0 -an -vsync 0 -pix_fmt yuv420p -y "${outputPath}"`;

    console.log(`[ffmpeg] Converting MP4 to WebP: ${inputPath} -> ${outputPath}`);
    const { stderr } = await execAsync(ffmpegCommand);

    // FFmpeg outputs to stderr, check for errors
    if (stderr && stderr.includes('Error')) {
      throw new Error(`FFmpeg conversion failed: ${stderr}`);
    }

    // Read the output WebP file
    const webpBuffer = await readFile(outputPath);

    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    console.log(`[ffmpeg] Conversion complete: ${webpBuffer.length} bytes`);
    return webpBuffer;
  } catch (error) {
    // Clean up temp files on error
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});

    if (error instanceof Error) {
      throw new Error(`Failed to convert video to WebP: ${error.message}`);
    }
    throw error;
  }
}

