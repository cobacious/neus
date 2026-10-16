import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRankedClusters } from '@neus/db';

export interface AngleDigestItem {
  id: string;
  headline?: string | null;
  slug?: string | null;
  summary?: string | null;
  storyAngle?: string | null;
  articleCount: number;
  sources: string[];
}

export interface StoryDigestItem {
  id: string;
  title: string;
  slug: string;
  overview?: string | null;
  totalArticles: number;
  angles: AngleDigestItem[];
}

export interface StandaloneDigestItem {
  id: string;
  headline: string;
  slug: string;
  summary: string;
  articleCount: number;
}

export interface DigestOptions {
  date?: Date;
  stories: StoryDigestItem[];
  standaloneClusters: StandaloneDigestItem[];
}

const SITE_URL = 'https://neus.news';

export function formatSubstackMarkdown({
  date = new Date(),
  stories,
  standaloneClusters,
}: DigestOptions): string {
  const formattedDate = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sections: string[] = [];

  sections.push(`# Neus Weekly: The Perspectives Behind the Headlines
*${formattedDate}*

Welcome to this week's edition of Neus Weekly. At [Neus](${SITE_URL}), we aggregate coverage across the political spectrum to uncover how major stories are framed by different publications.

Rather than relying on a single perspective or sensation-driven headlines, here is a neutral breakdown of this week's major multi-angle developments and the distinct reporting angles surrounding them.

---`);

  if (stories.length > 0) {
    sections.push(`## Major Developing Stories\n`);

    stories.forEach((story, idx) => {
      const storyLines: string[] = [];
      storyLines.push(`### ${idx + 1}. ${story.title}`);

      if (story.overview) {
        storyLines.push(`> ${story.overview}\n`);
      }

      storyLines.push(`**Tracked Reporting Angles (${story.totalArticles} articles across ${story.angles.length} perspectives):**`);

      for (const angle of story.angles) {
        const label = angle.storyAngle || angle.headline || 'General Perspective';
        const sourcesText =
          angle.sources.length > 0
            ? ` · *Covered by ${angle.sources.slice(0, 4).join(', ')}${angle.sources.length > 4 ? ' and others' : ''}*`
            : '';
        const summaryText = angle.summary ? `\n  ${angle.summary}` : '';

        storyLines.push(`- **${label}** (${angle.articleCount} articles${sourcesText})${summaryText}`);
      }

      storyLines.push(`\n[Explore the interactive timeline and source breakdown on Neus](${SITE_URL}/${story.slug})\n\n---`);
      sections.push(storyLines.join('\n'));
    });
  }

  if (standaloneClusters.length > 0) {
    sections.push(`## Also in the News This Week\n`);

    for (const item of standaloneClusters) {
      sections.push(`- **[${item.headline}](${SITE_URL}/${item.slug})** (${item.articleCount} articles)\n  ${item.summary}`);
    }

    sections.push(`\n---`);
  }

  sections.push(`## About Neus

Neus is an independent news aggregator focused on neutrality, balance and thoughtful consumption. Follow our live coverage at [neus.news](${SITE_URL}) or subscribe to our [Outbound RSS Feed](${SITE_URL}/feed.xml).

If you have feedback or editorial suggestions, feel free to reply directly to this post.`);

  return sections.join('\n\n');
}

export async function generateWeeklyDigest(): Promise<{
  markdown: string;
  outputPath?: string;
}> {
  const clusters = await getRankedClusters(40);

  const seenStoryIds = new Set<string>();
  const stories: StoryDigestItem[] = [];
  const standaloneClusters: StandaloneDigestItem[] = [];

  for (const cluster of clusters) {
    if (!cluster.slug) continue;

    const story = cluster.story;
    if (story && story.clusters && story.clusters.length > 1) {
      if (seenStoryIds.has(story.id)) continue;
      seenStoryIds.add(story.id);

      const angles: AngleDigestItem[] = (story.clusters || [])
        .filter((c) => Boolean(c.slug))
        .map((angleCluster) => {
          const sourceSet = new Set<string>();
          for (const assignment of angleCluster.articleAssignments || []) {
            const relName = assignment.article?.sourceRel?.name;
            const fallbackName = assignment.article?.source;
            if (relName) sourceSet.add(relName);
            else if (fallbackName) sourceSet.add(fallbackName);
          }

          return {
            id: angleCluster.id,
            headline: angleCluster.headline,
            slug: angleCluster.slug,
            summary: angleCluster.summary,
            storyAngle: angleCluster.storyAngle,
            articleCount: angleCluster.articleAssignments?.length || 0,
            sources: Array.from(sourceSet),
          };
        });

      const totalArticles = angles.reduce((sum, a) => sum + a.articleCount, 0);
      const primarySlug = cluster.slug || angles[0]?.slug || '';

      stories.push({
        id: story.id,
        title: story.title,
        slug: primarySlug,
        overview: story.overview,
        totalArticles,
        angles,
      });
    } else if (standaloneClusters.length < 5 && cluster.headline && cluster.summary) {
      standaloneClusters.push({
        id: cluster.id,
        headline: cluster.headline,
        slug: cluster.slug,
        summary: cluster.summary,
        articleCount: cluster.articleAssignments?.length || 0,
      });
    }
  }

  // Limit top stories to 4
  const topStories = stories.slice(0, 4);
  const markdown = formatSubstackMarkdown({
    stories: topStories,
    standaloneClusters,
  });

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const outputDir = path.resolve(process.cwd(), '../../docs/newsletters');
  const outputPath = path.join(outputDir, `${dateStr}-weekly-digest.md`);

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, markdown, 'utf-8');
  } catch (err) {
    console.warn('[weeklyDigest] Could not save file to disk:', err);
  }

  return { markdown, outputPath };
}

// CLI Execution entry point
const isDirectCall =
  process.argv[1] &&
  (process.argv[1].endsWith('generateWeeklyDigest.ts') ||
    process.argv[1].endsWith('generateWeeklyDigest.js'));

if (isDirectCall) {
  generateWeeklyDigest()
    .then(({ outputPath, markdown }) => {
      console.log('Successfully generated weekly Substack digest!');
      if (outputPath) {
        console.log(`Saved draft to: ${outputPath}`);
      }
      console.log('\n--- PREVIEW SNIPPET ---\n');
      console.log(markdown.split('\n').slice(0, 30).join('\n'));
      console.log('\n...\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error generating weekly digest:', err);
      process.exit(1);
    });
}
