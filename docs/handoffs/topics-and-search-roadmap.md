# Architecture Spec: Topic Taxonomy & Native Search

## Overview & Motivation

Neus has achieved high editorial accuracy and sustainable economics through Story Threads and TypeSafe System One (`jev-1.14.0`). Two high-leverage content discovery capabilities are now on the roadmap:

1. **Topics (Verticals & Subject Taxonomy)**: Enable readers to filter coverage by domain (such as UK Politics, World Affairs, Economy, Tech & Science, Environment, Culture & Society and Sport) while preserving neutral multi-thread story grouping.
2. **Search (Information Retrieval)**: Provide instant search across active and archived stories, threads and constituent articles using zero-cost PostgreSQL Full-Text Search in Neon DB, optionally boosted by TypeSafe Jev semantic reranking.

---

## Part 1: Topic Taxonomy & Categorisation

### 1. Classification Strategy (TypeSafe Jev `Choice`)
Rather than relying on brittle keyword matching or expensive generative LLM calls, topics are classified during cluster processing via a single TypeSafe System One `Choice` question.

- **Question Primitive**: `choice`
- **Model**: `jev-1.14.0`
- **Cost**: ~$0.000005 per cluster (~$0.0002 per pipeline run)
- **Latency**: ~50ms to 90ms
- **Instructions**: "Select the primary editorial topic category that best describes this news cluster."
- **Criteria**:
  - `uk_politics`: UK parliamentary affairs, domestic legislation, elections and party politics
  - `world`: International conflicts, foreign policy, diplomacy and global geopolitics
  - `economy`: Macroeconomics, inflation, monetary policy, corporate developments and markets
  - `tech_science`: Technology, artificial intelligence, cybersecurity, space and scientific research
  - `environment`: Climate change, conservation, environmental policy, extreme weather and energy transition
  - `culture_society`: Healthcare, education, justice, arts, social trends and public interest
  - `sport`: Professional leagues, tournaments, athletics and competitive sports
- **Output**: Discrete topic key and calibrated confidence score.

### 2. Database Schema Additions (`packages/db`)
Additive schema changes to [`packages/db/prisma/schema.prisma`](file:///Users/jwalton/Code/cobacious/neus/packages/db/prisma/schema.prisma):

```prisma
model Cluster {
  // Existing fields...
  topic       String?   // e.g. "uk_politics", "world", "economy"
  topicScore  Float?    // Calibrated confidence from System One

  @@index([topic, score(sort: Desc)])
}

model Story {
  // Existing fields...
  topic       String?   // Inherited or assigned topic

  @@index([topic, updatedAt(sort: Desc)])
}
```

### 3. GraphQL API (`apps/api`)
- Update `Cluster` and `Story` types to expose `topic: String` and `topicScore: Float`.
- Add optional `topic: String` parameter to the `feed()` query in [`apps/api`](file:///Users/jwalton/Code/cobacious/neus/apps/api).

### 4. Frontend UI (`apps/web`)
- Horizontal, swipeable topic bar on mobile and desktop below the header:
  `[All] [UK Politics] [World] [Economy] [Tech & Science] [Environment] [Culture] [Sport]`
- URL state synchronization (`/?topic=uk_politics`).
- Visual topic badge rendered on cluster cards.

---

## Part 2: Native Search & Semantic Reranking

### 1. Zero-Cost First-Stage Retrieval (PostgreSQL FTS in Neon)
To stay strictly within the £5 to £10 monthly hobby budget, search relies on PostgreSQL's native Full-Text Search (FTS) engine in Neon:
- **No external search services**: Zero recurring costs from Algolia, Pinecone or Elasticsearch.
- **Index**: GIN index using `to_tsvector('english', coalesce(headline, '') || ' ' || coalesce(summary, ''))`.
- **Query Parser**: `websearch_to_tsquery('english', $query)` natively supports phrases in quotes, minus operators for exclusions and prefix matching.

### 2. Phase 2 Enhancement: TypeSafe Semantic Reranking
For short or ambiguous search queries:
1. Retrieve the top 20 candidate stories via PostgreSQL FTS in < 5ms.
2. Pass the query and candidate titles to TypeSafe Jev:
   - Evaluates relevance with a `Choice` or `Score` primitive.
   - Re-orders the shortlist so the exact conceptual match lands at rank 1.

### 3. GraphQL API (`apps/api`)
Add query resolver:
```graphql
type SearchResult {
  stories: [Story!]!
  clusters: [Cluster!]!
  totalMatches: Int!
}

extend type Query {
  search(query: String!, topic: String, limit: Int = 20): SearchResult!
}
```

### 4. Frontend Search UX (`apps/web`)
- Search icon in header opening a clean search bar or modal with keyboard shortcut (`⌘K` / `Ctrl+K`).
- Debounced execution (250ms) with instant search results showing overarching story title, matching threads and source favicons.
