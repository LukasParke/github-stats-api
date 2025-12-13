# Deployment Environment Variables Guide

## Overview

This guide describes deployment configuration for the **self-contained Docker Compose stack** in `docker-compose.yml`.

In this mode, **Redis and MinIO run inside the same stack** as the API and worker, and the **API serves images directly** (MinIO is internal).

## External URLs

Only the **API** needs to be exposed publicly (for webhooks + serving images).

- **API Service** (port 3029)
  - **Example**: `api.githubstats.example.com`
  - **Purpose**: Public API endpoint for serving images and handling webhooks

## Required Environment Variables

### GitHub App Configuration

| Variable | Required | Secret | Description | Example |
|----------|----------|--------|-------------|---------|
| `GITHUB_APP_ID` | ✅ Yes | No | Your GitHub App ID (numeric) | `123456` |
| `GITHUB_APP_PRIVATE_KEY` | ✅ Yes | ✅ Yes | GitHub App private key (PEM format, include `\n` as literal newlines) | `-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----` |
| `GITHUB_WEBHOOK_SECRET` | ✅ Yes | ✅ Yes | Webhook secret configured in GitHub App settings | `your-webhook-secret-here` |

### Optional: Base URL for absolute links

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PUBLIC_URL` | ❌ No | - | If set, the API will return absolute URLs like `https://api.example.com/api/image/...`. If unset, it returns relative URLs. |

### Rendering Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RENDER_CONCURRENCY` | ❌ No | `2` | Number of concurrent render jobs per worker |
| `RENDER_TIMEOUT_MS` | ❌ No | `120000` (worker), `60000` (API) | Maximum time for a render job in milliseconds |

## Complete Environment Variables Setup

### Step 1: Set GitHub App secrets

Set these as **secret** environment variables in Dokploy:

```bash
# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

### Step 2: Optional configuration

If you need to customize defaults:

```bash
# Optional: return absolute URLs
PUBLIC_URL=https://api.yourdomain.com

# Rendering (adjust based on server capacity)
RENDER_CONCURRENCY=4
RENDER_TIMEOUT_MS=180000
```

## Port Mapping Summary

| Service | Internal Port | External Domain | Purpose |
|---------|--------------|-----------------|---------|
| API | 3029 | API domain | API endpoints, health checks, webhooks, images |
| MinIO | 9000 | Internal only | Object storage (internal) |
| Redis | 6379 | Internal only | Job queue and caching |

## Verification Checklist

After deployment, verify:

- [ ] `API_DOMAIN` is accessible and returns API documentation at `/api/docs`
- [ ] All secret variables are marked as secrets in Dokploy
- [ ] GitHub App webhook URL points to `https://${API_DOMAIN}/webhooks/github`
- [ ] Health check endpoint works: `https://${API_DOMAIN}/health/ready`

## Example Complete Configuration

```bash
# Domains (configure in Dokploy domain settings)
API_DOMAIN=api.githubstats.example.com
MINIO_DOMAIN=storage.githubstats.example.com

# Public URL (must be HTTPS and match MinIO domain)
PUBLIC_URL=https://storage.githubstats.example.com

# GitHub App (secrets)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=webhook-secret-123

# MinIO (secrets)
MINIO_ACCESS_KEY=minio-access-key-abc123
MINIO_SECRET_KEY=minio-secret-key-xyz789

# Optional (using defaults)
# REDIS_URL=redis://github-stats-redis:6379
# MINIO_ENDPOINT=github-stats-minio
# MINIO_PORT=9000
# MINIO_BUCKET=github-stats
# MINIO_USE_SSL=false
# RENDER_CONCURRENCY=2
```

## Troubleshooting

### API returns 503 on `/health/ready`
- Check that Redis is accessible at `REDIS_URL`
- Check that MinIO is accessible at `MINIO_ENDPOINT:MINIO_PORT`
- Verify bucket exists (API creates it automatically on startup)

### Images not accessible
- Verify the image endpoint works: `GET /api/image/:username/:composition`
- Check that `minio` is reachable from the API container (internal networking)
- Check bucket exists (created automatically or by `minio-init`)

### GitHub webhooks failing
- Verify webhook URL in GitHub App settings: `https://${API_DOMAIN}/webhooks/github`
- Check `GITHUB_WEBHOOK_SECRET` matches GitHub App configuration
- Verify `GITHUB_APP_PRIVATE_KEY` is correctly formatted (include `\n` as literal newlines)

### Redis eviction policy warning
- **Warning**: `Eviction policy is allkeys-lru. It should be "noeviction"`
- **Impact**: BullMQ works with `allkeys-lru`, but `noeviction` is recommended for job queues to prevent job loss under memory pressure
- **Solution**: Configure Redis eviction policy in Dokploy's Redis service settings:
  - Set `maxmemory-policy` to `noeviction`
  - This ensures jobs are never evicted from Redis, preventing data loss
  - Note: This may require configuring Redis via Dokploy's Redis service configuration options

