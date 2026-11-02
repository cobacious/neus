# Neus Engineering & Product Roadmap

This document serves as the canonical, living roadmap for Neus. It tracks the prioritized delivery sequence, functional workstream tracks and links to detailed Product Requirement Documents (PRDs) stored in [`docs/prds/`](file:///Users/jwalton/Code/cobacious/neus/docs/prds).

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
| **P2** | `PRD-002` | **Sparkline Touch Ergonomics & Deep Linking** | `apps/web` | Small to Medium | Ready for Dev | [`PRD-002-sparkline-touch-and-linking.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-002-sparkline-touch-and-linking.md) |
| **P3** | `PRD-003` | **Topic Taxonomy & Verticals (TypeSafe Jev)** | `apps/engine`, `packages/db`, `apps/web` | Medium | In Discovery | [`PRD-003-topic-taxonomy-and-verticals.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-003-topic-taxonomy-and-verticals.md) |
| **P4** | `PRD-004` | **Faceted Story View Filtering (Outlet, Date & Topic)** | `apps/web` | Medium | Backlog | [`PRD-004-story-view-faceted-filtering.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-004-story-view-faceted-filtering.md) |
| **P5** | `PRD-005` | **Native PostgreSQL Full-Text Search** | `packages/db`, `apps/api`, `apps/web` | Medium | Backlog | [`PRD-005-postgresql-full-text-search.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-005-postgresql-full-text-search.md) |
| **P6** | `PRD-006` | **Editorial Dark Theme System** | `apps/web` | Medium | Backlog | [`PRD-006-dark-theme-system.md`](file:///Users/jwalton/Code/cobacious/neus/docs/prds/PRD-006-dark-theme-system.md) |
| **P7** | `PRD-007` | **Admin Editorial Cluster Browser & Merge UI** | `apps/admin`, `apps/api` | Large | Backlog | [`docs/handoffs/admin-cluster-management.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/admin-cluster-management.md) |
| **P8** | `PRD-008` | **French Education Protests Story Angle Calibration** | `apps/engine` | Small | Backlog | [`docs/handoffs/french-protests-angle-grouping.md`](file:///Users/jwalton/Code/cobacious/neus/docs/handoffs/french-protests-angle-grouping.md) |

---

## Decoupled Functional Tracks

### Track 1: Reader UX & Mobile Ergonomics (`apps/web`)
- [x] `PRD-001`: Surface pipeline last updated metadata as discreet text in persistent footer.
- [ ] `PRD-002`: Enlarge sparkline SVG touch target boxes to 44x44px and wire marker taps to thread anchors.
- [ ] `PRD-004`: Implement multi-faceted grouping, chronological sorting and outlet filters on story view.
- [ ] `PRD-006`: System preference dark mode (`prefers-color-scheme`) and manual toggle with palette contrast tuning.

### Track 2: Content Discovery & Search (`packages/db`, `apps/api`, `apps/web`)
- [ ] `PRD-003`: TypeSafe Jev `Choice` classification into 7 core verticals with swipeable category navigation bar.
- [ ] `PRD-005`: PostgreSQL native GIN `tsvector` index and GraphQL `search` endpoint with debounced `⌘K` modal.

### Track 3: Editorial Quality & Engine Intelligence (`apps/engine`, `packages/db`)
- [x] Consensus recency anti-gaming algorithm (defeats single-source recency manipulation).
- [x] Multi-source gating (`uniqueSources >= 2`) to withhold uncorroborated single-outlet reports.
- [x] TypeSafe Jev System One deduplication and article-to-thread classification.
- [ ] `PRD-008`: French protest angle assignment threshold calibration.

### Track 4: Operations & Administration (`apps/admin`, `apps/api`)
- [ ] `PRD-007`: Cluster browser, search and manual angle merge interface.
