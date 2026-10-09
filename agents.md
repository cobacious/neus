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

### Track 2: Editorial Source Quality (`packages/db`)
- [ ] **Drop The Sun**: Deactivate or remove *The Sun* from active RSS feeds and seed lists.

### Track 3: Ranking & Taxonomy Analysis (`apps/engine`, `packages/db`)
- [ ] **Feed ranking & sorting**: Review and tune the scoring formula in `scoreCluster.ts` and `getRankedClusters.ts`.
- [ ] **French Protests angle alignment**: Investigate article-to-angle assignments for the French education protests story.

## Preferences & Strict Rules

- All code in TypeScript.
- **Apps must not import from `@prisma/client` or access the Prisma client directly.** All database interactions must go through the exported helpers in `@neus/db`.
- Prefer modular, composable design.
- Avoid overengineering — move fast, iterate.
- Run `pnpm test` and `pnpm build` before committing.

---

> Copilot: If you're suggesting code, try to work within this structure. Comment your assumptions if introducing third-party packages.
