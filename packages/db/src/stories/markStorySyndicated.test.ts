import { jest } from '@jest/globals';

const mockPrisma = {
  story: {
    update: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let markStorySyndicated: typeof import('./markStorySyndicated').markStorySyndicated;

beforeAll(async () => {
  ({ markStorySyndicated } = await import('./markStorySyndicated'));
});

describe('markStorySyndicated', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('updates the story with postedToBlueskyAt and blueskyUri', async () => {
    (mockPrisma.story.update as jest.Mock).mockResolvedValue({ id: 'story-1' } as any);

    await markStorySyndicated('story-1', 'at://did:plc:123/app.bsky.feed.post/456');

    expect(mockPrisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'story-1' },
        data: expect.objectContaining({
          blueskyUri: 'at://did:plc:123/app.bsky.feed.post/456',
          postedToBlueskyAt: expect.any(Date),
        }),
      })
    );
  });
});
