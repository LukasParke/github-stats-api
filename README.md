# GitHub Stats

Animated GitHub stats GIF cards for your profile, powered by [Remotion](https://remotion.dev).

<div align="center">
  <img alt="Readme Dark Gemini" width="400px" src="./out/readme-dark-gemini.gif" />
  <img alt="Commit Graph Dark Wave" width="400px" src="./out/commit-graph-dark-wave.gif" />
</div>

## Packages

This is a pnpm monorepo with two main packages:

| Package | Description |
|---------|-------------|
| [`@github-stats/remotion`](./packages/remotion) | Remotion-based GIF generator with 5 card types and multiple themes |
| [`@github-stats/server`](./packages/server) | Hono API server with GitHub App integration, Redis queue, and MinIO storage |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://docker.com/) (for local development services)

### Install Dependencies

```bash
pnpm install
```

### Local Development

**1. Start infrastructure (Redis + MinIO)**

```bash
pnpm docker:up
```

This starts:
- Redis on `localhost:6379` (job queue and caching)
- MinIO on `localhost:9000` (object storage, console at `:9001`)

**2. Start the Remotion Studio**

```bash
pnpm dev
```

Opens the Remotion preview at `http://localhost:3000`

**3. Start the API server (optional)**

```bash
# Copy the env example and configure
cp packages/server/env.example packages/server/.env

# Start the server
pnpm dev:server
```

**4. Or run everything together**

```bash
pnpm dev:all
```

### Render GIFs

```bash
# Render all compositions
pnpm render:all

# Render specific composition
pnpm render -- readme-dark-gemini
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Remotion Studio |
| `pnpm dev:server` | Start API server |
| `pnpm dev:worker` | Start background render worker |
| `pnpm dev:all` | Start all services concurrently |
| `pnpm render` | Render a composition |
| `pnpm render:all` | Render all compositions |
| `pnpm docker:up` | Start Redis + MinIO |
| `pnpm docker:down` | Stop infrastructure |
| `pnpm docker:logs` | View infrastructure logs |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type check all packages |
| `pnpm clean` | Clean all node_modules |

## Cards

| Card | Variants | Description |
|------|----------|-------------|
| **Readme** | `readme-{dark,light}-{gemini,waves}` | Main stats with animated background |
| **Commit Streak** | `commit-streak-{dark,light}` | Current and longest streak with aurora effect |
| **Top Languages** | `top-languages-{dark,light}` | Language breakdown with animated bars |
| **Contribution** | `contribution-{dark,light}` | Activity overview with beam effects |
| **Commit Graph** | `commit-graph-{dark,light}-{wave,rain,cascade}` | GitHub-style contribution grid |

## API Server

The server provides:

- **GitHub App Integration** — Install the app to automatically generate stats cards
- **Webhook Handlers** — Triggers renders on installation and updates
- **REST API** — Request renders and serve cached images
- **Background Workers** — Process render jobs with BullMQ

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/image/:username/:composition` | Get rendered GIF |
| `POST /api/render` | Request a new render |
| `GET /api/status/:jobId` | Check render job status |
| `GET /api/compositions` | List available compositions |

## Production Deployment

Deploy with Docker Compose or Dokploy:

```bash
cp env.example .env
docker compose up -d
```

See [`docker-compose.yml`](./docker-compose.yml) for the full production stack.

## Project Structure

```
├── packages/
│   ├── remotion/          # GIF generator
│   │   ├── src/
│   │   │   ├── components/  # Card and effect components
│   │   │   ├── data/        # Stats fetchers
│   │   │   ├── lib/         # Utilities
│   │   │   └── styles/      # Global CSS
│   │   └── public/          # Static assets
│   │
│   └── server/            # API server
│       └── src/
│           ├── config/      # Environment config
│           ├── routes/      # API routes
│           ├── services/    # Business logic
│           └── workers/     # Background jobs
│
├── docker-compose.yml     # Production stack
├── docker-compose.dev.yml # Local development
└── pnpm-workspace.yaml    # Workspace config
```

## License

See [LICENSE](./LICENSE) for details.
