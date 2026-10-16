# Neus Agent Guide & System Context

This document provides context, core operating principles and working rules for AI agents and developers working on the Neus codebase.

For the comprehensive 15-stage architectural reference, cost model and interdependent variable analysis, see [`docs/architecture/pipeline.md`](file:///Users/jwalton/Code/cobacious/neus/docs/architecture/pipeline.md).

---

## Core Operating Principles & Agent Directives

### 1. The Balancing Act: Hobby Economics vs Editorial Accuracy
Neus is an independent news aggregation platform with an emphasis on **neutrality, trust and thoughtful consumption**.

It is also an **unfunded personal hobby project**, maintained out of pocket by an individual developer, not a business or venture-backed startup.

- **The Economic Constraint**: The operational budget is strictly limited to **£5 to £10 per month** across all AI compute, cloud hosting and database infrastructure.
- **API Rate Maintenance**: AI pricing rates in [`apps/engine/lib/aiUsage.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/lib/aiUsage.ts) and [`docs/architecture/pipeline.md`](file:///Users/jwalton/Code/cobacious/neus/docs/architecture/pipeline.md) are recorded as of 16/10/2026. Check and update periodically against Google Cloud Billing and OpenAI price sheets.
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

When starting a session or subagent, select from these decoupled tracks:

### Track 1: Frontend UI Polish (`apps/web`)
- [x] **"Invalid date" display bug**: Fix instances where "Invalid date" renders instead of formatted dates.
- [x] **Sparkline endpoints**: Ensure sparklines visually anchor dots at both ends (first seen and latest updated) rather than floating.
- [x] **Sparkline tooltip collision**: Prevent tooltips on closely clustered timeline markers from bunching or overlapping.
- [x] **"Breaking" status decay**: Review criteria so stories active for multiple days transition appropriately to "Developing".
- [x] **Histogram adaptive bucketing**: Dynamic binning (15m/30m/1h/2h/1d) so breaking news stories distribute chronologically.
- [x] **Angle summary truncation**: Remove 2-line truncation (`line-clamp-2`) on angle summaries in cluster detail view so the full summary is visible.
- [x] **Card footer layout & source wrap**: Reorder card footer with source logos first, `justify-between` article count and 8-icon limit.
- [x] **About Page & Footer Navigation**: Created About page, hamburger drawer menu, persistent site footer, public-code licensing disclaimer and retired BetaBanner.
- [x] **Open Graph & Social Previews**: Added serverless crawler handler for cluster pages, branded 1200x630 `og-image.png`, `summary_large_image` Twitter cards and dynamic document titles.
- [ ] **Story Angle Filtering / Jump Links**: In cluster detail and card views, support filtering articles by angle or making angle pills act as jump links to that angle's section.

### Track 2: Editorial Source Quality (`packages/db`)
- [x] **Drop The Sun**: Deactivated in both local dev and production database sources and removed from active seed list.
- [x] **Google Favicon CDN migration**: Migrated `Source.faviconUrl` from `icon.horse` to Google's public Favicon CDN with defensive `<SourceFavicon>` fallback.

### Track 3: Ranking & Taxonomy Analysis (`apps/engine`, `packages/db`)
- [ ] **Feed ranking & sorting**: Review and tune the scoring formula in [`scoreCluster.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/scoreCluster.ts) and [`getRankedClusters.ts`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/clusters/getRankedClusters.ts). (See handoff in [`docs/handoffs/ranking-algorithm-review.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/ranking-algorithm-review.md)).
- [ ] **French Protests angle alignment**: Investigate article-to-angle assignments for the French education protests story. (See handoff in [`docs/handoffs/french-protests-angle-grouping.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/french-protests-angle-grouping.md)).

### Track 4: Pipeline Performance & Cost Optimization (`apps/engine`, `packages/db`)
- [x] **Content extraction failure loop**: Stop retrying failed article URL fetches in `fillMissingContent.ts` by marking failed extractions and cap/parallelize fetches.
- [x] **Paywalled feed skip**: Mark paywalled feeds with a `paywalled: true` flag on `Source` so the extractor never attempts HTTP scraping.
- [x] **Unclustered lookback window**: Shorten lookback window in `getUnclusteredArticles.ts` from 7 days to 3 days to prevent $O(N^2)$ quadratic slowdown.
- [x] **Article extractor DOMException fix**: Dropped `exclusiveFilter` function in `setSanitizeHtmlOptions` which threw `DataCloneError` under structured clone.
- [x] **Batch embeddings & parallel summaries**: Gemini `batchEmbedContents` (up to 100 per call) and `mapConcurrent(clusters, 3)` for summaries.
- [x] **Settled neighborhood skip**: Skip inactive candidate neighborhoods (< 48h) in `organizeStoryAngles.ts` before calling Gemini.
- [x] **Article angle classification pre-filtering**: Use in-memory vector cosine similarity and incremental preservation to resolve article angles with minimal LLM calls.

### Track 5: CI/CD & Testing Automation (`.github/workflows`)
- [ ] **PR test & build gating CI**: Add a GitHub Actions CI workflow that runs `pnpm test`, typecheck and build on pull requests and gates merging into `main`.

### Track 6: Admin Editorial & Cluster Management (`apps/admin`, `apps/api`)
- [ ] **Cluster browser and search**: List, filter and search active clusters across environments.
- [ ] **Cluster merge and story grouping**: Support merging duplicate clusters and grouping related clusters into story umbrellas with distinct angles. (See handoff in [`docs/handoffs/admin-cluster-management.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/admin-cluster-management.md)).
- [ ] **Yorkshire tiger incident consolidation**: Merge the two separate Yorkshire tiger enclosure clusters into one story umbrella. (See handoff in [`docs/handoffs/yorkshire-tiger-story-merge.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/yorkshire-tiger-story-merge.md)).

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
- **Code Quality**:
  - Prefer modular, composable design.
  - Avoid overengineering: move fast, iterate incrementally.
  - Run `pnpm test` and `pnpm build` before committing.
