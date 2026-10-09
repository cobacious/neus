# Copilot Context – Neus Backend

## Project Overview

Neus is a news aggregation platform with an emphasis on **neutrality, trust, and thoughtful consumption**. This backend service is responsible for:

- **Sourcing news articles**
- **Clustering articles** into story groups
- **Summarising stories** using neutral language
- **Extracting metadata**, including original sources, publication info, etc.
- **Persisting structured story data**

## Stack

- **Language**: TypeScript
- **Package manager**: pnpm (monorepo with workspaces)
- **Runtime**: Node.js (Serverless compatible — e.g., Vercel/Netlify functions or edge runtimes)
- **Database**: Supabase or PostgreSQL (hosted or local, TBD)
- **AI/NLP**:
  - OpenAI or Claude APIs for summarisation, clustering, and extraction
  - TBD: Lightweight local models or third-party services
- **Hosting/Infra**: Flexible — designed to be deployable on Vercel, Netlify, Railway, or Fly.io

## Project Structure

/neus
  /apps
    /api - API layer
    /engine - backend pipeline and schedulers
    /web - frontend prototype
  /packages
    /db - database utilities

Backend logic lives primarily in `apps/engine` with database helpers in `packages/db`.

## Current State & Architecture (v1 - `feat/story-angles`)

- **Multi-Angle Stories**: A `Story` acts as an overarching umbrella (e.g. *2026 Conservative Party Conference* or *Christa Pike Botched Execution*). Member `Cluster`s serve as specific story angles (`cluster.storyAngle`).
- **AI Client Abstraction**: All LLM calls route through `apps/engine/lib/aiClient.ts` with Gemini as primary (`gemini-flash-latest`), automatic fallback to OpenAI (`gpt-4o-mini`), 45s AbortSignal timeout, and structured JSON parsing.
- **Story Organization**: `apps/engine/core/pipeline/organizeStoryAngles.ts` organizes clusters into stories, disbands underpopulated stories (< 2 angles), and realigns articles across angles.
- **Frontend Presentation**: `apps/web` renders the overarching story title and macro-overview at the top of multi-angle stories, with individual angle headlines, sparklines, histograms, and articles nested underneath.
- **Brand Design System Palette**: Sourced from Coolors, Neus's core 6-color editorial palette is defined canonically in `apps/web/src/utils/palette.ts`:
  1. Blue Slate: `#4F6D7A`
  2. Burnt Peach: `#DD6E42`
  3. Ash Grey: `#B8C7B7`
  4. Thistle: `#D2BFDE`
  5. Clay Soil: `#805448`
  6. Charcoal: `#575353`
  Used across sparklines, charts, chips, angle pills, and badges. `angleColors.ts` delegates to `palette.ts`.

## Active Backlog & Workstreams

When starting a session or subagent, select from these decoupled tracks:

### Track 1: Frontend UI Polish (`apps/web`)
- [x] **"Invalid date" display bug**: Fix instances where "Invalid date" renders instead of formatted dates.
- [x] **Sparkline endpoints**: Ensure sparklines visually anchor dots at both ends (first seen and latest updated) rather than floating.
- [x] **Sparkline tooltip collision**: Prevent tooltips on closely clustered timeline markers from bunching/overlapping.
- [x] **"Breaking" status decay**: Review criteria so stories active for multiple days transition appropriately to "Developing".
- [x] **Histogram adaptive bucketing**: Dynamic 15m/30m/1h/2h/1d binning so rapid breaking news stories distribute chronologically instead of collapsing into a single 6h bar.
- [ ] **Angle summary truncation**: Remove 2-line truncation (`line-clamp-2`) on angle summaries in cluster detail view so the full summary is visible.
- [ ] **Mobile source logo flex wrapping**: In cluster card footers, ensure wrapping occurs between the article/angle count element and the source icons group, preventing source icons from breaking across lines on mobile.

### Track 2: Editorial Source Quality (`packages/db`)
- [x] **Drop The Sun**: Deactivated in both local dev and production database sources, and removed from active seed list.

### Track 3: Ranking & Taxonomy Analysis (`apps/engine`, `packages/db`)
- [ ] **Feed ranking & sorting**: Review and tune the scoring formula in `scoreCluster.ts` and `getRankedClusters.ts`. (See detailed handoff in [`docs/handoffs/ranking-algorithm-review.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/ranking-algorithm-review.md))
- [ ] **French Protests angle alignment**: Investigate article-to-angle assignments for the French education protests story. (See detailed handoff in [`docs/handoffs/french-protests-angle-grouping.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/french-protests-angle-grouping.md))

### Track 4: Pipeline Performance & Content Extraction Optimization (`apps/engine`, `packages/db`)
- [x] **Content extraction failure loop**: Stop retrying failed article URL fetches in `fillMissingContent.ts` by marking failed extractions, and cap/parallelize fetches. (See detailed handoff in [`docs/handoffs/pipeline-performance-optimization.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/pipeline-performance-optimization.md))
- [x] **Paywalled feed skip**: Mark paywalled feeds (The Times, FT, Telegraph, etc.) with a `paywalled: true` flag on `Source` (or skip list) so the extractor never attempts HTTP scraping and relies directly on RSS title/snippet.
- [x] **Unclustered lookback window**: Shorten lookback window in `getUnclusteredArticles.ts` from 7 days to 2–3 days to prevent $O(N^2)$ quadratic slowdown over 1,860+ solitary articles.

### Track 5: CI/CD & Testing Automation (`.github/workflows`)
- [ ] **PR test & build gating CI**: Add a GitHub Actions CI workflow that runs `pnpm test`, typecheck, and build on pull requests and gates merging into `main`.

## Preferences & Strict Rules

- All code in TypeScript.
- **Apps must not import from `@prisma/client` or access the Prisma client directly.** All database interactions must go through the exported helpers in `@neus/db`.
- **Database Migrations & Deployment**:
  - Migrations belong strictly in the Railway Pre-Deploy release lifecycle (`pnpm --filter @neus/db exec prisma migrate deploy`), never in routine cron pipelines.
  - Frontends (`apps/web`, `apps/admin`) only access data via the GraphQL API (`apps/api`). Any feature requiring a DB schema change inherently requires an API deployment to expose those fields.
  - Always design migrations to be **additive** (e.g. nullable columns, new tables, or default values) to guarantee zero-downtime compatibility between frontend and API deployments.
- Prefer modular, composable design.
- Avoid overengineering — move fast, iterate.
- Run `pnpm test` and `pnpm build` before committing.

---

> Copilot: If you're suggesting code, try to work within this structure. Comment your assumptions if introducing third-party packages.
