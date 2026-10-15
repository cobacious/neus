# Pipeline Optimization & Cost Monitoring Handoff

## Context & Problem Statement
* **Symptoms**:
  - Scheduled pipeline runs exceeded GitHub Actions' 30-minute limit and were cancelled.
  - Gemini API spend reached £10.80 over 7 days (and drained an additional £7 in recent hours).
  - OpenAI API usage occurred due to client-side timeouts.
  - Neon Postgres compute reached $0.57 because pipeline cancellations prevented retention and purge steps (steps 10-15) from deleting the 2,743+ unclustered solitary articles.

## Root Causes Identified
1. **Article Embeddings (Saved ~11.8 min)**:
   - Articles were embedded sequentially with a legacy 1.2s sleep between each call.
   - Solved with Gemini native `batchEmbedContents` (up to 100 per call) and sleep removal.
2. **Cluster Summarization (Saved ~3.2 min)**:
   - Summaries were generated sequentially with a 1.2s delay.
   - Solved with `mapConcurrent(clusters, 3)` and sleep removal.
3. **OpenAI Fallback Trigger**:
   - `AbortSignal.timeout(45000)` prematurely aborted long Gemini responses.
   - Solved by extending timeout to 90s.
4. **Organize Step Neighborhood Loop (The 25-Minute Bottleneck)**:
   - `organizeStoryAngles.ts` fetched 743 clusters spanning 30 days and evaluated 69 candidate neighborhoods.
   - The existing `isSettledNeighborhood` function had early returns for clusters without `storyId` or with cluster count mismatches *above* the date checks.
   - Consequently, ~65 inactive candidate neighborhoods from weeks ago were treated as unsettled and sent to Gemini every 4 hours, and large stories (like *Death Penalty Executions*) reclassified 104 articles in 5 sequential batches.
   - Fixed by adding a top-level `hasRecentActivity` check (< 48h) that immediately skips inactive neighborhoods before calling Gemini.

## Commits Pushed to `main`
1. [`456e7ed`](https://github.com/cobacious/neus/commit/456e7ed): `perf(engine): optimize article embeddings and cluster summarization`
   - Added `generateEmbeddingsBatch` in `aiClient.ts`
   - Increased client timeout to 90s
   - Removed 1.2s sleeps from embeddings and summaries
   - Parallelized cluster summarization with `mapConcurrent`
2. [`53e3a03`](https://github.com/cobacious/neus/commit/53e3a03): `perf(engine): skip inactive cluster neighborhoods in organizeStoryAngles`
   - Added top-level `hasRecentActivity` check (< 48h) for candidate neighborhoods in `organizeStoryAngles.ts`
   - Preserves full 30-day lookback for discovering new developments on older stories while skipping static groups.

## Active Run
- Run ID: [`38640200922`](https://github.com/cobacious/neus/actions/runs/38640200922)

## Next Session Priorities
1. **Pipeline Simulation Test Suite (Top Priority)**:
   - Export a real cluster topology snapshot into `apps/engine/fixtures/production-cluster-topology.json`.
   - Run pipeline organization tests against this real fixture with mocked AI APIs to prove execution times (< 2s) and assert minimal Gemini call counts (< 10) deterministically without spending API credits.
2. **Morning Email Digest**:
   - Create a daily summary job (via Resend API) delivering:
     - 24-hour pipeline success/issues summary
     - Total spend for last day
     - Total spend month-to-date
     - Forecasted monthly spend
   - Store run metrics in a lightweight Postgres table (`PipelineRun`) for private historical tracking.
3. **Unstaged Workspace UI Work**:
   - `apps/web/src/components/Header.tsx` and `apps/web/src/components/Logo.tsx` remain unstaged with the logo and header height refinement.
