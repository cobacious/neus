# PRD-002: Sparkline Touch Ergonomics & Deep Linking

- **Identifier**: `PRD-002`
- **Priority**: P2 (Immediate Delivery)
- **Status**: Ready for Development
- **Target Packages**: `apps/web`
- **Target Personas**: Mobile PWA Reader, Tablet & Desktop Explorer
- **Estimated Effort**: Small to Medium (~2 to 3 hours)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
The [`ArticleTimelineSparkline.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/ArticleTimelineSparkline.tsx) component visualizes coverage progression across time with color-coded markers for each story angle. However:
1. **Tiny Hit Targets**: Marker buttons use `p-1` around a `w-2 h-2` SVG dot (effective target size of ~16x16px). On mobile devices and touchscreens, this falls far below the WCAG 2.5.5 and Apple Human Interface Guidelines minimum touch target of 44x44px.
2. **Dead Clicks**: Clicking a marker currently executes `e.stopPropagation()` with no navigation or action. Readers naturally expect tapping a dot to jump directly to that article in the coverage list or filter to its thread.
3. **Touch Tooltip Frustration**: Tooltips rely primarily on mouse hover (`onMouseEnter`/`onMouseLeave`). On iOS Safari and Android Chrome, tapping triggers erratic hover simulation that either vanishes instantly or blocks card navigation.

### 1.2 The Solution
Upgrade the timeline sparkline to a fully interactive touch-first component:
1. Expand the invisible hit area to a comfortable minimum 40x40px to 44x44px touch envelope using CSS pseudo-elements or absolute padding.
2. Wire marker taps to deep link directly:
   - On the homepage feed card: Navigate to `${storyUrl}?thread=${threadId}#article-${articleId}`.
   - On the story detail page: Smoothly auto-scroll to the matching article row and temporarily flash a highlight badge.
3. Add a dedicated mobile tap bottom sheet or persistent card popover when a marker is tapped on touch devices.

---

## 2. User Stories

1. **Mobile Reader Fast Jump**:
   * *As a* reader using the Neus PWA on iPhone,
   * *I want to* tap any marker on the story timeline with my thumb,
   * *So that* I am taken directly to that specific article and thread without hunting through dozens of sources.

2. **Touch Feedback**:
   * *As a* mobile user,
   * *I want* clear tactile feedback (scale animation and active state ring) when tapping a marker,
   * *So that* I know which point on the timeline I selected.

3. **Desktop Scrubbing**:
   * *As a* desktop user,
   * *I want to* hover to preview the headline and source and click to scroll down to the article,
   * *So that* I can inspect chronological developments rapidly.

---

## 3. Technical Architecture & Component Changes

### 3.1 Touch Target Expansion (WCAG 2.5.5)
In [`ArticleTimelineSparkline.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/ArticleTimelineSparkline.tsx):
- Keep the visual dot size at `w-2.5 h-2.5` (`10px`) to preserve sleek editorial density.
- Expand the touch bounding box via an invisible `::before` pseudo-element:
  ```css
  /* Invisible 44x44px touch bounding box */
  .timeline-marker::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
  ```
- Ensure adjacent markers do not completely swallow clicks through intelligent z-indexing and touch radius detection.

### 3.2 Deep Linking & Navigation Action
- **Prop Interface Update**:
  ```typescript
  export interface ArticleTimelineSparklineProps {
    articles?: TimelineArticle[];
    colorMap?: Map<string, ThreadColorStyle>;
    fallbackFirstSeen?: number | string | null;
    fallbackLastUpdated?: number | string | null;
    className?: string;
    storySlug?: string;             // For feed card navigation
    onSelectArticle?: (article: TimelineArticle) => void; // For story view scrolling
  }
  ```
- **Behavior on Feed Card**:
  - Tapping a marker executes:
    `navigate(`/story/${storySlug}?thread=${marker.article.threadId}#article-${marker.article.id}`)`
- **Behavior on Story Detail View**:
  - Smoothly scroll target into view:
    ```typescript
    const element = document.getElementById(`article-${marker.article.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-pulse');
      setTimeout(() => element.classList.remove('highlight-pulse'), 2000);
    }
    ```

### 3.3 Visual Pulse & Touch State Feedback
- Active selected state renders an outer ring matching the thread color:
  `ring-2 ring-offset-2 ring-[var(--thread-color)] scale-125`
- CSS keyframe animation for `.highlight-pulse` added to `apps/web/src/index.css`:
  Gently pulses a Burnt Peach / Blue Slate border for 2 seconds to confirm the target.

---

## 4. Financial & Performance Budget Impact

- **Database Compute**: Zero. Uses existing article and cluster payloads already fetched in GraphQL.
- **Bandwidth**: Zero additional network overhead.
- **AI Token Burn**: $0.00.

---

## 5. Acceptance Criteria

- [ ] **GIVEN** a timeline sparkline with 10 markers, **WHEN** inspected in browser dev tools, **THEN** each marker has an accessible touch target area of at least 44x44px.
- [ ] **GIVEN** a user on mobile taps a timeline marker on a feed card, **WHEN** tapped, **THEN** the browser navigates to the story page with the matching thread pre-filtered and scrolls to the selected article.
- [ ] **GIVEN** a user on the story detail page taps a timeline marker, **WHEN** tapped, **THEN** the page smoothly scrolls to the target article and applies a transient visual highlight.
- [ ] **GIVEN** keyboard navigation via Tab, **WHEN** focusing timeline markers, **THEN** each marker is accessible with Enter / Space key activation and visible focus outline.
- [ ] **GIVEN** existing Jest component test suites, **WHEN** `pnpm test ArticleTimelineSparkline` runs, **THEN** all tests pass.

---

## 6. Test & Verification Plan

1. **Component Tests**:
   - Update [`ArticleTimelineSparkline.test.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/ArticleTimelineSparkline.test.ts) to verify click handler dispatch, keyboard activation and touch target dimensions.
2. **Mobile Device Testing**:
   - Test in Chrome Mobile Device Simulator (iPhone 14 / Pixel 7) and physical iOS device via local Wi-Fi Vite server.
   - Verify that tightly clustered points allow tapping individual dots without mis-clicks.
