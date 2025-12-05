# syntax=docker/dockerfile:1

# ============================================================================
# Stage 1: Base image with Bun and system dependencies
# ============================================================================
FROM oven/bun:1-debian AS base

# Install system dependencies for Remotion/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Remotion
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# ============================================================================
# Stage 2: Install dependencies
# ============================================================================
FROM base AS deps

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all packages
COPY packages/remotion/package.json ./packages/remotion/
COPY packages/server/package.json ./packages/server/

# Install all dependencies
RUN bun install

# ============================================================================
# Stage 3: Build stage (copy source)
# ============================================================================
FROM base AS build

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/remotion/node_modules ./packages/remotion/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules

# Copy source files
COPY . .

# ============================================================================
# Stage 4: Production runtime
# ============================================================================
FROM base AS runtime

WORKDIR /app

# Copy everything from build stage
COPY --from=build /app .

# Create temp directory for renders
RUN mkdir -p /app/packages/server/temp && chmod 777 /app/packages/server/temp

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command: run the API server
CMD ["bun", "run", "packages/server/src/index.ts"]
