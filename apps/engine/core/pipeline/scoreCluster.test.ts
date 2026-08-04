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
});
