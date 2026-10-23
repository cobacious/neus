import { buildHistogramBins, HistogramArticle } from './StoryThreadHistogram';
import { ThreadColorStyle } from '../utils/threadColors';

describe('StoryThreadHistogram buildHistogramBins', () => {
  it('returns empty bins and maxBinTotal 0 when articles are empty', () => {
    const result = buildHistogramBins([]);
    expect(result.bins).toHaveLength(0);
    expect(result.maxBinTotal).toBe(0);
    expect(result.validArticles).toHaveLength(0);
  });

  it('filters out invalid dates', () => {
    const articles: HistogramArticle[] = [
      { id: '1', title: 'Invalid A', publishedAt: 'not-a-date' },
      { id: '2', title: 'Invalid B', publishedAt: null },
      { id: '3', title: 'Invalid C', publishedAt: undefined },
    ];
    const result = buildHistogramBins(articles);
    expect(result.bins).toHaveLength(0);
    expect(result.validArticles).toHaveLength(0);
  });

  it('allocates articles into multiple granular 30-minute bins for a ~2-hour breaking story (like Everton)', () => {
    const articles: HistogramArticle[] = [
      { id: '1', title: 'Guardian', publishedAt: '2026-10-09T07:43:02.000Z' },
      { id: '2', title: 'BBC', publishedAt: '2026-10-09T08:23:50.000Z' },
      { id: '3', title: 'Al Jazeera', publishedAt: '2026-10-09T09:26:58.000Z' },
      { id: '4', title: 'The Times', publishedAt: '2026-10-09T09:49:44.000Z' },
    ];

    const result = buildHistogramBins(articles);
    expect(result.bins.length).toBeGreaterThan(1);
    expect(result.bins.length).toBeLessThanOrEqual(6);

    const nonZeroBins = result.bins.filter((b) => b.total > 0);
    expect(nonZeroBins.length).toBeGreaterThanOrEqual(3);

    const totalCount = result.bins.reduce((sum, b) => sum + b.total, 0);
    expect(totalCount).toBe(4);

    expect(result.bins[0].rangeLabel).toBeDefined();
    expect(result.bins[0].rangeLabel).toContain('–');
  });

  it('uses 15-minute buckets for very fast breaking events (<= 1.5 hours)', () => {
    const baseTime = new Date('2026-10-09T12:00:00.000Z').getTime();
    const articles: HistogramArticle[] = [
      { id: '1', title: 'Initial Flash', publishedAt: new Date(baseTime).toISOString() },
      {
        id: '2',
        title: 'Follow-up',
        publishedAt: new Date(baseTime + 20 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'Confirmation',
        publishedAt: new Date(baseTime + 45 * 60 * 1000).toISOString(),
      },
    ];

    const result = buildHistogramBins(articles);
    expect(result.bins.length).toBeGreaterThan(1);
    const binDuration = result.bins[0].endTime - result.bins[0].startTime;
    expect(binDuration).toBe(15 * 60 * 1000);
  });

  it('uses 1-hour or 2-hour buckets for 12-24h stories', () => {
    const baseTime = new Date('2026-10-09T00:00:00.000Z').getTime();
    const articles: HistogramArticle[] = [
      {
        id: '1',
        title: 'Morning',
        publishedAt: new Date(baseTime + 8 * 3600 * 1000).toISOString(),
      },
      {
        id: '2',
        title: 'Evening',
        publishedAt: new Date(baseTime + 20 * 3600 * 1000).toISOString(),
      },
    ];

    const result = buildHistogramBins(articles);
    const binDuration = result.bins[0].endTime - result.bins[0].startTime;
    expect([3600 * 1000, 2 * 3600 * 1000]).toContain(binDuration);
    expect(result.bins.length).toBeGreaterThan(1);
  });

  it('uses 1-day buckets for multi-day stories', () => {
    const baseTime = new Date('2026-10-01T10:00:00.000Z').getTime();
    const articles: HistogramArticle[] = [
      { id: '1', title: 'Day 1', publishedAt: new Date(baseTime).toISOString() },
      {
        id: '2',
        title: 'Day 3',
        publishedAt: new Date(baseTime + 2 * 24 * 3600 * 1000).toISOString(),
      },
      {
        id: '3',
        title: 'Day 5',
        publishedAt: new Date(baseTime + 4 * 24 * 3600 * 1000).toISOString(),
      },
    ];

    const result = buildHistogramBins(articles);
    const binDuration = result.bins[0].endTime - result.bins[0].startTime;
    expect(binDuration).toBe(24 * 3600 * 1000);
  });

  it('separates threads into distinct segments within bins', () => {
    const colorMap = new Map<string, ThreadColorStyle>([
      [
        'thread-1',
        {
          id: 'thread-1',
          name: 'Takeover Bid',
          color: '#4F6D7A',
          bg: '',
          border: '',
          text: '',
          dotColor: '',
        },
      ],
      [
        'thread-2',
        {
          id: 'thread-2',
          name: 'Financial Fallout',
          color: '#DD6E42',
          bg: '',
          border: '',
          text: '',
          dotColor: '',
        },
      ],
    ]);

    const articles: HistogramArticle[] = [
      {
        id: '1',
        title: 'Bid A',
        publishedAt: '2026-10-09T08:05:00.000Z',
        threadId: 'thread-1',
        threadName: 'Takeover Bid',
      },
      {
        id: '2',
        title: 'Finance B',
        publishedAt: '2026-10-09T08:10:00.000Z',
        threadId: 'thread-2',
        threadName: 'Financial Fallout',
      },
      {
        id: '3',
        title: 'Bid C',
        publishedAt: '2026-10-09T08:12:00.000Z',
        threadId: 'thread-1',
        threadName: 'Takeover Bid',
      },
    ];

    const result = buildHistogramBins(articles, colorMap);
    const activeBin = result.bins.find((b) => b.total === 3);
    expect(activeBin).toBeDefined();
    expect(activeBin?.segments).toHaveLength(2);

    const seg1 = activeBin?.segments.find((s) => s.threadId === 'thread-1');
    const seg2 = activeBin?.segments.find((s) => s.threadId === 'thread-2');

    expect(seg1?.count).toBe(2);
    expect(seg1?.color).toBe('#4F6D7A');
    expect(seg2?.count).toBe(1);
    expect(seg2?.color).toBe('#DD6E42');
  });

  it('formats same-day sub-day labels cleanly without repeating the weekday name', () => {
    const articles: HistogramArticle[] = [
      { id: '1', title: 'Start', publishedAt: '2026-10-09T08:00:00.000Z' },
      { id: '2', title: 'End', publishedAt: '2026-10-09T10:00:00.000Z' },
    ];

    const result = buildHistogramBins(articles);
    expect(result.bins.length).toBeGreaterThan(1);

    expect(result.bins[0].label).toMatch(/[A-Za-z]{3}\s\d{2}:\d{2}/);

    if (result.bins.length > 1) {
      expect(result.bins[1].label).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});
