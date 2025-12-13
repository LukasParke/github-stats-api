import { Client } from 'minio';
import { env } from '../config/env';

// Initialize MinIO client
const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

const BUCKET = env.MINIO_BUCKET;

/**
 * Ensure the bucket exists, create if it doesn't
 */
export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`Created bucket: ${BUCKET}`);

    // Set bucket policy to allow public read access for images
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
  }
}

/**
 * Generate storage key for a user's image
 */
export function getImageKey(username: string, compositionId: string): string {
  return `images/${username}/${compositionId}.gif`;
}

/**
 * Upload rendered GIF to MinIO
 */
export async function uploadImage(
  key: string,
  buffer: Buffer,
  metadata?: Record<string, string>
): Promise<void> {
  await minioClient.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': 'image/gif',
    ...metadata,
  });
}

/**
 * Get a readable stream for an image
 */
export async function getImageStream(key: string): Promise<NodeJS.ReadableStream> {
  return await minioClient.getObject(BUCKET, key);
}

/**
 * Get image as buffer
 */
export async function getImageBuffer(key: string): Promise<Buffer> {
  const stream = await getImageStream(key);
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Check if an image exists
 */
export async function imageExists(key: string): Promise<boolean> {
  try {
    await minioClient.statObject(BUCKET, key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get image metadata (size, last modified, etc.)
 */
export async function getImageStats(key: string): Promise<{
  size: number;
  lastModified: Date;
  etag: string;
} | null> {
  try {
    const stat = await minioClient.statObject(BUCKET, key);
    return {
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a presigned URL for direct access (optional, for CDN bypass)
 */
export async function getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
  return await minioClient.presignedGetObject(BUCKET, key, expirySeconds);
}

/**
 * Get the public URL for an image
 */
export function getPublicUrl(key: string): string {
  // We keep MinIO internal and serve images via the API image route.
  // Key format is always: images/${username}/${compositionId}.gif
  const parts = key.split('/');
  const username = parts.length >= 3 ? parts[1] : undefined;
  const filename = parts.length >= 3 ? parts[2] : undefined;
  const compositionId = filename?.endsWith('.gif') ? filename.slice(0, -4) : undefined;

  const base = env.PUBLIC_URL ? env.PUBLIC_URL.replace(/\/+$/, '') : '';

  if (parts[0] === 'images' && username && compositionId) {
    return `${base}/api/image/${encodeURIComponent(username)}/${encodeURIComponent(compositionId)}`;
  }

  throw new Error(`Invalid image key format for public URL: ${key}`);
}

/**
 * Delete an image
 */
export async function deleteImage(key: string): Promise<void> {
  await minioClient.removeObject(BUCKET, key);
}

/**
 * Delete all images for a user
 */
export async function deleteUserImages(username: string): Promise<void> {
  const prefix = `images/${username}/`;
  const objectsStream = minioClient.listObjects(BUCKET, prefix, true);

  const objectsToDelete: string[] = [];
  for await (const obj of objectsStream) {
    if (obj.name) {
      objectsToDelete.push(obj.name);
    }
  }

  if (objectsToDelete.length > 0) {
    await minioClient.removeObjects(BUCKET, objectsToDelete);
  }
}

/**
 * List all images for a user
 */
export async function listUserImages(username: string): Promise<string[]> {
  const prefix = `images/${username}/`;
  const objectsStream = minioClient.listObjects(BUCKET, prefix, true);

  const images: string[] = [];
  for await (const obj of objectsStream) {
    if (obj.name) {
      images.push(obj.name);
    }
  }

  return images;
}

// Export the client for advanced use cases
export { minioClient };

