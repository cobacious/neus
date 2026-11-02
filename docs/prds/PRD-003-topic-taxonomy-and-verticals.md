# PRD-003: Topic Taxonomy & Verticals (TypeSafe Jev)

- **Identifier**: `PRD-003`
- **Priority**: P3 (Core Capability)
- **Status**: In Discovery / Specification Ready
- **Target Packages**: `apps/engine`, `packages/db`, `apps/api`, `apps/web`
- **Target Personas**: General News Consumer, Specialist Reader (e.g. Politics or Tech Enthusiast)
- **Estimated Effort**: Medium (~3 to 5 hours)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
Neus currently presents all news in a single unpartitioned feed sorted strictly by consensus recency score. While this ensures that major multi-outlet events surface objectively, it creates significant friction for readers interested in specific domains (such as UK politics, macroeconomic policy or scientific developments). Furthermore:
- Keyword-based taxonomy or regex rules fail on nuanced geopolitical developments.
- Full generative LLM classification (such as prompting Gemini Flash for a category) costs ~$0.001 per cluster, which would rapidly deplete Neus's £5 to £10 monthly budget.

### 1.2 The Solution
Use TypeSafe System One (`jev-1.14.0`) to perform deterministic, typed topic classification during Step 6 (Summarization) of the pipeline:
- A single calibrated `Choice` judgment assigns each cluster to one of 7 core editorial verticals at negligible cost (~$0.000005 per cluster or ~$0.0002 per pipeline pass).
- An additive `topic` field and compound index `[topic, score(sort: Desc)]` are added to Neon PostgreSQL.
- The GraphQL API exposes an optional `topic` argument in `clusters()`.
- The frontend gains an elegant, horizontal swipeable topic bar below the header with URL parameter synchronization (`/?topic=tech_science`).

---

## 2. User Stories

1. **Focused News Browsing**:
   * *As a* reader focused on international developments,
   * *I want to* select the "World" vertical tab on the home feed,
   * *So that* I can read multi-angle coverage of global events without domestic entertainment or sports stories.

2. **Cross-Vertical Story Context**:
   * *As a* general news reader,
   * *I want to* see a subtle topic badge on cluster cards,
   * *So that* I immediately understand the subject classification of the story.

3. **Shareable Topic Links**:
   * *As a* user sharing a link to UK political news,
   * *I want* the URL to reflect `https://neus.news/?topic=uk_politics`,
   * *So that* the recipient lands directly on the filtered view.

---

## 3. Technical Architecture & Component Changes

### 3.1 Topic Taxonomy Definition
Neus standardizes on 7 distinct, mutually exclusive core verticals:

| Key | Display Label | Description & Scope |
| :--- | :--- | :--- |
| `uk_politics` | UK Politics | Westminster, legislation, elections, party politics and devolution |
| `world` | World | International conflicts, diplomacy, foreign elections and geopolitics |
| `economy` | Economy | Macroeconomics, inflation, interest rates, trade and corporate earnings |
| `tech_science` | Tech & Science | Computing, artificial intelligence, cybersecurity, space and clinical science |
| `environment` | Environment | Climate policy, conservation, renewable energy and severe weather events |
| `culture_society` | Culture & Society | Education, healthcare, legal trials, public trends, arts and human interest |
| `sport` | Sport | Football, athletics, Formula 1, rugby, tennis and competitive tournaments |

### 3.2 Pipeline Classification Engine (`apps/engine`)
- **Integration Point**: In [`apps/engine/core/pipeline/summariseClusters.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/summariseClusters.ts), right after the Gemini summary generation or in parallel.
- **TypeSafe Jev Choice Judgment**:
  ```typescript
  import { typesafe } from '../../lib/typesafeClient';

  const TOPIC_CHOICES = [
    'uk_politics',
    'world',
    'economy',
    'tech_science',
    'environment',
    'culture_society',
    'sport',
  ] as const;

  export async function classifyClusterTopic(headline: string, summary: string): Promise<{ topic: string; score: number }> {
    const judgment = await typesafe.choice({
      model: 'jev-1.14.0',
      instruction: 'Select the primary editorial news vertical that best describes this news cluster headline and summary.',
      context: `Headline: ${headline}\nSummary: ${summary}`,
      options: TOPIC_CHOICES,
    });

    return {
      topic: judgment.choice,
      score: judgment.confidence,
    };
  }
  ```
- **Cost**: ~$0.000005 per judgment. For 40 new clusters per run: $0.0002. Negligible impact on monthly budget.

### 3.3 Database Schema & Indexing (`packages/db`)
Additive migration in [`packages/db/prisma/schema.prisma`](file:///Users/jwalton/Code/cobacious/neus/packages/db/prisma/schema.prisma):
```prisma
model Cluster {
  // Existing fields...
  topic       String?   // e.g. "uk_politics", "world"
  topicScore  Float?    // Calibrated confidence score

  @@index([topic, score(sort: Desc)])
}

model Story {
  // Existing fields...
  topic       String?   // Inherited from primary angle cluster

  @@index([topic, updatedAt(sort: Desc)])
}
```

### 3.4 GraphQL API Layer (`apps/api`)
- Expose `topic: String` and `topicScore: Float` on `Cluster` and `Story`.
- Add `topic: String` filter argument to `clusters(limit, offset, topic)`.
- Update [`packages/db/src/clusters/getRankedClusters.ts`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/clusters/getRankedClusters.ts) to filter with `WHERE "topic" = ${topic}` when provided.

### 3.5 Frontend UI (`apps/web`)
- Create `<TopicFilterBar>` in `apps/web/src/components/TopicFilterBar.tsx`:
  - Horizontal, scrollable pill bar rendered below the header:
    `[All] [UK Politics] [World] [Economy] [Tech & Science] [Environment] [Culture & Society] [Sport]`
  - Highlights active pill with Blue Slate (`#4F6D7A`) background and white text.
  - Smoothly updates URL search parameters via `useSearchParams`: `?topic=world`.
  - Accessible touch scrolling on iOS/Android with hide-scrollbar utility.
- Display compact topic badge on each cluster card header:
  e.g. `<span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">UK Politics</span>`

---

## 4. Financial & Performance Budget Impact

- **TypeSafe AI Cost**: ~40 clusters/run * 18 runs/day * 30 days = 21,600 judgments/month * $0.000005 = **~$0.108 / month** (well within £5 to £10 budget).
- **PostgreSQL Index**: The compound B-Tree index `[topic, score(sort: Desc)]` guarantees query latency under 1.5ms in Neon DB.
- **Neon Storage**: Additive columns consume < 2 MB across 2,000 active clusters.

---

## 5. Acceptance Criteria

- [ ] **GIVEN** a cluster is summarized in the pipeline, **WHEN** classification executes, **THEN** it receives a valid topic from the 7 defined options with calibrated confidence.
- [ ] **GIVEN** a database query for `getRankedClusters(10, 0, 'uk_politics')`, **THEN** it returns only clusters matching `topic = 'uk_politics'` ordered by score descending.
- [ ] **GIVEN** a user taps a topic pill on the frontend, **WHEN** selected, **THEN** the feed instantly filters to that topic and the browser URL updates to `?topic=<slug>`.
- [ ] **GIVEN** a user navigates to `/?topic=sport` directly, **WHEN** the page loads, **THEN** the "Sport" tab is active and only sports stories are rendered.
- [ ] **GIVEN** `pnpm test` runs across all packages, **THEN** all existing and new topic tests pass.

---

## 6. Test & Verification Plan

1. **Unit & Pipeline Tests**:
   - Test Jev `Choice` mock responses in `summariseClusters.test.ts`.
   - Test `getRankedClusters` with topic filters in `packages/db`.
2. **Backfill Script**:
   - Create a one-off CLI utility `pnpm topic:backfill` in `apps/engine/scripts/` to classify existing active clusters using TypeSafe Jev in a single fast pass (< $0.02 total cost).
3. **Frontend Verification**:
   - Test horizontal overflow scrolling on 375px mobile screens.
   - Verify zero layout shift when toggling between topics.
