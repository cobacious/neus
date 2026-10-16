import { getRankedClusters } from '@neus/db';

export interface BlueskyAngle {
  headline?: string | null;
  storyAngle?: string | null;
  articleCount: number;
}

export interface BlueskyStoryData {
  id: string;
  title: string;
  slug: string;
  overview?: string | null;
  totalArticles: number;
  angles: BlueskyAngle[];
}

export interface BlueskyPostResult {
  success: boolean;
  uri?: string;
  cid?: string;
  error?: string;
  dryRun?: boolean;
  text: string;
  charCount: number;
}

const SITE_URL = 'https://neus.news';
const MAX_GRAPHEMES = 300;

export function getGraphemeLength(text: string): number {
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text)).length;
  }
  return Array.from(text).length;
}

export function getUrlFacets(text: string): Array<{
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: 'app.bsky.richtext.facet#link'; uri: string }>;
}> {
  const encoder = new TextEncoder();
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: 'app.bsky.richtext.facet#link'; uri: string }>;
  }> = [];

  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const prefix = text.slice(0, match.index);
    const byteStart = encoder.encode(prefix).byteLength;
    const byteEnd = byteStart + encoder.encode(url).byteLength;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
    });
  }
  return facets;
}

export function formatBlueskyPost(story: BlueskyStoryData): {
  text: string;
  url: string;
  title: string;
  description: string;
} {
  const url = `${SITE_URL}/${story.slug}`;
  const totalArts = story.totalArticles;
  const numAngles = story.angles.length;

  // Candidate title
  let cleanTitle = story.title.trim();
  if (cleanTitle.length > 70) {
    cleanTitle = cleanTitle.slice(0, 67) + '...';
  }

  // Helper to build post text given a list of angle lines
  const buildText = (titleStr: string, angleLines: string[]) => {
    const parts = [
      `📰 Media Framing: ${titleStr}`,
      '',
      `${totalArts} articles across ${numAngles} perspectives:`,
      ...angleLines,
      '',
      `Balanced breakdown:`,
      url,
    ];
    return parts.join('\n');
  };

  // Try with top 3 angles
  const candidateAngles = story.angles.slice(0, 3);
  let angleLines = candidateAngles.map((a) => {
    let name = (a.storyAngle || a.headline || 'Perspective').trim();
    if (name.length > 32) {
      name = name.slice(0, 30) + '..';
    }
    return `• ${name} (${a.articleCount} arts)`;
  });

  let postText = buildText(cleanTitle, angleLines);

  // If over 300 graphemes, drop to top 2 angles
  if (getGraphemeLength(postText) > MAX_GRAPHEMES && angleLines.length > 2) {
    angleLines = angleLines.slice(0, 2);
    postText = buildText(cleanTitle, angleLines);
  }

  // If still over 300 graphemes, tighten title
  if (getGraphemeLength(postText) > MAX_GRAPHEMES) {
    cleanTitle = cleanTitle.slice(0, 45) + '...';
    postText = buildText(cleanTitle, angleLines);
  }

  // If still over (e.g. exceptionally long slug), drop to 1 angle
  if (getGraphemeLength(postText) > MAX_GRAPHEMES && angleLines.length > 1) {
    angleLines = angleLines.slice(0, 1);
    postText = buildText(cleanTitle, angleLines);
  }

  const description =
    story.overview ||
    `Exploring ${totalArts} articles across ${numAngles} reporting perspectives on Neus.`;

  return {
    text: postText,
    url,
    title: story.title,
    description,
  };
}

export async function postToBluesky(options: {
  handle?: string;
  password?: string;
  text: string;
  url: string;
  title: string;
  description: string;
  dryRun?: boolean;
}): Promise<BlueskyPostResult> {
  const { handle, password, text, url, title, description, dryRun = false } = options;
  const charCount = getGraphemeLength(text);

  if (charCount > MAX_GRAPHEMES) {
    return {
      success: false,
      text,
      charCount,
      error: `Post exceeds Bluesky limit: ${charCount} graphemes (max ${MAX_GRAPHEMES})`,
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      text,
      charCount,
    };
  }

  if (!handle || !password) {
    return {
      success: false,
      text,
      charCount,
      error: 'Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD in environment.',
    };
  }

  try {
    // 1. Create session via AT Protocol XRPC
    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: handle,
        password,
      }),
    });

    if (!sessionRes.ok) {
      const errBody = await sessionRes.text();
      throw new Error(`Bluesky login failed (${sessionRes.status}): ${errBody}`);
    }

    const sessionData = (await sessionRes.json()) as any;
    const accessJwt = sessionData.accessJwt;
    const did = sessionData.did;

    // 2. Generate facets for clickable links
    const facets = getUrlFacets(text);

    // 3. Construct record with link card embed
    const record: any = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      facets: facets.length > 0 ? facets : undefined,
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: url,
          title,
          description,
        },
      },
    };

    // 4. Create post record
    const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.feed.post',
        record,
      }),
    });

    if (!postRes.ok) {
      const errBody = await postRes.text();
      throw new Error(`Bluesky post creation failed (${postRes.status}): ${errBody}`);
    }

    const postData = (await postRes.json()) as any;
    return {
      success: true,
      uri: postData.uri,
      cid: postData.cid,
      text,
      charCount,
    };
  } catch (err: any) {
    return {
      success: false,
      text,
      charCount,
      error: err?.message || String(err),
    };
  }
}

export async function draftOrPublishTopStory(options?: {
  dryRun?: boolean;
}): Promise<BlueskyPostResult | null> {
  const isDryRun = options?.dryRun ?? true;
  const clusters = await getRankedClusters(25);

  // Find the top multi-angle story
  let selectedStory: BlueskyStoryData | null = null;

  for (const cluster of clusters) {
    if (!cluster.slug) continue;
    const story = cluster.story;
    if (story && story.clusters && story.clusters.length > 1) {
      const angles = (story.clusters || [])
        .filter((c) => Boolean(c.slug))
        .map((c) => ({
          headline: c.headline,
          storyAngle: c.storyAngle,
          articleCount: c.articleAssignments?.length || 0,
        }))
        .sort((a, b) => b.articleCount - a.articleCount);

      const totalArticles = angles.reduce((sum, a) => sum + a.articleCount, 0);
      const primarySlug = cluster.slug || (story.clusters[0] as any)?.slug || '';

      selectedStory = {
        id: story.id,
        title: story.title,
        slug: primarySlug,
        overview: story.overview,
        totalArticles,
        angles,
      };
      break;
    }
  }

  if (!selectedStory) {
    console.log('No eligible multi-angle stories found to post.');
    return null;
  }

  const { text, url, title, description } = formatBlueskyPost(selectedStory);

  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;

  const result = await postToBluesky({
    handle,
    password,
    text,
    url,
    title,
    description,
    dryRun: isDryRun || (!handle || !password),
  });

  return result;
}

// CLI Execution entry point
const isDirectCall =
  process.argv[1] &&
  (process.argv[1].endsWith('bluesky.ts') || process.argv[1].endsWith('bluesky.js'));

if (isDirectCall) {
  const isPublish = process.argv.includes('--publish');
  const isDryRun = !isPublish;

  console.log(`\n--- BLUESKY POST GENERATOR [Mode: ${isDryRun ? 'DRY RUN' : 'PUBLISH'}] ---\n`);

  draftOrPublishTopStory({ dryRun: isDryRun })
    .then((result) => {
      if (!result) {
        process.exit(0);
      }

      console.log('--- FORMATTED POST CONTENT ---');
      console.log(result.text);
      console.log('------------------------------');
      console.log(`Character count: ${result.charCount} / ${MAX_GRAPHEMES} graphemes`);

      if (result.dryRun) {
        console.log('\n[Dry Run]: No network request was made to Bluesky.');
        console.log('To publish for real, set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env, then run with --publish.');
      } else if (result.success) {
        console.log(`\nSuccessfully posted to Bluesky! URI: ${result.uri}`);
      } else {
        console.error(`\nFailed to post: ${result.error}`);
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Bluesky execution error:', err);
      process.exit(1);
    });
}
