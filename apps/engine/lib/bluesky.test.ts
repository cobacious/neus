import { jest } from '@jest/globals';
import {
  getGraphemeLength,
  getUrlFacets,
  createLinkFacet,
  formatBlueskyPost,
  postToBluesky,
  isStoryAlreadyPosted,
  uploadBlobToBluesky,
  BlueskyStoryData,
} from './bluesky';

describe('Bluesky Publisher', () => {
  it('calculates grapheme lengths accurately including emojis', () => {
    expect(getGraphemeLength('Hello')).toBe(5);
    expect(getGraphemeLength('📰')).toBe(1);
    expect(getGraphemeLength('📰 Hello World')).toBe(13);
  });

  it('detects URL byte facets correctly for links', () => {
    const text = 'Check coverage at https://neus.news/story-1 today';
    const facets = getUrlFacets(text);

    expect(facets).toHaveLength(1);
    expect(facets[0].features[0].uri).toBe('https://neus.news/story-1');
    expect(facets[0].index.byteStart).toBe(18);
    expect(facets[0].index.byteEnd).toBe(43);
  });

  it('binds anchor facet to the final CTA when anchor text appears multiple times', () => {
    const text = 'Read on neus.news ↗ headline discussion\n\nRead on neus.news ↗';
    const facet = createLinkFacet(text, 'Read on neus.news ↗', 'https://neus.news/target');

    expect(facet).not.toBeNull();
    const encoder = new TextEncoder();
    const expectedByteStart = encoder.encode('Read on neus.news ↗ headline discussion\n\n').byteLength;
    expect(facet!.index.byteStart).toBe(expectedByteStart);
  });

  it('formats post within 300-grapheme limit with thread breakdowns and link', () => {
    const story: BlueskyStoryData = {
      id: 's1',
      title: 'Fatal Tiger Enclosure Incident at Yorkshire Wildlife Park and Aftermath',
      slug: 'serious-incident-at-yorkshire-wildlife-park-involves-tiger-attack',
      overview: 'Inquiries proceed following the tiger attack.',
      totalArticles: 127,
      angles: [
        { headline: 'Initial Attack Incident', storyAngle: 'Initial Attack Incident', articleCount: 39 },
        { headline: 'Family Tribute and Background', storyAngle: 'Family Tribute and Background', articleCount: 29 },
        { headline: 'Authorities and Investigation Updates', storyAngle: 'Authorities Updates', articleCount: 18 },
        { headline: 'Enclosure Reopening', storyAngle: 'Enclosure Reopening', articleCount: 10 },
      ],
    };

    const { text, url, title, facets } = formatBlueskyPost(story);

    const len = getGraphemeLength(text);
    expect(len).toBeLessThanOrEqual(300);
    expect(text).toContain(story.title);
    expect(text).not.toContain('Top Story:');
    expect(text).not.toContain('📰');
    expect(text).toContain('127 articles across 4 threads:');
    expect(text).toContain('• Initial Attack Incident (39)');
    expect(text).toContain('Read on neus.news ↗');
    expect(text).not.toContain(url);
    expect(facets).toHaveLength(1);
    expect(facets[0].features[0].uri).toBe(url);
    expect(title).toBe(story.title);
  });

  it('detects if a story has already been posted from recent URL set', () => {
    const postedUrls = new Set([
      'https://neus.news/serious-incident-at-yorkshire-wildlife-park-involves-tiger-attack',
      'https://neus.news/another-story-slug',
    ]);

    expect(
      isStoryAlreadyPosted(
        { slug: 'serious-incident-at-yorkshire-wildlife-park-involves-tiger-attack' },
        postedUrls
      )
    ).toBe(true);

    expect(
      isStoryAlreadyPosted(
        { slug: 'vatican-confirms-pope-leo-has-lung-cancer' },
        postedUrls
      )
    ).toBe(false);
  });

  it('correctly matches exact path segments and rejects false-positive substrings and third-party domains', () => {
    const postedUrls = new Set([
      'https://neus.news/us-interest-rates-cut',
      'https://theguardian.com/world/us-interest-rates',
      'https://neus.news/bank-of-england-decision',
    ]);

    // Substring matching would falsely match 'us-interest-rates' inside 'us-interest-rates-cut'
    expect(
      isStoryAlreadyPosted(
        { slug: 'us-interest-rates' },
        postedUrls
      )
    ).toBe(false);

    // Third-party domain matching 'us-interest-rates' should be skipped
    expect(
      isStoryAlreadyPosted(
        { slug: 'us-interest-rates' },
        new Set(['https://theguardian.com/world/us-interest-rates'])
      )
    ).toBe(false);

    // Exact match on full slug
    expect(
      isStoryAlreadyPosted(
        { slug: 'us-interest-rates-cut' },
        postedUrls
      )
    ).toBe(true);

    // Exact match on direct path
    expect(
      isStoryAlreadyPosted(
        { slug: 'bank-of-england-decision' },
        postedUrls
      )
    ).toBe(true);
  });

  it('supports dry-run mode without sending HTTP requests', async () => {
    const result = await postToBluesky({
      text: 'Test post text https://neus.news',
      url: 'https://neus.news',
      title: 'Test',
      description: 'Desc',
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.charCount).toBeGreaterThan(0);
  });

  it('returns error if post text exceeds 300 graphemes', async () => {
    const longText = 'a'.repeat(305);
    const result = await postToBluesky({
      text: longText,
      url: 'https://neus.news',
      title: 'Test',
      description: 'Desc',
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds Bluesky limit');
  });

  describe('uploadBlobToBluesky', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('uploads image buffer and returns blob descriptor on success', async () => {
      const mockBlob = {
        $type: 'blob',
        ref: { $link: 'bafkreib...' },
        mimeType: 'image/png',
        size: 1024,
      };

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url === 'https://neus.news/og-image.png') {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'image/png']]),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
          });
        }
        if (url === 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ blob: mockBlob }),
          });
        }
        return Promise.reject(new Error('Unknown URL: ' + url));
      }) as any;

      const blob = await uploadBlobToBluesky('jwt-token-123', 'https://neus.news/og-image.png');
      expect(blob).toEqual(mockBlob);
    });

    it('gracefully returns null if fetching thumbnail image fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as any;

      const blob = await uploadBlobToBluesky('jwt-token-123', 'https://neus.news/not-found.png');
      expect(blob).toBeNull();
    });

    it('sanitises content-type header with parameter directives', async () => {
      let passedContentType = '';
      global.fetch = jest.fn().mockImplementation((url: string, init?: any) => {
        if (url === 'https://neus.news/og-image.png') {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'image/png; charset=utf-8']]),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(512)),
          });
        }
        if (url === 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob') {
          passedContentType = init?.headers?.['Content-Type'];
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ blob: { $type: 'blob' } }),
          });
        }
        return Promise.reject(new Error('Unknown URL: ' + url));
      }) as any;

      await uploadBlobToBluesky('jwt-token-123', 'https://neus.news/og-image.png');
      expect(passedContentType).toBe('image/png');
    });

    it('returns null if custom image URL returns non-image', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url === 'https://neus.news/dynamic-og-route') {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'text/html; charset=utf-8']]),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
          });
        }
        return Promise.reject(new Error('Unknown URL: ' + url));
      }) as any;

      const blob = await uploadBlobToBluesky('jwt-token-123', 'https://neus.news/dynamic-og-route');
      expect(blob).toBeNull();
    });
  });

  it('omits thumbUrl in formatBlueskyPost for clean compact link embeds', () => {
    const story: BlueskyStoryData = {
      id: 's1',
      title: 'French Protests Erupt Across Paris',
      slug: 'french-protests-erupt-across-paris',
      overview: 'Protests continue across multiple cities.',
      totalArticles: 15,
      angles: [
        { headline: 'Protests and Police Clashes', storyAngle: 'Protests and Police Clashes', articleCount: 10 },
        { headline: 'Government Response', storyAngle: 'Government Response', articleCount: 5 },
      ],
    };

    const formatted = formatBlueskyPost(story);
    expect((formatted as any).thumbUrl).toBeUndefined();
    expect(formatted.title).toBe(story.title);
  });

  it('constructs external embed record without thumb property when thumbUrl is omitted', async () => {
    let capturedRecord: any = null;
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation((url: string, init?: any) => {
      if (url === 'https://bsky.social/xrpc/com.atproto.server.createSession') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ accessJwt: 'token', did: 'did:plc:123' }),
        });
      }
      if (url === 'https://bsky.social/xrpc/com.atproto.repo.createRecord') {
        capturedRecord = JSON.parse(init.body).record;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ uri: 'at://did:plc:123/app.bsky.feed.post/123', cid: 'cid123' }),
        });
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    }) as any;

    try {
      const result = await postToBluesky({
        handle: 'test.bsky.social',
        password: 'password123',
        text: 'Headline text',
        url: 'https://neus.news/slug',
        title: 'Headline Title',
        description: 'Overview description',
      });

      expect(result.success).toBe(true);
      expect(capturedRecord).toBeDefined();
      expect(capturedRecord.embed.$type).toBe('app.bsky.embed.external');
      expect(capturedRecord.embed.external.thumb).toBeUndefined();
      expect(capturedRecord.embed.external.title).toBe('Headline Title');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
