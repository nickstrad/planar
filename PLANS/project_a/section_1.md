# A1 — Project Setup & Baseline (Shared Infrastructure)

> This section defines shared infrastructure used by all projects.

## A1.1 Initialize Next.js App Router project ✓

- [x] **A1.1.1 Create repo + initial commit**
      Initialize git, add `.gitignore`, and commit the baseline.

- [x] **A1.1.2 Scaffold Next.js (App Router + TypeScript)**
      Create the app with App Router, TypeScript, and basic linting enabled.

- [x] **A1.1.3 Verify local dev loop**
      Run the dev server and confirm the home page loads correctly.

- [x] **A1.1.4 Add core npm scripts**
      Ensure `dev`, `build`, `start`, `lint`, and `typecheck` scripts exist and run.

- [x] **A1.1.5 Pin Node and package manager**
      Add `.nvmrc` or `.node-version` and set the `packageManager` field in `package.json`.

---

## A1.2 Environment management ✓

- [x] **A1.2.1 Create `.env.example`**
      Include `DATABASE_URL`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`, and any required auth secrets.

- [x] **A1.2.2 Secure local environment config**
      Add `.env.local` to `.gitignore` and document setup steps in `README.md`.

- [x] **A1.2.3 Add runtime env validation**
      Create a server-only env module that validates required variables at startup.

- [x] **A1.2.4 Enforce server-only secret access**
      Ensure secrets are never imported into client components.

- [x] **A1.2.5 Document Neon environment usage**
      Document how Neon branching and environments map to local/dev/prod workflows.

---

## A1.3 PostgreSQL via Neon (Prisma) ✓

- [x] **A1.3.1 Create Neon project and database**
      Provision a Neon database and obtain the connection string.

- [x] **A1.3.2 Configure `DATABASE_URL`**
      Add the Neon connection string to `.env.local`.

- [x] **A1.3.3 Install Prisma and Prisma Client**
      Add `prisma` and `@prisma/client` dependencies.

- [x] **A1.3.4 Initialize Prisma schema**
      Create `schema.prisma` with datasource and generator blocks.

- [x] **A1.3.5 Run initial migration against Neon**
      Apply the first migration to verify end-to-end DB connectivity.

- [x] **A1.3.6 Add Prisma client wrapper**
      Create a Next.js-safe Prisma client singleton.

- [x] **A1.3.7 Add DB connectivity smoke test**
      Add a temporary tRPC procedure or API route that performs a trivial query.

- [x] **A1.3.8 Document Prisma + Neon workflow**
      Document migration and deployment expectations for Neon-backed Prisma.

---

## A1.4 tRPC setup (App Router compatible) ✓

- [x] **A1.4.1 Install tRPC and React Query dependencies**
      Add `@trpc/server`, `@trpc/client`, `@trpc/react-query`, and React Query.

- [x] **A1.4.2 Create tRPC server scaffolding**
      Implement `initTRPC`, base context, and a root router.

- [x] **A1.4.3 Add tRPC App Router handler**
      Create `/app/api/trpc/[trpc]/route.ts` to expose the tRPC endpoint.

- [x] **A1.4.4 Add tRPC + React Query providers**
      Wire providers into the root layout or a dedicated provider component.

- [x] **A1.4.5 Add a hello-world tRPC procedure**
      Confirm end-to-end client/server wiring.

- [x] **A1.4.6 Add a DB-backed tRPC procedure**
      Validate Prisma access through tRPC.

- [x] **A1.4.7 Standardize input validation**
      Use Zod schemas for all tRPC inputs.

---

## A1.5 shadcn/ui and styling baseline ✓

- [x] **A1.5.1 Install and configure Tailwind CSS**
      Verify Tailwind builds and styles load correctly.

- [x] **A1.5.2 Initialize shadcn/ui**
      Run `shadcn init` and configure paths and aliases.

- [x] **A1.5.3 Install baseline UI components**
      Add core components (button, input, card, dialog, tabs, toast).

- [x] **A1.5.4 Configure global styles**
      Set up `globals.css`, typography defaults, and base layout styles.

---

## A1.6 Baseline quality and repo hygiene

- [x] **A1.6.1 Add Prettier and formatting rules**
      Ensure consistent formatting across TS/TSX/MD files.

- [x] **A1.6.2 Enable strict TypeScript settings**
      Confirm `typecheck` passes with strict mode enabled.

- [x] **A1.6.3 Add minimal README**
      Document setup, env vars, Prisma migrations, and how to run the app.

- [x] **A1.6.4 Add basic CI workflow (optional)**
      Add GitHub Actions for lint, typecheck, and build.
