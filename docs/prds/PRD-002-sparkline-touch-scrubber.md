# PRD-002: Sparkline Touch Scrubber & Latched Tooltip Deep Linking

- **Identifier**: `PRD-002`
- **Priority**: P2 (Immediate Delivery)
- **Status**: Completed
- **Target Packages**: `apps/web`
- **Target Personas**: Mobile PWA Reader, Tablet & Desktop Explorer
- **Estimated Effort**: Medium (~3 to 4 hours)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
The [`ArticleTimelineSparkline.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/ArticleTimelineSparkline.tsx) component visualises coverage progression across time with colour-coded markers for each story angle. However:
1. **Clustered Marker Collisions**: Marker buttons use `p-1` around a `w-2 h-2` SVG dot (~16x16px). Expanding individual hit areas to 44x44px via CSS pseudo-elements fails in practice because breaking news stories generate dense clusters of overlapping markers (often 5 to 8 dots within 45px), causing upper DOM layers to swallow adjacent taps.
2. **Dead Clicks & Accidental Navigation**: Clicking a marker currently executes `e.stopPropagation()` with no navigation or action. Conversely, wiring immediate navigation to raw marker taps on touch devices prevents users from previewing the source and headline first, leading to accidental navigations.
3. **Touch Tooltip Frustration**: Tooltips rely on mouse hover (`onMouseEnter`/`onMouseLeave`). On iOS Safari and Android Chrome, tapping triggers erratic hover states that either vanish before the user can read them or block card navigation.

### 1.2 The Solution
Replace individual marker hit targets on touch devices with a **container-level "Scrub-and-Latch" architecture**:
1. **Track-Level Pointer Scrubbing**: Expand the sparkline track container to a 44px vertical touch zone (`touch-action: pan-y`) using unified Pointer Events (`onPointerDown`, `onPointerMove`, `onPointerUp`).
2. **Cluster-Aware Scrub Resolution**: Resolve horizontal thumb movement across dense clusters using a hybrid coordinate/magnetic-index lookup so every overlapping dot can be cleanly isolated during a drag.
3. **Two-Stage "Latch" & Actionable Tooltip**:
   - **Stage 1 (Scrub & Latch)**: Touching or dragging along the track previews each article's tooltip elevated above the user's thumb. Lifting the finger (`pointerup`) **latches** the active marker and keeps the tooltip pinned on screen.
   - **Stage 2 (Tap Tooltip to Deep Link)**: The latched tooltip card acts as an interactive button (and optionally includes `‹` / `›` steppers for dense clusters). Tapping the tooltip body executes the deep link:
     - On the homepage feed card: Navigate to `${storyUrl}?thread=${threadId}#article-${articleId}`.
     - On the story detail page: Smoothly auto-scroll to the matching article row and temporarily flash a highlight badge.
4. **Desktop Parity**: Preserve existing `pointerType === 'mouse'` hover previews and direct marker/tooltip click navigation.

---

## 2. User Stories

1. **Mobile Cluster Scrubbing**:
   * *As a* reader using the Neus PWA on iPhone,
   * *I want to* slide my thumb horizontally across the timeline track,
   * *So that* I can smoothly inspect individual articles even when 6+ markers are tightly clustered together.

2. **Latched Tooltip Deep Linking**:
   * *As a* mobile reader,
   * *I want* the article tooltip to stay visible when I lift my thumb and allow me to tap the tooltip card itself to open the article,
   * *So that* I can read the source and headline before committing to navigating away from my feed.

3. **Desktop Scrubbing & Direct Click**:
   * *As a* desktop user,
   * *I want to* hover over markers to preview the headline and source and click either the marker or tooltip to jump to the article,
   * *So that* I can inspect chronological developments rapidly.

---

## 3. Technical Architecture & Component Changes

### 3.1 Interaction State Machine
In [`ArticleTimelineSparkline.tsx`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/ArticleTimelineSparkline.tsx), replace simple hover state with an explicit interaction state:

```typescript
type SparklineInteractionMode = 'idle' | 'hovering' | 'scrubbing' | 'latched';

interface SparklineState {
  mode: SparklineInteractionMode;
  activeIndex: number | null; // Index in sorted timeline articles array
}
```

- **`idle` -> `hovering`** (`pointerType === 'mouse'`): Triggered via `onPointerMove` over the track or markers. Leaves to `idle` on `onPointerLeave` (with a 150ms grace delay so users can move the cursor onto the tooltip if desired).
- **`idle` -> `scrubbing`** (`pointerType === 'touch' | 'pen'`): Triggered on `onPointerDown` on the track container. Captures pointer (`e.currentTarget.setPointerCapture(e.pointerId)`), resolves initial `activeIndex` and elevates tooltip position.
- **`scrubbing` -> `latched`**: Triggered on `onPointerUp` or `onPointerCancel`. Releases pointer capture and keeps `activeIndex` pinned.
- **`latched` -> `idle`**: Triggered when:
  - User taps outside the sparkline track and tooltip (`document` `pointerdown` listener).
  - User scrolls the viewport (`window` `scroll` listener, passive).
  - User presses `Escape`.

### 3.2 Track Container & Cluster-Aware Coordinate Resolution
- **Track Hit Envelope**:
  Wrap the visual line and markers (`w-2.5 h-2.5` / `10px` visual size preserved) in a full-width track container with `min-h-[44px] flex items-center select-none touch-pan-y`.
- **De-clustering / Magnetic Scrub Math**:
  When calculating `activeIndex` from `e.clientX` relative to `trackRect`:
  1. Compute raw normalised pointer position: $p = \text{clamp}\left(\frac{\text{clientX} - \text{rect.left}}{\text{rect.width}}, 0, 1\right)$.
  2. To prevent overlapping markers (where $\Delta x < 10\text{px}$) from being skipped during a thumb drag, compute a **blended virtual coordinate** $x_i'$ for each sorted marker $i \in [0, N-1]$ that enforces a minimum virtual separation of `12px` between adjacent markers while preserving cluster boundaries or resolve nearest marker and support a `14px` horizontal drag hysteresis threshold when moving through markers sharing near-identical timestamps.
  3. When `activeIndex` changes during `scrubbing`, fire `navigator.vibrate?.(4)` (progressive enhancement on supported Android devices).

### 3.3 Actionable Tooltip & Cluster Stepper UI
Update the dark popover card (`bg-slate-900 text-white`):
- **Vertical Offset & Clamping**:
  - In `scrubbing` and `latched` modes, position the tooltip `bottom: calc(100% + 16px)` (approx. 50 to 60px above the thumb baseline) and horizontally clamp within the parent card bounds (`left`/`right` clamped with `12px` viewport/card padding) so it never clips off-screen.
- **Interactive Link Body**:
  - Render the tooltip content area as an interactive `<button>` or `<a>` with `pointer-events-auto cursor-pointer` and a subtle right-aligned chevron (`›`) or jump icon indicating tap-to-open affordability.
  - Clicking/tapping the tooltip body triggers `handleArticleNavigate(activeArticle)`.
- **Inline Cluster Stepper (Optional / Dense Cluster Aid)**:
  - Display a compact counter badge in the tooltip header (e.g. `14 of 40` or prev/next `‹` `›` tap targets when in `latched` mode) so users can also tap to step one-by-one through identical-timestamp dots without re-scrubbing.

### 3.4 Deep Linking & Navigation Action
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
- **Execution (`handleArticleNavigate`)**:
  - **Mouse (`pointerType === 'mouse'`)**: Triggered on direct marker click OR tooltip click.
  - **Touch (`pointerType === 'touch'`)**: Triggered on tapping the **latched tooltip** (or double-tapping an already-latched marker). Always calls `e.stopPropagation()` to prevent parent feed card click handlers from firing a generic card navigation.
  - **Behavior on Feed Card**:
    `navigate(`/story/${storySlug}?thread=${marker.article.threadId}#article-${marker.article.id}`)`
  - **Behavior on Story Detail View**:
    ```typescript
    const element = document.getElementById(`article-${marker.article.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-pulse');
      setTimeout(() => element.classList.remove('highlight-pulse'), 2000);
    }
    ```

### 3.5 Visual Pulse & Active Marker Feedback
- Active (`hovering`, `scrubbing` or `latched`) marker renders an outer ring matching the thread colour and elevated z-index:
  `z-20 ring-2 ring-offset-2 ring-[var(--thread-color)] scale-150 transition-transform duration-150`
- While `scrubbing` or `latched`, render a subtle vertical hairline guide (`w-px h-4 bg-slate-400/50`) through the active dot to anchor it visually to the tooltip above.
- CSS keyframe animation for `.highlight-pulse` added to [`apps/web/src/index.css`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/index.css):
  Gently pulses a Burnt Peach / Blue Slate border for 2 seconds to confirm the target article row.

---

## 4. Financial & Performance Budget Impact

- **Database Compute**: Zero. Uses existing article and cluster payloads already fetched in GraphQL.
- **Client Runtime Performance**: Pointer move calculations run in $O(N)$ where $N \le 100$ articles, taking $<0.1\text{ms}$ per frame with zero layout thrashing (`getBoundingClientRect()` cached on `pointerdown`).
- **Bandwidth**: Zero additional network overhead.
- **AI Token Burn**: $0.00.

---

## 5. Acceptance Criteria

- [x] **GIVEN** a mobile viewport, **WHEN** inspecting the sparkline track container, **THEN** the interactive scrub track has a vertical touch height of at least 44px and sets `touch-action: pan-y` so vertical page scrolling remains unobstructed.
- [x] **GIVEN** a dense cluster of 6+ overlapping markers, **WHEN** a touch user drags their thumb horizontally across the cluster, **THEN** each individual marker in chronological order can be isolated and previewed in the tooltip without being swallowed by adjacent markers.
- [x] **GIVEN** a touch user scrubs or taps the timeline and lifts their finger (`pointerup`), **WHEN** the gesture ends, **THEN** the active marker remains visually highlighted and the tooltip remains **latched** (visible) on screen.
- [x] **GIVEN** a latched tooltip on a feed card, **WHEN** the user taps the tooltip card, **THEN** the browser navigates to `/story/${storySlug}?thread=${threadId}#article-${articleId}` without triggering the parent card's default click handler.
- [x] **GIVEN** a latched tooltip on the story detail page, **WHEN** the user taps the tooltip card, **THEN** the page smoothly scrolls to `#article-${articleId}`, applies `.highlight-pulse` for 2 seconds and dismisses the tooltip.
- [x] **GIVEN** a latched tooltip, **WHEN** the user taps outside the component or scrolls the page, **THEN** the tooltip unlatches and closes cleanly.
- [x] **GIVEN** keyboard navigation (`Tab` / `ArrowLeft` / `ArrowRight`), **WHEN** focusing the timeline, **THEN** users can cycle through markers with arrow keys and press `Enter` or `Space` to trigger navigation.
- [x] **GIVEN** existing unit/component test suites, **WHEN** `pnpm test ArticleTimelineSparkline` runs, **THEN** all tests pass including new pointer scrub, latch, outside-click dismissal and deep-link dispatch assertions.

---

## 6. Test & Verification Plan

1. **Component Tests ([`ArticleTimelineSparkline.test.ts`](file:///Users/jwalton/Code/cobacious/neus/apps/web/src/components/ArticleTimelineSparkline.test.ts))**:
   - Simulate `pointerDown` -> `pointerMove` (`pointerType: 'touch'`) across clustered timestamps and verify sequential tooltip updates.
   - Verify `pointerUp` transitions state to `latched` (tooltip remains mounted in DOM).
   - Verify clicking the latched tooltip dispatches `navigate` (feed mode) or `onSelectArticle` / `scrollIntoView` (story detail mode).
   - Verify outside `pointerDown` dismisses the latched tooltip.
2. **Mobile Device Testing**:
   - Test in Chrome DevTools Device Simulator and on physical iPhone (iOS Safari / PWA) via local Wi-Fi Vite server.
   - Verify thumb occlusion clearance, vertical scroll pass-through (`pan-y`) and single-article isolation on stories with 40+ clustered articles.
