# PRD-001: Pipeline Freshness & Last Updated Metadata

- **Identifier**: `PRD-001`
- **Priority**: P1 (Immediate Delivery)
- **Status**: Completed
- **Target Packages**: `packages/db`, `apps/api`, `apps/web`
- **Target Personas**: System Maintainer (Debugging Aid), Curious Reader
- **Estimated Effort**: Small (~1 hour)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
Neus runs automated background pipeline passes on an external cron schedule. During quiet news cycles (such as weekend afternoons or overnight hours), incoming news volume drops and front-page headlines remain stable. Without timestamp metadata, the maintainer cannot immediately confirm whether the pipeline executed as scheduled or whether an ingestion process failed without opening GitHub Actions or database consoles.

### 1.2 The Solution
Expose pipeline execution timestamps through the GraphQL API and render a subtle, static relative timestamp string (e.g. "Updated 18m ago") at the bottom of the persistent footer ([`apps/web/src/components/Footer.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/Footer.tsx)). 

This serves as a lightweight debugging aid without cluttering the primary header, adding prominent UI elements or distracting from editorial content.

---

## 2. User Stories

1. **Maintainer Quick Check**:
   * *As a* maintainer visiting the site,
   * *I want to* check the bottom of the footer,
   * *So that* I can quickly confirm when the background ingestion pipeline last executed without opening GitHub Actions.

2. **Unobtrusive Feed Context**:
   * *As a* reader exploring the site,
   * *I want* freshness metadata to stay tucked away in the micro-footer,
   * *So that* the main reading experience remains clean and distraction-free.

---

## 3. Technical Architecture & Component Changes

```
┌────────────────────────┐      ┌─────────────────────────┐      ┌────────────────────────┐
│      packages/db       │ ───► │        apps/api         │ ───► │        apps/web        │
│  getPipelineStatus()   │      │  pipelineStatus query   │      │  LastUpdated (Footer)  │
└────────────────────────┘      └─────────────────────────┘      └────────────────────────┘
```

### 3.1 Database Package (`packages/db`)
- **Current State**: [`packages/db/src/clusters/getLatestPipelineRunTime.ts`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/clusters/getLatestPipelineRunTime.ts) selects the latest `Cluster.createdAt`. If a run ingests articles and updates existing clusters without generating a brand new cluster, `Cluster.createdAt` does not change.
- **Enhancement**: Update `getLatestPipelineRunTime()` to return the maximum timestamp across:
  1. Latest `Cluster.createdAt`
  2. Latest `Article.createdAt`
  3. Latest active `Source.lastFetchedAt`
  This accurately reflects the most recent pipeline sweep.

### 3.2 GraphQL API Layer (`apps/api`)
- **Schema Addition** in [`apps/api/schema.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/api/schema.ts):
  ```graphql
  type PipelineStatus {
    lastRunAt: Float!       # Unix epoch millisecond timestamp
    lastRunIso: String!     # ISO 8601 string
    activeClusters: Int!
    totalArticles: Int!
  }

  extend type Query {
    pipelineStatus: PipelineStatus!
  }
  ```
- **Caching**: Wrap with in-memory LRU cache (`cache.ts`) with a 60-second TTL to avoid redundant database reads while reflecting new pipeline completions promptly.

### 3.3 Frontend Web Layer (`apps/web`)
- **Placement**: Implemented in [`apps/web/src/components/LastUpdated.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/LastUpdated.tsx) and rendered inside the persistent footer ([`apps/web/src/components/Footer.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/Footer.tsx)).
- **Styling & Rendering**:
  - Rendered as a simple, static relative text string (e.g. `Updated 18m ago`) at the bottom of the persistent footer.
  - Styled with minimal footprint: `text-xs text-neutral-400`.
  - Self-contained query and `useEffect` lifecycle hook using the `pipelineStatus.lastRunAt` query result.
  - No pulsing dots, no color transitions, no hover tooltips and no header presence.

---

## 4. Financial & Performance Budget Impact

- **Database Compute**: Single indexed query using `max(createdAt)` on `Article` (utilizing existing `Article_createdAt_idx`). Query evaluates in under 1ms.
- **Bandwidth**: Minimal JSON payload (< 100 bytes). Zero impact on Neon egress quotas.
- **AI Token Burn**: $0.00.

---

## 5. Acceptance Criteria

- [x] **GIVEN** the GraphQL API is running, **WHEN** querying `{ pipelineStatus { lastRunAt lastRunIso } }`, **THEN** it returns a valid recent timestamp matching the latest database activity.
- [x] **GIVEN** a user scrolls to the bottom of any page, **WHEN** viewing the persistent footer ([`Footer.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/Footer.tsx)), **THEN** a minimal static string (e.g. "Updated 18m ago") is rendered using `text-xs text-neutral-400`.
- [x] **GIVEN** the site header and feed cards, **WHEN** inspected, **THEN** zero freshness indicators, badges or pulsing dots are present.
- [x] **GIVEN** test suites execute (`pnpm test` and `pnpm build`), **THEN** all tests and builds pass with zero regressions.

---

## 6. Test & Verification Plan

1. **Unit Tests**:
   - Test fallback resolution in `getLatestPipelineRunTime()`.
   - Test GraphQL `pipelineStatus` resolver and cache behavior in `apps/api`.
2. **Visual Inspection**:
   - Inspect the footer on mobile and desktop viewports to verify that `text-xs text-neutral-400` styling blends cleanly into the bottom copyright row.
