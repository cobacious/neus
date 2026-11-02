# Neus Agent Guide & System Context

This document provides context, core operating principles and working rules for AI agents and developers working on the Neus codebase.

For the comprehensive 15-stage architectural reference, cost model and interdependent variable analysis, see [`docs/architecture/pipeline.md`](file:///Users/jwalton/Code/cobacious/neus/docs/architecture/pipeline.md).

---

## Core Operating Principles & Agent Directives

### 1. The Balancing Act: Hobby Economics vs Editorial Accuracy
Neus is an independent news aggregation platform with an emphasis on **neutrality, trust and thoughtful consumption**.

It is also an **unfunded personal hobby project**, maintained out of pocket by an individual developer, not a business or venture-backed startup.

- **The Economic Constraint**: The operational budget is strictly limited to **£5 to £10 per month** across all AI compute, cloud hosting and database infrastructure.
- **API Rate Maintenance**: AI pricing rates in [`apps/engine/lib/aiUsage.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/lib/aiUsage.ts) and [`docs/architecture/pipeline.md`](file:///Users/jwalton/Code/cobacious/neus/docs/architecture/pipeline.md) are recorded as of 16/10/2026. Check and update periodically against Google Cloud Billing and TypeSafe price sheets.
- **The Editorial Standard**: Neus requires high accuracy: clustering must separate distinct stories, multi-perspective story angles must be grouped under neutral umbrellas and summaries must be balanced and concise.
- **The Core Directive**: **Deterministic computation first; LLM completion last.**
  Never invoke an LLM for any task that can be handled using local vector mathematics (such as cosine similarity), PostgreSQL queries, regex or deterministic heuristics. When an LLM is unavoidable, prompts must be compact, batched and strictly limited to resolving genuine ambiguity. Every API token costs real personal money.

### 2. Incremental Iteration & The Law of Small Changes
Due to the tightly coupled nature of this system, **never throw large, speculative or sweeping multi-system changes into a single PR**.

When proposing or implementing changes:
- **Change one variable at a time**: Isolate changes so that downstream effects can be clearly attributed and measured.
- **Test locally with zero API cost**: Run unit tests and pipeline simulations with mocked AI responses ([`apps/engine/core/pipeline/simulation.test.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/simulation.test.ts)).
- **Measure in production**: Verify the impact against real-world production logs, checking step timings, token burn and database usage in the GitHub Actions summary tables.
- **Observe before continuing**: Monitor behavior across multiple cron cycles (24 to 48 hours) before introducing subsequent changes.

### 3. Architectural Complexity & Interdependent Variables
Neus is a delicate ecosystem of interdependent mathematical, financial and structural variables. A change to any single variable cascades through all downstream stages:

- **Clustering Similarity Threshold (`0.88`)**: Lowering it merges unrelated stories; raising it fragments stories into micro-clusters, multiplying summarization calls and database rows.
- **Story Angle Neighborhood Threshold (`0.70`)**: Connecting clusters into stories requires balancing broad coverage against runaway connected graphs.
- **Lookback Windows**: The 3-day lookback for unclustered articles prevents quadratic $O(N^2)$ slowdowns, while the 30-day cluster lookback enables ongoing story tracking without re-evaluating settled stories.
- **Retention & Purge Policies**: Solitary unclustered articles are purged after 7 days and archived clusters are pruned after 30 days to keep database storage well within Neon's 1 GB free tier.
- **Feed Scoring & Recency Decay**: The 24-hour exponential half-life in [`scoreCluster.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/scoreCluster.ts) dictates front-page turnover without letting stale breaking news crowd out developing coverage.

---

## Project Structure

```
/neus
  /apps
    /api      - GraphQL API layer (Fastify + Mercurius)
    /engine   - Pipeline processing engine, clustering, AI workers and schedulers
    /web      - Frontend React prototype (Vite + Tailwind CSS)
  /packages
    /db       - Database client, Prisma schema and exported database helpers
  /docs
    /architecture - Canonical pipeline documentation and architectural references
    /handoffs     - Task-specific handoffs and context notes
```

All backend pipeline logic lives primarily in `apps/engine` with database helpers in `packages/db`.

---

## Current State & Architecture (v1 - `feat/story-angles`)

- **Multi-Angle Stories**: A `Story` acts as an overarching umbrella (such as *2026 Conservative Party Conference* or *Christa Pike Execution*). Member `Cluster` records serve as specific story angles (`cluster.storyAngle`).
- **AI Client Abstraction**: All LLM calls route through [`apps/engine/lib/aiClient.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/lib/aiClient.ts) with `gemini-flash-lite-latest` as primary, automatic fallback to `gpt-4o-mini`, 90s AbortSignal timeout and structured JSON parsing.
- **Incremental Story Organization**: [`apps/engine/core/pipeline/organizeStoryAngles.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/organizeStoryAngles.ts) organizes clusters into stories, disbands underpopulated stories (< 2 angles), uses in-memory vector cosine similarity to assign articles locally and preserves established articles without redundant LLM calls.
- **Frontend Presentation**: `apps/web` renders the overarching story title and overview at the top of multi-angle stories, with individual angle headlines, sparklines, histograms and articles nested underneath.
- **Brand Design System Palette**: Sourced from Coolors, Neus's core 6-color editorial palette is defined canonically in [`apps/web/src/utils/palette.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/utils/palette.ts):
  1. Blue Slate: `#4F6D7A`
  2. Burnt Peach: `#DD6E42`
  3. Ash Grey: `#B8C7B7`
  4. Thistle: `#D2BFDE`
  5. Clay Soil: `#805448`
  6. Charcoal: `#575353`
  Used across sparklines, charts, chips, angle pills and badges.

---

## Active Backlog & Workstreams

Roadmap priorities, active workstream tracks and task checklists are canonically tracked in [`docs/roadmap/ROADMAP.md`](file:///Users/jwalton/Code/cobacious/neus/docs/roadmap/ROADMAP.md).

Always consult [`docs/roadmap/ROADMAP.md`](file:///Users/jwalton/Code/cobacious/neus/docs/roadmap/ROADMAP.md) and [`docs/prds/`](file:///Users/jwalton/Code/cobacious/neus/docs/prds) before selecting or beginning work on any track.

---

## Strict Development Rules & Constraints

- **Language**: All code in TypeScript.
- **Database Access Restriction**: **Apps must not import from `@prisma/client` or access the Prisma client directly.** All database interactions must go through the exported helpers in `@neus/db`.
- **Database Migrations & Deployment**:
  - Migrations belong strictly in the Railway Pre-Deploy release lifecycle (`pnpm --filter @neus/db exec prisma migrate deploy`), never in routine cron pipelines.
  - Frontends (`apps/web`, `apps/admin`) only access data via the GraphQL API (`apps/api`). Any feature requiring a DB schema change inherently requires an API deployment to expose those fields.
  - Always design migrations to be **additive** (such as nullable columns, new tables or default values) to guarantee zero-downtime compatibility between frontend and API deployments.
- **Writing & Style Restrictions**:
  - **Strictly NO Oxford commas** in any documentation, code comments, commit messages or agent communications.
  - **Strictly NO em dashes** in any documentation, code comments, commit messages or agent communications. Use colons, parentheses, semicolons or separate sentences.
  - **Clickable markdown links**: Always use markdown links with the `file://` scheme for all file paths and symbols.
- **Artifact Viewing in CLI (`agy`)**:
  - The developer operates exclusively in the `agy` CLI on macOS, not the Antigravity desktop IDE.
  - Standard markdown viewers outside the IDE cannot render ````carousel widgets, ````mermaid blocks or local absolute file paths.
  - Whenever generating or editing an artifact containing carousels, mermaid diagrams or visual media, compile an interactive companion HTML file and provide the clickable `file:///...html` link in the response so it can be opened instantly in the browser via Cmd+click or `open`.
- **Code Quality**:
  - Prefer modular, composable design.
  - Avoid overengineering: move fast, iterate incrementally.
  - Run `pnpm test` and `pnpm build` before committing.
