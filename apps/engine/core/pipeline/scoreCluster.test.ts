import { scoreCluster } from '@neus/db';

describe('scoreCluster', () => {
  it('prefers newer clusters', () => {
    const now = Date.now();
    const old = {
      articleAssignments: [
        { article: { publishedAt: new Date(now - 86400000), sourceId: 's1', sourceRel: { trustScore: 0.5 } } },
      ],
    } as any;
    const recent = {
      articleAssignments: [
        { article: { publishedAt: new Date(now), sourceId: 's1', sourceRel: { trustScore: 0.5 } } },
      ],
    } as any;
    expect(scoreCluster(recent)).toBeGreaterThan(scoreCluster(old));
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
    expect(scoreCluster(manySources)).toBeGreaterThan(scoreCluster(fewSources));
  });
});
