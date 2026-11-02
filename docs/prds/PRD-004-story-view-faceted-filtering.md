# PRD-004: Faceted Story View Filtering (Outlet, Date & Topic)

- **Identifier**: `PRD-004`
- **Priority**: P4 (Editorial Depth)
- **Status**: Backlog / Specification Ready
- **Target Packages**: `apps/web`
- **Target Personas**: Investigative Reader, Cross-Spectrum Comparative Reader, Academic Researcher
- **Estimated Effort**: Medium (~3 to 4 hours)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
When readers open a comprehensive multi-angle story on [`ClusterDetailPage.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/ClusterDetailPage.tsx) (such as *2026 UK Cabinet EU Relations* or *Andrew Legal Inquiries*), the story often contains 20 to 50+ articles across 8 to 12 distinct news outlets. 

Currently, the page only allows filtering by **story thread / angle**. Readers cannot:
1. Filter coverage by a specific newsroom (such as "Show me only what The Guardian and Financial Times reported").
2. Re-order the narrative chronologically from oldest-to-newest to understand how the story originally broke.
3. Group articles by publication to compare editorial framing across outlets side by side.

### 1.2 The Solution
Introduce an intuitive, compact **Facet Control Toolbar** at the top of the `#articles-coverage` section on `/story/[slug]`:
1. **Grouping Modes**: Segmented control to toggle between `[By Thread]` (default), `[By Publication]` and `[Chronological Timeline]`.
2. **Sort Order**: Toggle between `Newest First` (latest updates) and `Oldest First` (origin story).
3. **Outlet Filter**: Multi-select dropdown or chip carousel showing all distinct newsrooms present in the story with their favicons and article counts.
4. **URL Synchronization**: All filter and sort states persist cleanly in query parameters (such as `?group=source&source=bbc-news,the-guardian&sort=asc`).

---

## 2. User Stories

1. **Editorial Comparison**:
   * *As a* reader analyzing bias,
   * *I want to* group articles by publication,
   * *So that* I can read BBC News articles side by side with Daily Telegraph articles on the same event.

2. **Chronological Investigation**:
   * *As a* researcher,
   * *I want to* sort coverage from oldest to newest,
   * *So that* I can trace the exact order in which allegations, statements and reactions emerged over multiple days.

3. **Specific Source Isolation**:
   * *As a* subscriber to specific outlets,
   * *I want to* filter articles to only show Financial Times and Reuters,
   * *So that* I can focus on business-specific reporting within a broad geopolitical story.

---

## 3. Technical Architecture & UI Components

### 3.1 Facet State Interface
In `apps/web/src/ClusterDetailPage.tsx`:
```typescript
export type StoryGroupingMode = 'thread' | 'source' | 'timeline';
export type StorySortOrder = 'desc' | 'asc';

export interface StoryFacetState {
  grouping: StoryGroupingMode;    // URL: ?group=thread|source|timeline
  sortOrder: StorySortOrder;      // URL: ?sort=desc|asc
  selectedSources: Set<string>;   // URL: ?source=bbc-news,the-guardian
  selectedThreadId: string | null;// URL: ?thread=<id>
}
```

### 3.2 UI Component Architecture
Create `<StoryFacetToolbar>` in `apps/web/src/components/StoryFacetToolbar.tsx`:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Group by: [Threads] [Publications] [Timeline]    Sort: [Newest ▾]     │
│  Filter Outlets: [All Sources] [BBC (4)] [Guardian (6)] [FT (2)] ...   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Grouping Segmented Tab**:
   - `By Thread`: Preserves existing thread angle boxes with summary, sparkline and articles.
   - `By Publication`: Renders accordion cards for each active news outlet containing all their filed reports on this story.
   - `Timeline`: Flat chronological feed with date and time dividers.
2. **Sort Toggle**:
   - `Newest First` (default): Surfaces the latest breaking developments first.
   - `Oldest First`: Inverts the timeline to reveal the initial report and origin facts.
3. **Outlet Filter Chips**:
   - Sourced dynamically from the story's unique article set.
   - Shows `<SourceFavicon>` + source name + count badge: e.g. `[BBC News (3)]`.
   - Single or multi-toggle affordance.

### 3.3 Article Transformation & Grouping Pipeline
A pure client-side transformation utility `facetArticles()`:
- Input: `story.clusters[].articleAssignments[].article`
- Filters by `selectedSources` (if any are active)
- Filters by `selectedThreadId` (if active)
- Sorts by `publishedAt` according to `sortOrder`
- Groups into map based on `grouping` mode
- Zero network requests; 100% in-memory instant response (< 5ms).

---

## 4. Financial & Performance Budget Impact

- **Database Compute**: Zero. Operates on the full article payload already returned by the `story(slug)` GraphQL query.
- **Network Egress**: Zero additional bytes.
- **AI Token Burn**: $0.00.

---

## 5. Acceptance Criteria

- [ ] **GIVEN** a story with multiple news outlets, **WHEN** a reader selects an outlet chip, **THEN** only articles published by that outlet are displayed.
- [ ] **GIVEN** a reader toggles the sort order to "Oldest First", **WHEN** the list renders, **THEN** articles display chronologically ascending from the earliest published date.
- [ ] **GIVEN** a reader toggles grouping to "By Publication", **WHEN** rendered, **THEN** articles are grouped under publication headers with source favicons.
- [ ] **GIVEN** facet selections are made, **WHEN** copying the browser URL, **THEN** the URL preserves `?group=...&sort=...&source=...` and restores state on reload.
- [ ] **GIVEN** mobile viewports (375px), **WHEN** viewing the facet toolbar, **THEN** outlet chips scroll horizontally without wrapping or breaking layout.

---

## 6. Test & Verification Plan

1. **Unit Tests**:
   - Test `facetArticles()` logic covering all permutations: grouping by source/thread/timeline, sorting ascending/descending, filtering single and multiple outlets.
2. **Component & Integration Tests**:
   - Test `<StoryFacetToolbar>` URL query parameter serialization and deserialization.
3. **Accessibility**:
   - Verify keyboard tab navigation and ARIA attributes (`aria-pressed`, `aria-expanded`).
