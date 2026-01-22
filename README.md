# Planar

A tenant-aware, streaming-first AI inference platform that routes requests across multiple providers with cost awareness, policy enforcement, and comprehensive observability.

## Overview

Planar is an **AI inference platform** designed to:

- **Route inference requests** across multiple providers (OpenAI, Anthropic, Gemini, Ollama, llama.cpp, MLX)
- **Stream responses** in real-time via Server-Sent Events (SSE)
- **Enforce tenant isolation** with quotas and rate limiting
- **Optimize costs** through intelligent routing strategies
- **Provide observability** with metrics, tracing, and structured logging

It is not a chatbot UI or training system — it's an **inference kernel** that other products, UIs, or APIs can build on.

### System Architecture

```
[ Client / SDK / UI ]
          ↓
[ Gateway: API & Tenant Layer ]
          ↓
[ Router: Cost & Policy Engine ]
          ↓
[ Runtime: Core Inference Execution ]
          ↓
[ Model Backends ]
```

## Installation

### Prerequisites

- Node.js 22+
- PostgreSQL database (Neon recommended)
- npm

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd planar

# Install dependencies
npm install

# Set up environment (see Environment section below)
cp .env.development .env

# Initialize the database
make db/reset

# Start development server
npm run dev
```

## Project Plan

This project is **plan-driven development** — implementation is guided by structured markdown files in the `PLANS/` directory.

### PLANS Structure

```
PLANS/
├── OVERVIEW.md           # Master project breakdown — start here
├── project_a/            # Core Inference Runtime
│   ├── architecture.md   # What Project A owns and doesn't own
│   └── section_1-8.md    # Implementation tasks
├── project_b/            # Model Router & Cost Engine
├── project_c/            # Inference Gateway (API & Tenants)
├── project_c2/           # Inference Playground (UI)
├── project_d/            # Observability & Telemetry
└── project_f/            # Platformization & Monetization
```

### How It Works

1. **Read `PLANS/OVERVIEW.md`** to understand the full system
2. **Each project** has clear ownership boundaries (what it does and does NOT do)
3. **Sections** contain checkbox tasks that track implementation progress
4. **Architecture files** define interfaces between projects

Before implementing any feature, check which project owns it and follow that project's architecture constraints.

## Skills

This project uses **Claude Code skills** to accelerate development. Key skills available:

- `architect` — Architectural guidance for implementing features
- `better-auth-best-practices` — Better Auth integration patterns
- `frontend-design` — Production-grade UI implementation
- `vercel-react-best-practices` — React/Next.js performance optimization

Invoke skills in Claude Code with `/<skill-name>` (e.g., `/architect`).

## Environment

Create a `.env` file in the root directory. Use `.env.development` as a template.

### Required Variables

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://..."

# Authentication (Better Auth)
BETTER_AUTH_SECRET="<generate with: openssl rand -base64 32>"
BETTER_AUTH_URL="http://localhost:3000"

# OAuth (optional for development)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Public
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Server-Side Validation

Environment variables are validated at startup using Zod in `src/lib/env/server.ts`. This module:

- **Validates required variables** — fails fast if configuration is missing
- **Enforces server-only access** — uses `server-only` package to prevent client imports
- **Provides typed access** — `import { env } from '@/lib/env/server'`

To add new environment variables, update the schema in `src/lib/env/server.ts`.

### Adding Inference Providers

As you implement inference adapters, add their API keys to the env schema:

```typescript
// In src/lib/env/server.ts
const serverEnvSchema = z.object({
  // ... existing vars
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
});
```

## Development

```bash
npm run dev        # Start Next.js dev server
npm run dev:all    # Start all processes (uses mprocs)
npm run build      # Production build
npm run lint       # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (Neon) + Prisma ORM
- **API**: tRPC for type-safe endpoints
- **Auth**: Better Auth
- **UI**: shadcn/ui + Tailwind CSS 4
- **Streaming**: Server-Sent Events (SSE)
