import { jest } from '@jest/globals';

const createMany = jest.fn();
jest.unstable_mockModule('../client', () => ({
  prisma: {
    articleClusterAssignment: { createMany },
  },
}));

let createArticleAssignments: typeof import('./createArticleAssignments').createArticleAssignments;

beforeAll(async () => {
  ({ createArticleAssignments } = await import('./createArticleAssignments'));
});

describe('createArticleAssignments', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates article assignments with skipDuplicates: true', async () => {
    createMany.mockResolvedValue({ count: 2 } as any);

    const assignments = [
      { articleId: 'a1', clusterId: 'c1', similarity: 0.95, method: 'embedding' },
      { articleId: 'a2', clusterId: 'c1', similarity: 0.92, method: 'embedding' },
    ];

    await createArticleAssignments(assignments);

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: assignments,
      skipDuplicates: true,
    });
  });
});
