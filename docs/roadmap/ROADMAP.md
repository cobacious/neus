# Neus Engineering & Product Roadmap

This document serves as the canonical, living roadmap for Neus. It tracks the prioritized delivery sequence, functional workstream tracks and links to detailed Product Requirement Documents (PRDs) stored in [`docs/prds/`](file:///Users/jwalton/Code/cobacious/neus/docs/prds).

- **Last Updated**: 4 November 2026
- **Current Active Focus**: [`PRD-004`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-004-story-view-faceted-filtering.md) (Faceted Story View Filtering)

---

## Operating Framework: Roadmap-as-Code

Neus uses **Roadmap-as-Code** (in-repo product management) instead of disconnected third-party tools like Trello, Jira or GitHub Projects.

### Why In-Repo Management?
1. **Single Source of Truth**: Roadmap state is co-located with code and tracked under Git version control.
2. **AI Agent Transparency**: AI coding assistants and autonomous subagents have immediate, native access to full PRDs, acceptance criteria and architectural constraints without external API tokens or browser context switching.
3. **Atomic Verification**: Tasks transition from `[ ]` to `[x]` within the exact same commit and pull request that introduces the code and tests.
4. **Hobby Economics**: $0 recurring cost, zero vendor lock-in and zero maintenance overhead.

---

## Prioritized Product Queue

Items are ranked in execution order based on reader trust impact, mobile usability, architectural dependency sequencing and the strict £5 to £10 monthly infrastructure constraint.

| Rank | Identifier | Title | Target Scope | Effort | Status | Canonical PRD |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P1** | `PRD-001` | **Pipeline Freshness & Last Updated Metadata** | `apps/api`, `apps/web` | Small (~1h) | Completed | [`PRD-001-pipeline-freshness-metadata.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-001-pipeline-freshness-metadata.md) |
| **P2** | `PRD-002` | **Sparkline Touch Scrubber & Latched Tooltip Deep Linking** | `apps/web` | Medium (~3-4h) | Completed | [`PRD-002-sparkline-touch-scrubber.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-002-sparkline-touch-scrubber.md) |
| **P3** | `PRD-003` | **Topic Taxonomy & Multi-Tagging (TypeSafe Jev)** | `apps/engine`, `packages/db`, `apps/api`, `apps/web` | Medium | Completed | [`PRD-003-topic-taxonomy-and-verticals.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-003-topic-taxonomy-and-verticals.md) |
| **P4** | `PRD-004` | **Faceted Story View Filtering (Outlet, Date & Topic)** | `apps/web` | Medium | Backlog | [`PRD-004-story-view-faceted-filtering.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-004-story-view-faceted-filtering.md) |
| **P5** | `PRD-005` | **Native PostgreSQL Full-Text Search** | `packages/db`, `apps/api`, `apps/web` | Medium | Backlog | [`PRD-005-postgresql-full-text-search.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-005-postgresql-full-text-search.md) |
| **P6** | `PRD-006` | **Editorial Dark Theme System** | `apps/web` | Medium | Backlog | [`PRD-006-dark-theme-system.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-006-dark-theme-system.md) |
| **P7** | `PRD-007` | **Admin Editorial Cluster Browser & Merge UI** | `apps/admin`, `apps/api` | Large | Backlog | [`docs/handoffs/admin-cluster-management.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/admin-cluster-management.md) |
| **P8** | `PRD-008` | **French Education Protests Story Angle Calibration** | `apps/engine` | Small | Backlog | [`docs/handoffs/french-protests-angle-grouping.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/french-protests-angle-grouping.md) |

---

## Decoupled Workstream Tracks

When starting a session or subagent, select from these decoupled tracks:

### Track 1: Reader UX & Frontend Polish (`apps/web`)
- [x] **"Invalid date" display bug**: Fix instances where "Invalid date" renders instead of formatted dates.
- [x] **Sparkline endpoints**: Ensure sparklines visually anchor dots at both ends (first seen and latest updated) rather than floating.
- [x] **Sparkline tooltip collision**: Prevent tooltips on closely clustered timeline markers from bunching or overlapping.
- [x] **"Breaking" status decay**: Review criteria so stories active for multiple days transition appropriately to "Developing".
- [x] **Histogram adaptive bucketing**: Dynamic binning (15m/30m/1h/2h/1d) so breaking news stories distribute chronologically.
- [x] **Angle summary truncation**: Remove 2-line truncation (`line-clamp-2`) on angle summaries in cluster detail view so the full summary is visible.
- [x] **Card footer layout & source wrap**: Reorder card footer with source logos first, `justify-between` article count and 8-icon limit.
- [x] **About Page & Footer Navigation**: Created About page, hamburger drawer menu, persistent site footer, public-code licensing disclaimer and retired BetaBanner.
- [x] **Story Angle Filtering & Navigation**: Interactive angle pills, mobile-friendly segmented filter tabs, URL synchronization (`?angle=<id>`), progressive disclosure (10 articles with expander) and newest-first chronological sorting.
- [x] **Feed card thread pill linking & auto-scroll**: Replaced card `<Link>` with `<article>` stretched-link pattern, wired thread pills to `${storyUrl}?thread=${thread.id}#articles-coverage` and added auto-scrolling to the active thread section.
- [x] **Surface pipeline "Last Updated" metadata** ([`PRD-001`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-001-pipeline-freshness-metadata.md)): Expose `pipelineStatus` in GraphQL, update `getLatestPipelineRunTime` across clusters, articles and active sources and display a discreet relative timestamp string ("Updated 18m ago") via `<LastUpdated />` in the persistent footer.
- [x] **Sparkline touch scrubber & latched tooltip deep linking** ([`PRD-002`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-002-sparkline-touch-scrubber.md)): Unified Pointer Event scrub track (44px), cluster-aware drag resolution and latched tooltip deep linking to article anchors.
- [ ] **Enhanced filtering on story view** ([`PRD-004`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-004-story-view-faceted-filtering.md)): Expand `/story/[slug]` controls to group, sort and filter articles across multiple facets: outlet/publication, chronological date order and topic.
- [ ] **Dark theme** ([`PRD-006`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-006-dark-theme-system.md)): Implement system preference detection (`prefers-color-scheme`) and manual theme toggle in drawer with dark mode tokens for the 6-color editorial palette, cards, charts and contrast ratios.

### Track 2: Editorial Source Quality (`packages/db`)
- [x] **Drop The Sun**: Deactivated in both local dev and production database sources and removed from active seed list.
- [x] **Drop Daily Express**: Deactivated due to low editorial quality and high-frequency clickbait headline spam; removed from active seed list.
- [x] **Google Favicon CDN migration**: Migrated `Source.faviconUrl` from `icon.horse` to Google's public Favicon CDN with defensive `<SourceFavicon>` fallback.

### Track 3: Ranking & Taxonomy Analysis (`apps/engine`, `packages/db`)
- [x] **Feed ranking & sorting**: Implemented consensus recency to defeat single-source recency hijacking, enforced multi-source cluster gating (`uniqueSources >= 2`), activated canonical source trust scores, archived 292 legacy single-source/deactivated spam clusters and re-scored all active clusters with zero LLM API cost. (See [`docs/handoffs/ranking-algorithm-review.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/ranking-algorithm-review.md)).
- [x] **Topic taxonomy & multi-tagging (TypeSafe Jev)** ([`PRD-003`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-003-topic-taxonomy-and-verticals.md)): Implemented 9 controlled topic tags (`uk`, `world`, `politics`, `business`, `tech_science`, `environment`, `society`, `sport` and `culture`) using TypeSafe Jev calibrated choice distributions ($p \ge 0.25$), GIN indexed array containment, GraphQL tag filtering, card overline topic eyebrows, mobile thumb-zone dismissible filter pill and slide-over drawer navigation.
- [ ] **French Protests angle alignment** ([`PRD-008`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/french-protests-angle-grouping.md)): Investigate article-to-angle assignments for the French education protests story. (See handoff in [`docs/handoffs/french-protests-angle-grouping.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/french-protests-angle-grouping.md)).

### Track 4: Pipeline Performance & Cost Optimization (`apps/engine`, `packages/db`)
- [x] **Content extraction failure loop**: Stop retrying failed article URL fetches in `fillMissingContent.ts` by marking failed extractions and cap/parallelize fetches.
- [x] **Paywalled feed skip**: Mark paywalled feeds with a `paywalled: true` flag on `Source` so the extractor never attempts HTTP scraping.
- [x] **Unclustered lookback window**: Shorten lookback window in `getUnclusteredArticles.ts` from 7 days to 3 days to prevent $O(N^2)$ quadratic slowdown.
- [x] **Article extractor DOMException fix**: Dropped `exclusiveFilter` function in `setSanitizeHtmlOptions` which threw `DataCloneError` under structured clone.
- [x] **Batch embeddings & parallel summaries**: Gemini `batchEmbedContents` (up to 100 per call) and `mapConcurrent(clusters, 3)` for summaries.
- [x] **Settled neighborhood skip**: Skip inactive candidate neighborhoods (< 48h) in `organizeStoryAngles.ts` before calling Gemini.
- [x] **Article angle classification pre-filtering**: Use in-memory vector cosine similarity and incremental preservation to resolve article angles with minimal LLM calls.
- [x] **TypeSafe System One editorial decision engine**: Integrated Jev `1.14.0` for cluster deduplication (`Noul`), story saga formation (`Noul`) and article-to-thread classification (`Choice`), reducing organize step costs by ~90% and latency to ~58ms with zero Gemini decision fallbacks.
- [x] **Pulse Sentinel continuous ingestion & tri-trigger policy**: Built continuous zero-cost RSS feed watcher in [`apps/api/pulse.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/api/pulse.ts) and [`packages/db`](file:///Users/jwalton/Code/cobacious/neus/packages/db) with breaking surge, batch accumulation and heartbeat staleness policies; currently shadow testing in preview sandbox. (See [`docs/handoffs/pulse-sentinel-architecture.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/pulse-sentinel-architecture.md)).

### Track 5: CI/CD & Testing Automation (`.github/workflows`)
- [x] **PR test & build gating CI**: Created GitHub Actions CI workflow in [`.github/workflows/ci.yml`](file:///Users/jwalton/Code/cobacious/neus/.github/workflows/ci.yml) that runs dependency caching, Prisma generation, `pnpm build` and `pnpm test` on pull requests and main pushes.

### Track 6: Admin Editorial & Cluster Management (`apps/admin`, `apps/api`)
- [ ] **Cluster browser and search** ([`PRD-007`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/admin-cluster-management.md)): List, filter and search active clusters across environments.
- [ ] **Cluster merge and story grouping** ([`PRD-007`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/admin-cluster-management.md)): Support merging duplicate clusters and grouping related clusters into story umbrellas with distinct angles. (See handoff in [`docs/handoffs/admin-cluster-management.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/admin-cluster-management.md)).
- [x] **Yorkshire tiger incident consolidation**: Consolidated under single story umbrella "Fatal Tiger Enclosure Incident at Yorkshire Wildlife Park and Aftermath" with 3 distinct multi-source angles. (See handoff in [`docs/handoffs/yorkshire-tiger-story-merge.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/yorkshire-tiger-story-merge.md)).

### Track 7: Syndication, SEO and Soft Launch Distribution (`apps/web`, `apps/engine`)
- [x] **Outbound RSS feed**: Created `/feed.xml` and `/rss.xml` with Atom namespace, story-angle grouping, RFC 822 pubDate and autodiscovery in `index.html`.
- [x] **Dynamic sitemap & robots.txt**: Implemented `/sitemap.xml` conforming to Sitemap 0.9 protocol and `robots.txt` for search crawler indexing.
- [x] **Weekly Substack markdown draft generator**: Built CLI tool (`pnpm substack:draft`) in [`apps/engine/lib/generateWeeklyDigest.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/lib/generateWeeklyDigest.ts) that synthesises top multi-angle stories and source breakdowns for zero-slop newsletters.

### Track 8: Progressive Web App (`apps/web`)
- [x] **Web App Manifest**: Create standalone manifest with Neus palette branding (`#4F6D7A` Blue Slate), theme color, start URL and icons.
- [x] **Service Worker & Offline Fallback**: Pre-cache static assets and establish offline reading caching strategy for previously loaded stories.
- [x] **iOS & Mobile Meta Integration**: Add apple-touch-icon, mobile web app viewport meta tags and install affordance in drawer navigation.

### Track 9: Topic Taxonomy & Categorisation (`apps/engine`, `packages/db`, `apps/api`, `apps/web`)
- [ ] **TypeSafe Jev Multi-Tag Classification** ([`PRD-003`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-003-topic-taxonomy-and-verticals.md)): Multi-probability calibrated `Choice` judgment on clusters during summarization across 9 controlled tags (UK, World, Politics, Business, Tech & Science, Environment, Society & Life, Sport and Culture & Arts) at ~$0.000005 per cluster.
- [ ] **PostgreSQL GIN Array Schema & API Exposure** ([`PRD-003`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-003-topic-taxonomy-and-verticals.md)): Add additive `tags String[] @default([])` field to `Cluster` and `Story` in `@neus/db` with GIN indexing and expose in GraphQL `feed(tag: String)`.
- [ ] **Frontend Topic Navigation & Progressive Disclosure** ([`PRD-003`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-003-topic-taxonomy-and-verticals.md)): Contextual story card badges, drawer topic navigation, floating thumb-zone filter pill and URL routing (`/?topic=<slug>`).

### Track 10: Search & Information Retrieval (`packages/db`, `apps/api`, `apps/web`)
- [ ] **PostgreSQL Full-Text Search** ([`PRD-005`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-005-postgresql-full-text-search.md)): Native GIN `tsvector` index across stories and clusters in Neon DB with zero external infrastructure cost.
- [ ] **GraphQL Search Endpoint** ([`PRD-005`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-005-postgresql-full-text-search.md)): Expose `searchStories(query: String!, limit: Int)` returning matching stories, thread breakdowns and relevance ranks.
- [ ] **TypeSafe Semantic Reranking (Phase 2)** ([`PRD-005`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-005-postgresql-full-text-search.md)): Rerank top 20 candidate search results with Jev `Score` / `Choice` for entity-level search accuracy.
- [ ] **Frontend Search UX** ([`PRD-005`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-005-postgresql-full-text-search.md)): Header search bar or `⌘K` modal with instant debounced querying and keyboard navigation.

---

## Completed Milestones

- **2026-11-02**: [`PRD-001`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-001-pipeline-freshness-metadata.md) (Pipeline Freshness & Last Updated Metadata): Expose `pipelineStatus` in GraphQL, calculate composite latest run timestamp across clusters, articles and active sources in `@neus/db` and render subtle `<LastUpdated />` indicator in the persistent footer.
