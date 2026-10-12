import { jest } from '@jest/globals';

const mockPrisma = {
  source: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.unstable_mockModule('../client', () => ({
  prisma: mockPrisma,
}));

let createSource: typeof import('./createSource').createSource;
let updateSource: typeof import('./updateSource').updateSource;

beforeAll(async () => {
  ({ createSource } = await import('./createSource'));
  ({ updateSource } = await import('./updateSource'));
});

describe('createSource & updateSource faviconUrl with Google CDN', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('createSource', () => {
    it('sets Google Favicon CDN URL using extracted domain from homepageUrl', async () => {
      (mockPrisma.source.create as any).mockResolvedValue({ id: 'src-1' });

      await createSource({
        name: 'The Times',
        homepageUrl: 'https://www.thetimes.com',
        rssFeedUrl: 'https://www.thetimes.com/rss',
      });

      expect(mockPrisma.source.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'The Times',
          domain: 'thetimes.com',
          faviconUrl: 'https://www.google.com/s2/favicons?domain=thetimes.com&sz=64',
        }),
      });
    });

    it('handles source creation without homepageUrl', async () => {
      (mockPrisma.source.create as any).mockResolvedValue({ id: 'src-2' });

      await createSource({
        name: 'Mystery News',
        rssFeedUrl: 'https://mystery.com/rss',
      });

      expect(mockPrisma.source.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Mystery News',
          domain: undefined,
          faviconUrl: undefined,
        }),
      });
    });
  });

  describe('updateSource', () => {
    it('updates faviconUrl to Google CDN when homepageUrl changes', async () => {
      (mockPrisma.source.update as any).mockResolvedValue({ id: 'src-1' });

      await updateSource({
        id: 'src-1',
        homepageUrl: 'https://www.ft.com',
      });

      expect(mockPrisma.source.update).toHaveBeenCalledWith({
        where: { id: 'src-1' },
        data: expect.objectContaining({
          domain: 'ft.com',
          faviconUrl: 'https://www.google.com/s2/favicons?domain=ft.com&sz=64',
        }),
      });
    });
  });
});
