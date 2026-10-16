import { scoreCluster } from './scoreCluster';

describe('scoreCluster', () => {
  it('prefers newer clusters', () => {
    const now = Date.now();
    const old = {
      articleAssignments: [
        {
          article: {
            publishedAt: new Date(now - 86400000),
            sourceId: 's1',
            sourceRel: { trustScore: 0.5 },
          },
        },
      ],
    } as any;
    const recent = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.5 } } },
      ],
    } as any;
    expect(scoreCluster(recent, now)).toBeGreaterThan(scoreCluster(old, now));
  });

  it('values coverage breadth', () => {
    const now = Date.now();
    const fewSources = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.5 } } },
        { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.5 } } },
      ],
    } as any;
    const manySources = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.5 } } },
        { article: { publishedAt: new Date(now), sourceId: 's2', sourceRel: { trustScore: 0.5 } } },
      ],
    } as any;
    expect(scoreCluster(manySources, now)).toBeGreaterThan(scoreCluster(fewSources, now));
  });

  it('ranks fresh articles above old high-coverage stories from past weeks', () => {
    const now = Date.now();
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

    const oldMultiSourceStory = {
      articleAssignments: Array.from({ length: 10 }, (_, i) => ({
        article: {
          publishedAt: new Date(now - TWO_WEEKS_MS),
          sourceId: `source_${i}`,
          sourceRel: { trustScore: 0.9 },
        },
      })),
    } as any;

    const freshSingleSourceStory = {
      articleAssignments: [
        {
          article: {
            publishedAt: new Date(now),
            sourceId: 's1',
            sourceRel: { trustScore: 0.5 },
          },
        },
      ],
    } as any;

    expect(scoreCluster(freshSingleSourceStory, now)).toBeGreaterThan(
      scoreCluster(oldMultiSourceStory, now)
    );
  });

  it('prevents single-source churn from resetting the consensus recency clock on multi-source stories', () => {
    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // A settled story where original sources reported 3 days ago,
    // but a single tabloid source spams 5 new articles at "now"
    const churnedStory = {
      articleAssignments: [
        { article: { publishedAt: new Date(now - THREE_DAYS_MS), sourceId: 'bbc', sourceRel: { trustScore: 0.95 } } },
        { article: { publishedAt: new Date(now - THREE_DAYS_MS), sourceId: 'guardian', sourceRel: { trustScore: 0.90 } } },
        { article: { publishedAt: new Date(now), sourceId: 'tabloid', sourceRel: { trustScore: 0.35 } } },
        { article: { publishedAt: new Date(now), sourceId: 'tabloid', sourceRel: { trustScore: 0.35 } } },
        { article: { publishedAt: new Date(now), sourceId: 'tabloid', sourceRel: { trustScore: 0.35 } } },
      ],
    } as any;

    // A genuinely breaking story where 2 distinct sources confirmed it 1 hour ago
    const genuineBreakingStory = {
      articleAssignments: [
        { article: { publishedAt: new Date(now - 3600000), sourceId: 'bbc', sourceRel: { trustScore: 0.95 } } },
        { article: { publishedAt: new Date(now - 3600000), sourceId: 'guardian', sourceRel: { trustScore: 0.90 } } },
      ],
    } as any;

    // The genuine breaking story with 2 recent sources should decisively outrank the churned story
    expect(scoreCluster(genuineBreakingStory, now)).toBeGreaterThan(scoreCluster(churnedStory, now));

    // The churned story score should reflect the 3-day decay of consensus (not 0 hours)
    const score = scoreCluster(churnedStory, now);
    expect(score).toBeLessThan(0.3);
  });

  it('averages trust across unique sources rather than raw article count to prevent spam dilution', () => {
    const now = Date.now();

    // 1 high-trust article + 1 low-trust article
    const balancedStory = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 'bbc', sourceRel: { trustScore: 0.95 } } },
        { article: { publishedAt: new Date(now), sourceId: 'tabloid', sourceRel: { trustScore: 0.35 } } },
      ],
    } as any;

    // 1 high-trust article + 10 low-trust articles from the same single tabloid source
    const spammedStory = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 'bbc', sourceRel: { trustScore: 0.95 } } },
        ...Array.from({ length: 10 }, () => ({
          article: { publishedAt: new Date(now), sourceId: 'tabloid', sourceRel: { trustScore: 0.35 } },
        })),
      ],
    } as any;

    // The base quality and trust score should be identical because the unique source set is the same
    expect(scoreCluster(spammedStory, now)).toBeCloseTo(scoreCluster(balancedStory, now), 5);
  });
});
