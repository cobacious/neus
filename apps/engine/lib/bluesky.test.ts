import {
  getGraphemeLength,
  getUrlFacets,
  formatBlueskyPost,
  postToBluesky,
  isStoryAlreadyPosted,
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

    const { text, url, title } = formatBlueskyPost(story);

    const len = getGraphemeLength(text);
    expect(len).toBeLessThanOrEqual(300);
    expect(text).toContain('📰 Top Story:');
    expect(text).toContain('127 articles across 4 threads:');
    expect(text).toContain('• Initial Attack Incident (39)');
    expect(text).toContain(url);
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
});
