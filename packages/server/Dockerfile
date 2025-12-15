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
    fonts-dejavu-core \
    fonts-liberation \
    fonts-noto-core \
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

# Copy workspace config and lockfiles for reproducible installs
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml bun.lock ./

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

# Copy workspace files and root dependencies from deps stage
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/node_modules ./node_modules

# Copy packages directory structure from deps (includes node_modules if they exist)
# This preserves the complete workspace structure including any package-level node_modules
# that Bun created during installation
COPY --from=deps /app/packages ./packages

# Copy source files (this will overwrite source files but preserve node_modules directories)
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
# PORT defaults to 3000 but can be overridden at runtime
ENV PORT=3000

# Expose port (can be overridden via PORT env var at runtime)
EXPOSE 3000

# Health check uses /health/ready endpoint and respects PORT env var
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD sh -c "curl -f http://localhost:${PORT:-3000}/health/ready || exit 1"

# Default command: run the API server
CMD ["bun", "run", "packages/server/src/index.ts"]
