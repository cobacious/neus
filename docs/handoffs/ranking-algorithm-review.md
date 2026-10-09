# Handoff: Feed Ranking & Sorting Algorithm Review

## Overview & Objective

This handoff document outlines the investigation, current implementation, and proposed tuning roadmap for Neus's **feed ranking and sorting algorithm**. 

The goal of the ranking engine is to surface the most relevant, neutral, and fresh stories at the top of the feed while avoiding:
1. Stale stories dominating due to historical article count.
2. Fast-breaking news being buried due to having only 2–3 initial articles.
3. Multi-angle umbrella stories being penalized compared to standalone single clusters.

---

## Current Architecture & Implementation

### 1. Scoring Formula: `apps/engine/core/pipeline/scoreCluster.ts`

Cluster scoring is executed as a dedicated step in the engine pipeline ([`scoreClusters.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/scoreClusters.ts)):

```typescript
const HOUR_MS = 1000 * 60 * 60;
const HALF_LIFE_HOURS = 72; // 3-day half-life for exponential recency decay

export function scoreCluster(cluster: ScorableCluster, now: number = Date.now()): number {
  if (!cluster.articleAssignments || cluster.articleAssignments.length === 0) return 0;

  const latest = Math.max(
    ...cluster.articleAssignments.map((a) => a.article.publishedAt.getTime())
  );
  const hoursSince = Math.max(0, (now - latest) / HOUR_MS);

  // Exponential recency decay so older clusters decay smoothly towards 0
  const recency = Math.exp(-hoursSince / HALF_LIFE_HOURS);

  const sourceIds = new Set(cluster.articleAssignments.map((a) => a.article.sourceId));
  const coverage = Math.sqrt(sourceIds.size);

  const trustScores = cluster.articleAssignments.map(
    (a) => a.article.sourceRel?.trustScore ?? 0
  );
  const avgTrust = trustScores.reduce((sum, v) => sum + v, 0) / (trustScores.length || 1);

  // Base quality score combines source coverage breadth and source trust score
  const baseScore = coverage * 0.5 + avgTrust * 0.5;

  // Final score is base quality scaled by exponential recency decay
  return baseScore * recency;
}
```

### 2. Live Feed Query: `packages/db/src/clusters/getRankedClusters.ts`

The home feed queries the database with deduplication over multi-angle stories:

```sql
SELECT id FROM (
  SELECT DISTINCT ON (COALESCE("storyId", "id"))
    id,
    score,
    "createdAt"
  FROM "Cluster"
  WHERE "headline" IS NOT NULL
    AND "headline" != ''
    AND "summary" IS NOT NULL
    AND "summary" != ''
    AND "archived" = false
  ORDER BY COALESCE("storyId", "id"), score DESC NULLS LAST, "createdAt" DESC
) sub
ORDER BY score DESC NULLS LAST, "createdAt" DESC
LIMIT $limit OFFSET $offset;
```

---

## Key Observations & Vulnerabilities

### 1. Unused `trustScore` Halves All Base Scores
- **Issue**: In `Source`, `trustScore` currently defaults to `0` across all sources in both dev and production databases.
- **Impact**: In the formula `baseScore = coverage * 0.5 + avgTrust * 0.5`, the second term evaluates to `0`. Consequently, `baseScore` is strictly `0.5 * Math.sqrt(sourceCount)`, cutting every cluster's base potential in half and rendering the trust weighting completely inactive.

### 2. Multi-Angle Story Disadvantage
- **Issue**: `getRankedClusters` ranks a story solely by `MAX(cluster.score)` among its member clusters.
- **Impact**: Suppose a major story has 20 articles across 4 angles (5 articles from 4 sources each). Each member angle has `coverage = Math.sqrt(4) = 2.0`, giving a base score of `1.0`. Meanwhile, a standalone cluster with 9 sources has `coverage = Math.sqrt(9) = 3.0` (base score `1.5`). Even though the multi-angle story represents a massive macro-event with 20 articles and widespread coverage across all sources, its feed rank cannot exceed the score of its largest individual sub-cluster.

### 3. Recency Decay Window (`HALF_LIFE_HOURS = 72`)
- **Analysis**: A 72-hour half-life means a cluster retains:
  - **79%** of its score after 24 hours.
  - **63%** of its score after 48 hours.
  - **50%** of its score after 72 hours.
- **Problem**: A 2-day-old high-volume story (e.g., 9 sources, base score `1.5` $\times 0.63 = 0.94$) will rank **above** a breaking news story published 30 minutes ago with 3 sources (`base = 0.5 * \sqrt{3} = 0.866 \times 1.0 = 0.866$). For a breaking news site, this risks the top feed feeling sluggish.

### 4. No Ingestion / Publication Velocity Factor
- **Observation**: The current formula only considers the *latest* article's timestamp (`latest = Math.max(...)`) and total unique sources. It does not measure **velocity** (e.g. how many articles were published or assigned in the last 2 to 6 hours). A story that received 1 new article today after 3 days of dormancy gets evaluated with `hoursSince ≈ 0`, rejuvenating its entire historical source count.

---

## Proposed Options & Roadmap

| Option | Description | Trade-offs | Recommended Action |
| :--- | :--- | :--- | :--- |
| **A. Fix Trust Baseline** | Set default `trustScore` to `1.0` (or `10`) for active accredited sources, or adjust `baseScore = coverage * 0.7 + avgTrust * 0.3`. | Low risk, immediate normalization. | **Phase 1** |
| **B. Multi-Angle Story Score Roll-up** | Calculate story score using total unique sources across *all* angles: `storyScore = Math.sqrt(totalUniqueStorySources) * recency`. | High reward; properly elevates rich multi-angle stories. | **Phase 1** |
| **C. Tune Half-Life (36h–48h)** | Lower `HALF_LIFE_HOURS` from `72` to `36` or `48`. | Keeps the front page fresher without dropping active developing stories. | **Phase 2** |
| **D. Breaking News Boost** | Add a multiplier ($1.25\times$) for clusters with $\ge 3$ sources where `latest` is $< 3$ hours old. | Accurately boosts breaking stories to the top of the feed. | **Phase 2** |

---

## Step-by-Step Implementation Guide for Next Agent

1. **Test Current Feed Scoring Output**:
   Run a diagnostic script to print the top 15 ranked clusters/stories with their raw components:
   ```bash
   pnpm --filter @neus/db exec tsx -e "
   import { getRankedClusters } from './src/clusters/getRankedClusters';
   async function test() {
     const clusters = await getRankedClusters(15, 0);
     for (const c of clusters) {
       console.log({ headline: c.headline?.slice(0, 45), score: c.score, sources: c.articleAssignments.length, isStory: !!c.storyId });
     }
   }
   test();"
   ```

2. **Modify `scoreCluster.ts`**:
   - Inspect [`apps/engine/core/pipeline/scoreCluster.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/scoreCluster.ts).
   - If a cluster belongs to a `Story`, compute the aggregated unique sources of the entire story or apply an angle-multiplier (e.g., $1.0 + 0.15 \times (\text{angles} - 1)$).
   - Tune `HALF_LIFE_HOURS` to 40 hours.

3. **Verify with Tests**:
   - Update tests in [`apps/engine/core/pipeline/scoreCluster.test.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/scoreCluster.test.ts).
   - Run `pnpm test core/pipeline/scoreCluster.test.ts`.
