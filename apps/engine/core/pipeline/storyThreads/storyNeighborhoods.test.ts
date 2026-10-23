import {
  buildNeighborhoods,
  computeCentroidEmbedding,
  findCandidateStoriesForNeighborhood,
  isSettledNeighborhood,
} from './storyNeighborhoods';

describe('buildNeighborhoods', () => {
  it('returns empty array when fewer than 2 clusters have embeddings', () => {
    const res = buildNeighborhoods([
      { id: 'c1', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), embedding: null },
    ]);
    expect(res).toEqual([]);
  });

  it('groups clusters with cosine similarity >= threshold and ignores distant clusters', () => {
    const clusters = [
      { id: 'c1', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c3', createdAt: new Date(), embedding: [0, 1] },
    ];

    const neighborhoods = buildNeighborhoods(clusters, 0.78);
    expect(neighborhoods).toHaveLength(1);
    expect(neighborhoods[0].map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('computeCentroidEmbedding', () => {
  it('computes mean vector across cluster embeddings', () => {
    const clusters = [
      { id: 'c1', createdAt: new Date(), embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), embedding: [0.5, 0.5] },
    ];
    const centroid = computeCentroidEmbedding(clusters);
    expect(centroid).toEqual([0.75, 0.25]);
  });

  it('returns null if no clusters have embeddings', () => {
    expect(computeCentroidEmbedding([])).toBeNull();
  });
});

describe('findCandidateStoriesForNeighborhood', () => {
  it('matches existing stories by storyId on cluster or by vector similarity', () => {
    const neighborhood = [
      { id: 'c1', createdAt: new Date(), storyId: 's-existing', embedding: [1, 0] },
      { id: 'c2', createdAt: new Date(), storyId: null, embedding: [0, 1] },
    ];

    const existingStories = [
      { id: 's-existing', title: 'Story by ID', status: 'developing', overview: 'O1' },
      {
        id: 's-vector',
        title: 'Story by Vector',
        status: 'dormant',
        overview: 'O2',
        embedding: [0, 1],
      },
      {
        id: 's-unrelated',
        title: 'Unrelated',
        status: 'dormant',
        overview: 'O3',
        embedding: [-1, 0],
      },
    ];

    const candidates = findCandidateStoriesForNeighborhood(neighborhood, existingStories);

    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.id)).toContain('s-existing');
    expect(candidates.map((c) => c.id)).toContain('s-vector');
  });
});

describe('isSettledNeighborhood', () => {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const recentDate = new Date();

  const stories = [
    {
      id: 's1',
      title: 'Story 1',
      status: 'developing',
      overview: 'Overview 1',
      _count: { clusters: 2 },
    },
  ];

  it('returns true when all clusters belong to same story, have threads and are older than cutoff', () => {
    const neighborhood = [
      {
        id: 'c1',
        storyId: 's1',
        storyAngle: 'T1',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
      {
        id: 'c2',
        storyId: 's1',
        storyAngle: 'T2',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(true);
    expect(res.storyTitle).toBe('Story 1');
  });

  it('returns false when any cluster lacks storyId', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'T1', createdAt: oldDate },
      { id: 'c2', storyId: null, storyAngle: null, createdAt: oldDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when clusters belong to different stories', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'T1', createdAt: oldDate },
      { id: 'c2', storyId: 's2', storyAngle: 'T2', createdAt: oldDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when any cluster is missing storyAngle', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'T1', createdAt: oldDate },
      { id: 'c2', storyId: 's1', storyAngle: null, createdAt: oldDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when a cluster was created recently', () => {
    const neighborhood = [
      { id: 'c1', storyId: 's1', storyAngle: 'T1', createdAt: oldDate },
      { id: 'c2', storyId: 's1', storyAngle: 'T2', createdAt: recentDate },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when a cluster received a new article assignment recently', () => {
    const neighborhood = [
      {
        id: 'c1',
        storyId: 's1',
        storyAngle: 'T1',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
      {
        id: 'c2',
        storyId: 's1',
        storyAngle: 'T2',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: recentDate }],
      },
    ];
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('returns false when the story has more clusters in the DB than in this neighborhood', () => {
    const neighborhood = [
      {
        id: 'c1',
        storyId: 's1',
        storyAngle: 'T1',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
    ];
    // DB story has 2 clusters, but neighborhood only has 1
    const res = isSettledNeighborhood(neighborhood, stories, cutoff);
    expect(res.settled).toBe(false);
  });

  it('treats neighborhood as settled when activeStoryClusterCounts matches neighborhood, ignoring older DB clusters', () => {
    const neighborhood = [
      {
        id: 'c1',
        storyId: 's1',
        storyAngle: 'T1',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
      {
        id: 'c2',
        storyId: 's1',
        storyAngle: 'T2',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
    ];
    // DB story has 15 historical clusters, but active window only has 2
    const storiesWithManyDbClusters = [
      {
        id: 's1',
        title: 'Story 1',
        status: 'developing',
        overview: 'Overview',
        _count: { clusters: 15 },
      },
    ];
    const activeMap = new Map<string, number>([['s1', 2]]);
    const res = isSettledNeighborhood(neighborhood, storiesWithManyDbClusters, cutoff, activeMap);
    expect(res.settled).toBe(true);
    expect(res.storyTitle).toBe('Story 1');
  });

  it('returns false when activeStoryClusterCounts shows more active clusters outside the neighborhood', () => {
    const neighborhood = [
      {
        id: 'c1',
        storyId: 's1',
        storyAngle: 'T1',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
      {
        id: 'c2',
        storyId: 's1',
        storyAngle: 'T2',
        createdAt: oldDate,
        articleAssignments: [{ createdAt: oldDate }],
      },
    ];
    const activeMap = new Map<string, number>([['s1', 3]]);
    const res = isSettledNeighborhood(neighborhood, stories, cutoff, activeMap);
    expect(res.settled).toBe(false);
  });
});
