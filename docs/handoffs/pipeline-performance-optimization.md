# Handoff: Pipeline Performance & Content Extraction Optimization

## Overview & Objective

The hourly cron pipeline execution time recently escalated to **over 25 minutes**. For an hourly scheduled job, this is unsustainable and risks execution overlap, excessive database connection usage, and unnecessary compute costs.

The target runtime for the hourly pipeline is **under 3 to 5 minutes**.

This document captures the root causes identified, architectural improvements, and an actionable plan to optimize content extraction, paywall handling, and clustering lookback windows.

---

## Root Causes of the 25-Minute Runtime

### 1. `fillMissingContent` Infinite Retry Loop (~15–20 minutes)
- **File**: [`apps/engine/core/pipeline/fillMissingContent.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/fillMissingContent.ts)
- **The Defect**:
  - [`getArticlesMissingContent()`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/articles/getArticlesMissingContent.ts) queries all articles created in the last 7 days where `content` is `null` (with default `MAX_CONTENT_EXTRACTION=0`, i.e., unlimited).
  - There are currently **~250 articles** in the database with missing content. Many belong to paywalled outlets (*The Times*, *Financial Times*, *The Telegraph*) or sites that block bots (Cloudflare 403s / CAPTCHAs).
  - The loop iterates through all 250 articles **sequentially** over HTTP with a **10-second timeout** per URL:
    ```typescript
    for (const article of articles) {
      const res = await fetch(article.url, { signal: AbortSignal.timeout(10000) });
    ```
  - When an extraction fails or times out, the error is caught, but **no record of the failure is written to the database**. `article.content` remains `NULL`.
  - **Result**: On *every single hourly cron run*, the engine retries the **exact same 250 failing URLs**, burning 15–20 minutes of sequential timeouts.

### 2. Clustering Pool Accumulation (1,860 Unclustered Articles)
- **File**: [`packages/db/src/articles/getUnclusteredArticles.ts`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/articles/getUnclusteredArticles.ts)
- **The Defect**:
  - The docstring states: *"Optimization: Only fetches articles from the last 3 days to prevent O(n²) clustering comparisons from growing unbounded"*.
  - However, the default parameter was left at `daysBack: number = 7`.
  - Because `ALLOW_SINGLE_ARTICLE_CLUSTERS = false` in [`clusterArticles.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/clusterArticles.ts), solitary articles (which make up ~35-40% of all RSS news) never form clusters and remain unassigned.
  - Over 7 days, **1,860 solitary articles** accumulate.
  - Every hourly run compares all 1,850 remaining articles pairwise ($1,850 \times 1,849 / 2 \approx \mathbf{1.71\text{ million}}$ vector comparisons), re-checking articles from Monday and Tuesday that have already failed to cluster dozens of times.

---

## Action Items & Proposed Solutions

### 1. Mark Failed Content Extractions (High Priority)
- In [`fillMissingContent.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/fillMissingContent.ts):
  - If extraction throws an error or returns empty content, update `article.content = ''` (empty string) or a dedicated marker so `where: { content: null }` will **never query it again**.
  - Alternatively, add an `extractionAttempts` counter or `contentStatus: 'success' | 'failed' | 'paywalled'`.

### 2. Skip Paywalled Feeds Entirely
- **User Suggestion**: *"mark certain feeds as paywalled, i.e. do not bother trying to fetch, just use the data from RSS"*.
- In `Source`: Add an optional `paywalled: Boolean` field (or maintain a list of paywalled domains: `thetimes.com`, `ft.com`, `telegraph.co.uk`).
- When ingesting articles from these sources, skip full-text HTML scraping completely. The pipeline already falls back seamlessly to `article.snippet || article.title` for vector embedding generation.

### 3. Add Concurrency to Content Extraction
- Rather than serial `for ... of` HTTP requests, use batching or a concurrency pool (e.g. `p-limit` with concurrency 5 or chunks of 10 with `Promise.allSettled`).
- Set a sensible default limit (e.g., `MAX_CONTENT_EXTRACTION=30`) so a single run never processes hundreds of pages.

### 4. Shorten Clustering Lookback to 2–3 Days
- In [`getUnclusteredArticles.ts`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/articles/getUnclusteredArticles.ts#L16):
  - Change default `daysBack` from `7` to `2` or `3`.
  - Reduces unclustered pool from 1,860 to ~600–800 articles.
  - Cuts pairwise vector comparisons from 1.71M down to ~180k–300k, reducing clustering CPU time to < 2 seconds.

---

## Expected Impact

| Metric | Current State | After Optimizations |
| :--- | :--- | :--- |
| **`fillMissingContent` runtime** | 15–20 minutes | **10–20 seconds** |
| **Failed URLs retried per run** | ~250 failed URLs (repeated every hour) | **0** (failed URLs marked; paywalled feeds skipped) |
| **Unclustered articles queried** | 1,860 articles | **~600 articles** |
| **Pairwise cosine comparisons** | 1.71 million | **~180k** |
| **Total Pipeline Runtime** | **~25–28 minutes** | **~2.5–3.5 minutes** |
