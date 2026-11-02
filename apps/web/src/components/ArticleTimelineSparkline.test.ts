import {
  buildTimelineMarkers,
  resolveNearestMarkerIndex,
  resolveScrubIndex,
  buildArticleDeepLinkUrl,
  sparklineStateReducer,
  TimelineMarker,
  TimelineArticle,
  SparklineState,
} from './ArticleTimelineSparkline';
import { ThreadColorStyle, DEFAULT_THREAD_COLOR } from '../utils/threadColors';

describe('ArticleTimelineSparkline buildTimelineMarkers', () => {
  const baseTime = new Date('2026-10-09T10:00:00.000Z').getTime();

  it('returns null when there are no valid articles and no fallback timestamps', () => {
    const layout = buildTimelineMarkers([]);
    expect(layout).toBeNull();
  });

  it('anchors the first article at exactly 0% and the last article at exactly 100%', () => {
    const articles = [
      { id: '1', title: 'First', publishedAt: new Date(baseTime).toISOString() },
      { id: '2', title: 'Middle', publishedAt: new Date(baseTime + 12 * 3600 * 1000).toISOString() },
      { id: '3', title: 'Last', publishedAt: new Date(baseTime + 24 * 3600 * 1000).toISOString() },
    ];

    const layout = buildTimelineMarkers(articles);
    expect(layout).not.toBeNull();
    expect(layout?.markers).toHaveLength(3);
    // Anchored at both ends
    expect(layout?.markers[0].pct).toBe(0);
    expect(layout?.markers[2].pct).toBe(100);
    expect(layout?.firstSeenLabel).not.toContain('Invalid');
    expect(layout?.lastUpdatedLabel).not.toContain('Invalid');
  });

  it('preserves every article with its individual thread color along the single horizontal rail', () => {
    // 48h timeline
    const span = 48 * 3600 * 1000;
    const colorMap = new Map<string, ThreadColorStyle>([
      ['thread-1', { id: 'thread-1', name: 'Thread 1', color: '#4F6D7A', bg: '', border: '', text: '', dotColor: '' }],
      ['thread-2', { id: 'thread-2', name: 'Thread 2', color: '#DD6E42', bg: '', border: '', text: '', dotColor: '' }],
    ]);

    const articles = [
      { id: '1', title: 'First', publishedAt: baseTime, threadId: 'thread-1' },
      // Article 2 and 3 are 10 minutes apart in a 48h timeline (~0.3% apart) with DIFFERENT threads
      { id: '2', title: 'Breaking A', publishedAt: baseTime + 10 * 3600 * 1000, threadId: 'thread-1' },
      { id: '3', title: 'Breaking B', publishedAt: baseTime + 10 * 3600 * 1000 + 10 * 60 * 1000, threadId: 'thread-2' },
      { id: '4', title: 'Last', publishedAt: baseTime + span, threadId: 'thread-1' },
    ];

    const layout = buildTimelineMarkers(articles, { colorMap });
    expect(layout).not.toBeNull();
    // All 4 articles are preserved! None are consolidated away
    expect(layout?.markers).toHaveLength(4);

    // Article 2 has Thread 1 color (#4F6D7A) and Article 3 has Thread 2 color (#DD6E42)
    expect(layout?.markers[1].color).toBe('#4F6D7A');
    expect(layout?.markers[2].color).toBe('#DD6E42');
  });

  it('handles fallback timestamps when articles are empty', () => {
    const layout = buildTimelineMarkers([], {
      fallbackFirstSeen: baseTime - 3600 * 1000,
      fallbackLastUpdated: baseTime,
    });

    expect(layout).not.toBeNull();
    expect(layout?.minTime).toBe(baseTime - 3600 * 1000);
    expect(layout?.maxTime).toBe(baseTime);
    expect(layout?.markers).toHaveLength(0);
  });

  it('handles single article timeline without floating or invalid date errors', () => {
    const articles = [{ id: '1', title: 'Solo', publishedAt: '2026-10-09T08:00:00.000Z' }];
    const layout = buildTimelineMarkers(articles);
    expect(layout).not.toBeNull();
    expect(layout?.markers).toHaveLength(1);
    expect(layout?.firstSeenLabel).not.toBe('N/A');
    expect(layout?.firstSeenLabel).not.toContain('Invalid');
  });
});

describe('ArticleTimelineSparkline resolveNearestMarkerIndex (Desktop Mouse Hover)', () => {
  const dummyArticle: TimelineArticle = { id: 'art-1', title: 'Test article' };
  const createMarker = (id: string, pct: number): TimelineMarker => ({
    id,
    pct,
    color: '#4F6D7A',
    threadStyle: DEFAULT_THREAD_COLOR,
    time: Date.now(),
    article: { ...dummyArticle, id },
  });

  it('returns null on empty markers array', () => {
    expect(resolveNearestMarkerIndex(100, { left: 0, width: 300 }, [])).toBeNull();
  });

  it('returns 0 for a single marker regardless of mouse clientX', () => {
    const markers = [createMarker('solo', 50)];
    expect(resolveNearestMarkerIndex(10, { left: 0, width: 300 }, markers)).toBe(0);
    expect(resolveNearestMarkerIndex(150, { left: 0, width: 300 }, markers)).toBe(0);
    expect(resolveNearestMarkerIndex(290, { left: 0, width: 300 }, markers)).toBe(0);
  });

  it('always activates the exact marker under the mouse cursor with zero displacement', () => {
    // Timeline with multiple spaced markers across the rail
    const markers = [
      createMarker('0', 0),
      createMarker('1', 10),
      createMarker('2', 25),
      createMarker('3', 40),
      createMarker('4', 60),
      createMarker('5', 85),
      createMarker('6', 100),
    ];
    const rect = { left: 50, width: 300 };

    // Hover directly over each marker dot: must activate that exact marker with zero errors
    for (let i = 0; i < markers.length; i++) {
      const physicalClientX = rect.left + (markers[i].pct / 100) * rect.width;
      expect(resolveNearestMarkerIndex(physicalClientX, rect, markers)).toBe(i);
    }
  });

  it('resolves the physically closest marker when mouse hovers over the rail between dots', () => {
    const markers = [createMarker('start', 0), createMarker('mid', 50), createMarker('end', 100)];
    const rect = { left: 0, width: 300 };

    // 20px is closer to 0px (marker 0) than 150px (marker 1)
    expect(resolveNearestMarkerIndex(20, rect, markers)).toBe(0);
    // 140px is closer to 150px (marker 1) than 0px (marker 0)
    expect(resolveNearestMarkerIndex(140, rect, markers)).toBe(1);
    // 260px is closer to 300px (marker 2) than 150px (marker 1)
    expect(resolveNearestMarkerIndex(260, rect, markers)).toBe(2);
  });
});

describe('ArticleTimelineSparkline resolveScrubIndex', () => {
  const dummyArticle: TimelineArticle = { id: 'art-1', title: 'Test article' };
  const createMarker = (id: string, pct: number): TimelineMarker => ({
    id,
    pct,
    color: '#4F6D7A',
    threadStyle: DEFAULT_THREAD_COLOR,
    time: Date.now(),
    article: { ...dummyArticle, id },
  });

  it('returns null on empty markers array', () => {
    expect(resolveScrubIndex(100, { left: 0, width: 300 }, [])).toBeNull();
  });

  it('returns 0 for a single marker regardless of clientX', () => {
    const markers = [createMarker('solo', 50)];
    expect(resolveScrubIndex(10, { left: 0, width: 300 }, markers)).toBe(0);
    expect(resolveScrubIndex(150, { left: 0, width: 300 }, markers)).toBe(0);
    expect(resolveScrubIndex(290, { left: 0, width: 300 }, markers)).toBe(0);
  });

  it('clamps clientX values outside track container boundaries', () => {
    const markers = [createMarker('1', 0), createMarker('2', 50), createMarker('3', 100)];
    const rect = { left: 100, width: 200 };

    // Way to the left (< rect.left)
    expect(resolveScrubIndex(50, rect, markers)).toBe(0);
    // Way to the right (> rect.left + rect.width)
    expect(resolveScrubIndex(350, rect, markers)).toBe(2);
  });

  it('resolves separated markers according to pointer position', () => {
    const markers = [createMarker('start', 0), createMarker('mid', 50), createMarker('end', 100)];
    const rect = { left: 0, width: 300 };

    expect(resolveScrubIndex(10, rect, markers)).toBe(0);
    expect(resolveScrubIndex(150, rect, markers)).toBe(1);
    expect(resolveScrubIndex(290, rect, markers)).toBe(2);
  });

  it('isolates every single marker sequentially during a thumb drag across a dense 6+ cluster', () => {
    // 6 markers piled up at exactly 50%
    const markers = [
      createMarker('1', 0),
      createMarker('c1', 50),
      createMarker('c2', 50),
      createMarker('c3', 50),
      createMarker('c4', 50),
      createMarker('c5', 50),
      createMarker('c6', 50),
      createMarker('8', 100),
    ];
    const rect = { left: 0, width: 300 };

    // Simulate sweeping the pointer 1px at a time across the track
    const hitIndices = new Set<number>();
    const orderOfAppearance: number[] = [];
    let lastIndex: number | null = null;

    for (let x = 0; x <= 300; x += 1) {
      const idx = resolveScrubIndex(x, rect, markers);
      if (idx !== null) {
        hitIndices.add(idx);
        if (idx !== lastIndex) {
          orderOfAppearance.push(idx);
          lastIndex = idx;
        }
      }
    }

    // Verify all 8 markers (including all 6 cluster dots) were cleanly isolated
    for (let i = 0; i < markers.length; i++) {
      expect(hitIndices.has(i)).toBe(true);
    }

    // Verify they appeared in strict chronological index order: 0, 1, 2, 3, 4, 5, 6, 7
    expect(orderOfAppearance).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('ArticleTimelineSparkline buildArticleDeepLinkUrl', () => {
  it('builds deep link with thread query and article hash when threadId is present', () => {
    const article: TimelineArticle = {
      id: 'art-99',
      threadId: 'cluster-42',
    };
    expect(buildArticleDeepLinkUrl('ukraine-energy-grid', article)).toBe(
      '/ukraine-energy-grid?thread=cluster-42#article-art-99'
    );
  });

  it('builds deep link without thread query when threadId is omitted', () => {
    const article: TimelineArticle = {
      id: 'art-100',
    };
    expect(buildArticleDeepLinkUrl('yorkshire-wildlife-park', article)).toBe(
      '/yorkshire-wildlife-park#article-art-100'
    );
  });

  it('handles existing leading slash in story slug safely', () => {
    const article: TimelineArticle = {
      id: 'art-200',
      threadId: 'thread-7',
    };
    expect(buildArticleDeepLinkUrl('/story/my-story', article)).toBe(
      '/story/my-story?thread=thread-7#article-art-200'
    );
  });

  it('URI encodes special characters in thread and article IDs', () => {
    const article: TimelineArticle = {
      id: 'art 1&2',
      threadId: 'cluster/special#1',
    };
    expect(buildArticleDeepLinkUrl('slug', article)).toBe(
      '/slug?thread=cluster%2Fspecial%231#article-art%201%262'
    );
  });
});

describe('ArticleTimelineSparkline sparklineStateReducer', () => {
  const initialState: SparklineState = { mode: 'idle', activeIndex: null };

  it('transitions idle -> hovering on HOVER_ENTER and back to idle on HOVER_LEAVE', () => {
    const s1 = sparklineStateReducer(initialState, { type: 'HOVER_ENTER', index: 3 });
    expect(s1).toEqual({ mode: 'hovering', activeIndex: 3 });

    const s2 = sparklineStateReducer(s1, { type: 'HOVER_LEAVE' });
    expect(s2).toEqual({ mode: 'idle', activeIndex: null });
  });

  it('ignores HOVER_ENTER if already scrubbing or latched', () => {
    const scrubbingState: SparklineState = { mode: 'scrubbing', activeIndex: 2 };
    expect(sparklineStateReducer(scrubbingState, { type: 'HOVER_ENTER', index: 5 })).toEqual(
      scrubbingState
    );

    const latchedState: SparklineState = { mode: 'latched', activeIndex: 2 };
    expect(sparklineStateReducer(latchedState, { type: 'HOVER_ENTER', index: 5 })).toEqual(
      latchedState
    );
  });

  it('handles touch scrub lifecycle: idle -> scrubbing -> latched on gesture release', () => {
    // Touch start
    const s1 = sparklineStateReducer(initialState, { type: 'SCRUB_START', index: 1 });
    expect(s1).toEqual({ mode: 'scrubbing', activeIndex: 1 });

    // Touch drag
    const s2 = sparklineStateReducer(s1, { type: 'SCRUB_MOVE', index: 4 });
    expect(s2).toEqual({ mode: 'scrubbing', activeIndex: 4 });

    // Pointer up: LATCHES activeIndex
    const s3 = sparklineStateReducer(s2, { type: 'SCRUB_END' });
    expect(s3).toEqual({ mode: 'latched', activeIndex: 4 });
  });

  it('allows stepping forward and backward while latched within bounds', () => {
    const latchedState: SparklineState = { mode: 'latched', activeIndex: 2 };

    const next = sparklineStateReducer(latchedState, { type: 'STEP', delta: 1, maxIndex: 4 });
    expect(next).toEqual({ mode: 'latched', activeIndex: 3 });

    const prev = sparklineStateReducer(latchedState, { type: 'STEP', delta: -1, maxIndex: 4 });
    expect(prev).toEqual({ mode: 'latched', activeIndex: 1 });

    // Clamping at bounds
    const atMax: SparklineState = { mode: 'latched', activeIndex: 4 };
    expect(sparklineStateReducer(atMax, { type: 'STEP', delta: 1, maxIndex: 4 })).toEqual({
      mode: 'latched',
      activeIndex: 4,
    });

    const atMin: SparklineState = { mode: 'latched', activeIndex: 0 };
    expect(sparklineStateReducer(atMin, { type: 'STEP', delta: -1, maxIndex: 4 })).toEqual({
      mode: 'latched',
      activeIndex: 0,
    });
  });

  it('supports keyboard navigation cycling', () => {
    const s1 = sparklineStateReducer(initialState, { type: 'KEY_NAV', delta: 1, maxIndex: 5 });
    expect(s1).toEqual({ mode: 'latched', activeIndex: 0 });

    const s2 = sparklineStateReducer(s1, { type: 'KEY_NAV', delta: 1, maxIndex: 5 });
    expect(s2).toEqual({ mode: 'latched', activeIndex: 1 });

    const s3 = sparklineStateReducer(s2, { type: 'KEY_NAV', delta: -1, maxIndex: 5 });
    expect(s3).toEqual({ mode: 'latched', activeIndex: 0 });
  });

  it('resets to idle on DISMISS from any active mode', () => {
    const latchedState: SparklineState = { mode: 'latched', activeIndex: 3 };
    expect(sparklineStateReducer(latchedState, { type: 'DISMISS' })).toEqual({
      mode: 'idle',
      activeIndex: null,
    });
  });
});
