import {
  formatSubstackMarkdown,
  StoryDigestItem,
  StandaloneDigestItem,
} from './generateWeeklyDigest';

describe('formatSubstackMarkdown', () => {
  it('formats a weekly Substack draft with multi-angle stories and standalone items', () => {
    const fixedDate = new Date('2026-10-18T10:00:00Z');

    const stories: StoryDigestItem[] = [
      {
        id: 's1',
        title: 'Yorkshire Wildlife Park Incident and Inquiries',
        slug: 'yorkshire-wildlife-park-incident',
        overview: 'A fatal tiger encounter led to immediate reviews and council investigations.',
        totalArticles: 68,
        angles: [
          {
            id: 'a1',
            headline: 'Initial Attack Incident Details',
            slug: 'initial-attack',
            summary: 'A visitor entered the enclosure on Saturday afternoon.',
            storyAngle: 'Initial Attack Details',
            articleCount: 39,
            sources: ['BBC News', 'Sky News', 'The Guardian'],
          },
          {
            id: 'a2',
            headline: 'Family Tribute to William Chapman',
            slug: 'family-tribute',
            summary: 'Relatives remembered the former actor and described his mental health battles.',
            storyAngle: 'Family Tribute',
            articleCount: 29,
            sources: ['The Independent UK', 'Evening Standard'],
          },
        ],
      },
    ];

    const standaloneClusters: StandaloneDigestItem[] = [
      {
        id: 'c1',
        headline: 'Pakistan School Roof Collapse',
        slug: 'pakistan-school-roof-collapse',
        summary: 'Emergency workers cleared rubble after a classroom collapse killed 28 students.',
        articleCount: 11,
      },
    ];

    const markdown = formatSubstackMarkdown({
      date: fixedDate,
      stories,
      standaloneClusters,
    });

    expect(markdown).toContain('# Neus Weekly: The Perspectives Behind the Headlines');
    expect(markdown).toContain('*18 October 2026*');
    expect(markdown).toContain('## Major Developing Stories');
    expect(markdown).toContain('### 1. Yorkshire Wildlife Park Incident and Inquiries');
    expect(markdown).toContain('> A fatal tiger encounter led to immediate reviews and council investigations.');
    expect(markdown).toContain('**Tracked Reporting Angles (68 articles across 2 perspectives):**');
    expect(markdown).toContain('- **Initial Attack Details** (39 articles · *Covered by BBC News, Sky News, The Guardian*)');
    expect(markdown).toContain('- **Family Tribute** (29 articles · *Covered by The Independent UK, Evening Standard*)');
    expect(markdown).toContain('[Explore the interactive timeline and source breakdown on Neus](https://neus.news/yorkshire-wildlife-park-incident)');
    expect(markdown).toContain('## Also in the News This Week');
    expect(markdown).toContain('- **[Pakistan School Roof Collapse](https://neus.news/pakistan-school-roof-collapse)** (11 articles)');
    expect(markdown).toContain('## About Neus');
    expect(markdown).toContain('[Outbound RSS Feed](https://neus.news/feed.xml)');
  });
});
