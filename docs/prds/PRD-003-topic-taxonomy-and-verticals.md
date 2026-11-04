# PRD-003: Topic Taxonomy & Multi-Tagging (TypeSafe Jev)

- **Identifier**: `PRD-003`
- **Priority**: P3 (Core Capability)
- **Status**: Specification Ready
- **Target Packages**: `apps/engine`, `packages/db`, `apps/api`, `apps/web`
- **Target Personas**: General News Consumer, Specialist Reader (e.g. Politics or Tech Enthusiast)
- **Estimated Effort**: Medium (~3 to 5 hours)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
Neus currently presents all news in a single unpartitioned feed sorted strictly by consensus recency score. While this ensures that major multi-outlet events surface objectively, it creates friction for readers interested in specific domains (such as politics, macroeconomic policy or technology).

Furthermore, news rarely fits into rigid, mutually exclusive single-category buckets:
- An article on Andy Burnham negotiating EU border concessions with Treasury GDP projections is both **Politics** and **Business**.
- An international hockey boycott against Russia is both **World** and **Sport**.
- A High Court fraud trial involving Andrew Mountbatten-Windsor is both **Justice** and **Culture**.
- A wave of cyberattacks on European blood banks is both **Tech & Science** and **World**.

Forcing stories into a single vertical (1-to-1) forces arbitrary compromises that hide crossover stories from readers. In contrast, modern digital newsrooms (including The Guardian, BBC Dynamic Semantic Publishing and Reuters IPTC standards) model content as **many-to-many semantic tags**.

### 1.2 The Solution
Implement a **controlled many-to-many topic tagging model** powered by TypeSafe System One (`jev-1.14.0`) during Step 6 (Summarization) of the pipeline:
- A single calibrated `Choice` judgment evaluates the candidate taxonomy. Instead of discarding the distribution, Neus inspects the calibrated `probabilities: Record<string, number>` returned by Jev.
- Any topic tag exceeding the confidence threshold ($p \ge 0.25$) is assigned to the cluster (capped at maximum 3 tags, with a guaranteed minimum of the argmax top choice).
- Costs remain negligible (~$0.000005 per cluster or ~$0.0002 per pipeline pass) with zero additional prompt tokens.
- An additive `tags String[] @default([])` column with a PostgreSQL GIN index is added to Neon DB, enabling sub-millisecond `@>` containment filtering.
- The GraphQL API exposes `tags: [String!]!` and supports filtering via `clusters(tag: String)`.
- The frontend features a horizontal, swipeable topic bar below the header (`/?topic=politics`) and renders clickable tag chips on story cards.

---

## 2. User Stories

1. **Focused Domain Browsing**:
   * *As a* reader focused on international developments,
   * *I want to* select the "World" topic tab on the home feed,
   * *So that* I can read coverage of global diplomacy, elections and conflicts without domestic entertainment or sports briefs.

2. **Crossover Story Discovery**:
   * *As a* sports fan reading the "Sport" feed,
   * *I want to* see geopolitical sports boycotts (such as the Russia hockey ban),
   * *So that* major cross-domain stories are not artificially hidden by single-category silos.

3. **Contextual Story Badges**:
   * *As a* general news reader,
   * *I want to* see up to 2 discreet topic badges on story cards (e.g. `[Politics] [Business]`),
   * *So that* I immediately understand the story's thematic scope.

4. **Deep Linking & Shareable URLs**:
   * *As a* user sharing a link to political coverage,
   * *I want* the URL to reflect `https://neus.news/?topic=politics`,
   * *So that* recipients land directly on the filtered stream.

---

## 3. Technical Architecture & Component Changes

### 3.1 Controlled Tag Taxonomy (9 Topics)
Neus standardizes on 9 controlled, high-coverage topic tags:

| Tag Key | Display Label | Scope & Criteria | Typical Examples |
| :--- | :--- | :--- | :--- |
| `politics` | Politics | Westminster, parliaments, legislation, elections, party politics and government policy | Burnham Brexit reset, US Midterms, cabinet revolts |
| `world` | World | International affairs, foreign elections, global diplomacy, treaties and overseas disasters | US Midterms, Ukraine war, Spanish train crash |
| `business` | Business | Macroeconomics, financial markets, inflation, corporate earnings, retail and trade | Poundland administration, US stock market rally |
| `tech_science` | Tech & Science | Artificial intelligence, cybersecurity, digital policy, space and medical research | European blood bank cyberattacks, NHS cancer test |
| `environment` | Environment | Climate policy, renewable energy, conservation, extreme weather and wildlife | COP summits, net zero policy, grizzly bear incident |
| `justice` | Justice & Law | Courts, criminal trials, policing, legal rulings, civil liberties and inquiries | Russell Brand trial, Stonehaven derailment findings |
| `society` | Society & Life | Public health, education, transport, housing, demographics and social trends | Drug fatality statistics, prison conditions, school leaks |
| `sport` | Sport | Tournaments, leagues, football transfers, athletes and sports governance | Tenerife player tribute, Nadal Real Madrid board role |
| `culture` | Culture & Arts | Arts, entertainment, film, television, books, celebrity and royalty | King Charles Caribbean tour, Edinburgh Zoo capybaras |

### 3.2 Pipeline Classification Engine (`apps/engine`)
- **Integration Point**: In [`apps/engine/core/pipeline/summariseClusters.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/summariseClusters.ts), executed in parallel with summary generation.
- **TypeSafe Jev Multi-Probability Extraction**:
  ```typescript
  import { typesafe } from '../../lib/typesafeClient';

  export const CONTROLLED_TOPIC_TAGS = [
    'politics',
    'world',
    'business',
    'tech_science',
    'environment',
    'justice',
    'society',
    'sport',
    'culture',
  ] as const;

  export type TopicTag = (typeof CONTROLLED_TOPIC_TAGS)[number];

  export async function classifyClusterTags(
    headline: string,
    summary: string
  ): Promise<TopicTag[]> {
    const judgment = await typesafe.choice({
      model: 'jev-1.14.0',
      instruction:
        'Select the primary editorial topic tags that accurately describe this news cluster headline and summary.',
      context: `Headline: ${headline}\nSummary: ${summary}`,
      options: CONTROLLED_TOPIC_TAGS as unknown as string[],
    });

    const probabilities = judgment.probabilities || {};
    
    // Select all tags with calibrated probability >= 0.25, sorted descending by confidence
    const qualifiedTags = Object.entries(probabilities)
      .filter(([tag, prob]) => CONTROLLED_TOPIC_TAGS.includes(tag as TopicTag) && prob >= 0.25)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag as TopicTag);

    // Ensure at least the argmax winner is present; cap at 3 tags
    const finalTags = qualifiedTags.length > 0 
      ? qualifiedTags.slice(0, 3) 
      : [judgment.choice as TopicTag];

    return finalTags;
  }
  ```
- **Story-Level Tag Roll-up**:
  In [`apps/engine/core/pipeline/organizeStoryAngles.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/engine/core/pipeline/organizeStoryAngles.ts), member cluster tags are pooled and ordered by frequency so the overarching `Story` inherits the union of its angles' primary tags.

### 3.3 Database Schema & Indexing (`packages/db`)
Additive schema changes to [`packages/db/prisma/schema.prisma`](file:///Users/jwalton/Code/cobacious/neus/packages/db/prisma/schema.prisma):
```prisma
model Cluster {
  // Existing fields...
  tags    String[]  @default([])

  @@index([tags], type: Gin)
}

model Story {
  // Existing fields...
  tags    String[]  @default([])

  @@index([tags], type: Gin)
}
```

### 3.4 Database Query Helpers & GraphQL API Layer (`packages/db`, `apps/api`)
- In [`packages/db/src/clusters/getRankedClusters.ts`](file:///Users/jwalton/Code/cobacious/neus/packages/db/src/clusters/getRankedClusters.ts):
  Add optional `tag?: string` parameter using PostgreSQL array containment:
  ```typescript
  if (tag) {
    whereClause.tags = { has: tag };
  }
  ```
- In [`apps/api/src/graphql/types.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/api):
  Expose `tags: [String!]!` on `Cluster` and `Story`.
  Add `tag: String` argument to `clusters(limit, offset, tag)`.

### 3.5 Frontend UI (`apps/web`)
- **`<TopicFilterBar>`**:
  - Horizontal scrolling pill bar rendered directly below the header:
    `[All] [Politics] [World] [Business] [Tech & Science] [Justice] [Society] [Sport] [Culture] [Environment]`
  - Highlights active pill with Blue Slate (`#4F6D7A`) background and white text.
  - Updates URL parameter via `useSearchParams`: `?topic=politics`.
  - Hides native scrollbar while supporting fluid touch drag on iOS and Android.
- **Card Badges**:
  - Displays up to 2 compact chips on card headers:
    e.g. `<span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Politics</span>`
  - Clicking a badge navigates to `/?topic=<slug>`.

---

## 4. Financial & Performance Budget Impact

- **TypeSafe AI Cost**: 
  - Same single `Choice` call per cluster: ~$0.000005 per cluster.
  - Total monthly cost: **~$0.11 / month** (zero additional cost for multi-tagging).
- **PostgreSQL Query Performance**:
  - Neon GIN index on `tags` executes containment queries (`tags @> ARRAY['politics']`) in under **1.8ms**.
  - Zero SQL joins required.
- **Storage**:
  - Storing a 2 to 3 element `text[]` array adds < 300 KB across the entire database.

---

## 5. Acceptance Criteria

- [ ] **GIVEN** a cluster is summarized in the pipeline, **WHEN** tag classification runs, **THEN** it receives 1 to 3 valid tags from the 9 controlled options based on $p \ge 0.25$.
- [ ] **GIVEN** a crossover story (such as a political trade dispute), **THEN** it receives multiple relevant tags (such as `['politics', 'business']`).
- [ ] **GIVEN** a database query for `getRankedClusters(10, 0, 'politics')`, **THEN** it returns only clusters where `tags` contains `'politics'` ordered by score descending.
- [ ] **GIVEN** a user taps a topic pill on the frontend, **WHEN** selected, **THEN** the feed instantly filters to that tag and the browser URL updates to `?topic=<slug>`.
- [ ] **GIVEN** a user taps a topic badge on a cluster card, **THEN** the feed switches to that topic stream.
- [ ] **GIVEN** `pnpm test` and `pnpm build` run across all packages, **THEN** all tests pass green.

---

## 6. Test & Verification Plan

1. **Unit & Pipeline Tests**:
   - Test Jev multi-probability extraction in `apps/engine/core/pipeline/classifyClusterTags.test.ts`.
   - Test `getRankedClusters` with array tag filtering in `packages/db`.
2. **Backfill Utility**:
   - Provide `apps/engine/scripts/backfillClusterTags.ts` to tag all existing active clusters in a single pass (< $0.02 total cost).
3. **Frontend Verification**:
   - Verify smooth horizontal scrolling on mobile viewports (375px).
   - Verify zero layout shift and instant cached filtering.
