import { buildTimelineMarkers } from './ArticleTimelineSparkline';
import { ThreadColorStyle } from '../utils/threadColors';

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
