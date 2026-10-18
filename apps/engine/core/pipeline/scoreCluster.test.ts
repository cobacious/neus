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

  it('caps article volume at 2.5x unique sources to prevent single-source spam gaming', () => {
    const now = Date.now();

    // 1 article from BBC + 4 articles from tabloid (total 5 articles, exactly 2.5 * 2)
    const cappedStory = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 'bbc', sourceRel: { trustScore: 0.95 } } },
        ...Array.from({ length: 4 }, () => ({
          article: { publishedAt: new Date(now), sourceId: 'tabloid', sourceRel: { trustScore: 0.35 } },
        })),
      ],
    } as any;

    // 1 article from BBC + 20 articles from tabloid (total 21 articles, should be capped at 5)
    const spammedStory = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 'bbc', sourceRel: { trustScore: 0.95 } } },
        ...Array.from({ length: 20 }, () => ({
          article: { publishedAt: new Date(now), sourceId: 'tabloid', sourceRel: { trustScore: 0.35 } },
        })),
      ],
    } as any;

    // The score should be identical because effective articles are strictly capped at 2.5 * uniqueSources
    expect(scoreCluster(spammedStory, now)).toBeCloseTo(scoreCluster(cappedStory, now), 5);
  });

  it('ranks an 18-hour 12-source major event above a 1.5-hour 2-source brief', () => {
    const now = Date.now();
    const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;
    const NINETY_MINS_MS = 90 * 60 * 1000;

    const majorWorldStory = {
      articleAssignments: Array.from({ length: 12 }, (_, i) => ({
        article: {
          publishedAt: new Date(now - EIGHTEEN_HOURS_MS),
          sourceId: `major_source_${i}`,
          sourceRel: { trustScore: 0.88 },
        },
      })),
    } as any;

    const minorSportsBrief = {
      articleAssignments: [
        { article: { publishedAt: new Date(now - NINETY_MINS_MS), sourceId: 'bbc', sourceRel: { trustScore: 0.90 } } },
        { article: { publishedAt: new Date(now - NINETY_MINS_MS), sourceId: 'aljazeera', sourceRel: { trustScore: 0.80 } } },
      ],
    } as any;

    expect(scoreCluster(majorWorldStory, now)).toBeGreaterThan(scoreCluster(minorSportsBrief, now));
  });

  it('applies umbrella factor when cluster belongs to a multi-angle story', () => {
    const now = Date.now();
    const standalone = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.8 } } },
        { article: { publishedAt: new Date(now), sourceId: 's2', sourceRel: { trustScore: 0.8 } } },
      ],
    } as any;

    const multiAngle = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.8 } } },
        { article: { publishedAt: new Date(now), sourceId: 's2', sourceRel: { trustScore: 0.8 } } },
      ],
      storyAngleCount: 3,
    } as any;

    expect(scoreCluster(multiAngle, now)).toBeGreaterThan(scoreCluster(standalone, now));
  });
});
