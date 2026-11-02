# PRD-005: Native PostgreSQL Full-Text Search

- **Identifier**: `PRD-005`
- **Priority**: P5 (Information Retrieval)
- **Status**: Backlog / Specification Ready
- **Target Packages**: `packages/db`, `apps/api`, `apps/web`
- **Target Personas**: Investigative Reader, Archive Explorer, Topic Researcher
- **Estimated Effort**: Medium (~4 to 6 hours)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
With over 15,000 articles ingested and hundreds of multi-angle stories recorded, Neus holds an extensive, neutral archive of UK and international news events. However:
1. Readers have no way to search the archive. Once a story recedes from the front-page consensus recency window, it is effectively lost unless the reader knows the exact URL slug.
2. Third-party SaaS search providers (such as Algolia, Pinecone or Elasticsearch) introduce monthly recurring charges that violate Neus's strict **£5 to £10 monthly budget constraint**.

### 1.2 The Solution
Implement native PostgreSQL Full-Text Search (FTS) directly within our existing Neon PostgreSQL database:
- Zero additional infrastructure costs ($0.00).
- Add GIN `tsvector` indexes on `Story` and `Cluster` covering titles, headlines, overviews and synthesised summaries.
- Use PostgreSQL's `websearch_to_tsquery('english', $query)`, which supports Google-style query syntax natively (quoted phrases, `-negative` terms and `OR` logic).
- Expose a `search(query: String!, topic: String, limit: Int)` GraphQL endpoint with ranking by `ts_rank_cd`.
- Add a desktop and mobile `⌘K` modal search interface with debounced execution and keyboard arrow navigation.

---

## 2. User Stories

1. **Instant Topic Retrieval**:
   * *As a* reader,
   * *I want to* type a keyword (such as "Starmer", "Oleshky" or "crypto") into a search bar,
   * *So that* I can instantly see all matching stories and threads without scrolling the home feed.

2. **Advanced Keyword Querying**:
   * *As an* investigative researcher,
   * *I want to* use search operators (such as `"high court" -appeal`),
   * *So that* I can pinpoint specific legal developments within the archive.

3. **Fast Keyboard Navigation**:
   * *As a* power user on desktop,
   * *I want to* press `⌘K` or `/` anywhere on the site,
   * *So that* the search modal opens immediately with focus ready for typing.

---

## 3. Technical Architecture & Component Changes

### 3.1 Database Layer (`packages/db`)
Neon PostgreSQL natively supports GIN (Generalized Inverted Index) for English language text vectors.

1. **Database Migration (`packages/db/prisma/migrations/`)**:
   Create an additive raw SQL migration:
   ```sql
   -- Create generated tsvector columns for Story and Cluster
   ALTER TABLE "Story" 
   ADD COLUMN "tsv" tsvector 
   GENERATED ALWAYS AS (
     to_tsvector('english', coalesce("title", '') || ' ' || coalesce("overview", ''))
   ) STORED;

   ALTER TABLE "Cluster" 
   ADD COLUMN "tsv" tsvector 
   GENERATED ALWAYS AS (
     to_tsvector('english', coalesce("headline", '') || ' ' || coalesce("summary", ''))
   ) STORED;

   -- Create high-performance GIN indexes
   CREATE INDEX "Story_tsv_idx" ON "Story" USING GIN ("tsv");
   CREATE INDEX "Cluster_tsv_idx" ON "Cluster" USING GIN ("tsv");
   ```
2. **Exported Database Helper**:
   In `packages/db/src/stories/searchStories.ts`:
   ```typescript
   export async function searchStories(query: string, options?: { topic?: string; limit?: number }) {
     const limit = options?.limit ?? 20;
     const cleanQuery = query.trim();
     if (!cleanQuery) return [];

     return prisma.$queryRaw`
       SELECT 
         s.id,
         s.title,
         s.slug,
         s.overview,
         ts_rank_cd(s.tsv, websearch_to_tsquery('english', ${cleanQuery})) AS rank
       FROM "Story" s
       WHERE s.tsv @@ websearch_to_tsquery('english', ${cleanQuery})
       ORDER BY rank DESC, s."updatedAt" DESC
       LIMIT ${limit}
     `;
   }
   ```

### 3.2 GraphQL API Layer (`apps/api`)
Add GraphQL types and queries in [`apps/api/schema.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/api/schema.ts):
```graphql
type SearchStoryResult {
  id: String!
  title: String!
  slug: String!
  overview: String
  relevanceScore: Float!
  clusters: [Cluster!]!
}

type SearchResponse {
  query: String!
  stories: [SearchStoryResult!]!
  totalMatches: Int!
}

extend type Query {
  search(query: String!, topic: String, limit: Int = 15): SearchResponse!
}
```

### 3.3 Frontend Web UX (`apps/web`)
1. **Search Trigger**:
   - Header button with magnifying glass icon and desktop keyboard hint badge (`⌘K`).
   - Global keyboard event listener on `window`: opens modal on `Meta+K`, `Ctrl+K` or `/` (when not inside an input field).
2. **Search Dialog Modal (`<SearchModal>`)**:
   - Modern accessible dialog using standard ARIA `role="combobox"` / `dialog`.
   - Large search input with auto-focus and clear button.
   - Debounced search query (250ms) to prevent unnecessary network requests.
   - Instant search results showing:
     - Story title with search keyword matches highlighted.
     - Thread count pills and source favicons.
     - Relative timestamp ("Updated 3d ago").
   - Keyboard navigation: Arrow Up/Down to scrub results, Enter to navigate, Escape to dismiss.

---

## 4. Financial & Performance Budget Impact

- **Infrastructure Cost**: **$0.00**. Uses built-in PostgreSQL GIN indexing in our existing Neon serverless database.
- **Index Storage**: GIN indexes for 15,000 articles and 2,000 clusters require less than 15 MB of storage (easily accommodated within Neon's 1 GB free tier).
- **Query Latency**: PostgreSQL FTS benchmarked across 20,000 records evaluates in under 6ms in Neon DB.
- **AI Token Burn**: $0.00. (Optional Phase 2 reranking with Jev can be triggered only for top 10 ambiguous results if needed).

---

## 5. Acceptance Criteria

- [ ] **GIVEN** a search query with terms present in a story title or cluster summary, **WHEN** `search(query: "protests")` is called, **THEN** matching stories are returned ordered by `ts_rank_cd` relevance score.
- [ ] **GIVEN** a user enters `"Wall Street Journal"` in quotes, **WHEN** searching, **THEN** PostgreSQL treats it as an exact phrase match.
- [ ] **GIVEN** a user on desktop presses `⌘K` or `Ctrl+K`, **WHEN** pressed, **THEN** the search modal opens with the cursor focused in the input.
- [ ] **GIVEN** search results render, **WHEN** pressing Arrow Down and Enter, **THEN** the browser navigates directly to the highlighted story.
- [ ] **GIVEN** `pnpm test` and `pnpm build`, **THEN** all tests and builds pass with zero regressions.

---

## 6. Test & Verification Plan

1. **Database & API Tests**:
   - Test SQL migration and GIN index generation in PostgreSQL test container or Neon branch.
   - Test search resolver handling of special characters, SQL injection attempts and empty strings.
2. **Component Tests**:
   - Test debouncing, keyboard focus trapping and escape dismissal in `<SearchModal>`.
3. **Manual Validation**:
   - Verify mobile keyboard layout handling (viewport resize and virtual keyboard dismissal).
