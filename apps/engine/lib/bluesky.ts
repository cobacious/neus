import { getRankedClusters, markStorySyndicated } from '@neus/db';

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
  ogImageUrl?: string;
}

export interface BlueskyFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: 'app.bsky.richtext.facet#link'; uri: string }>;
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
const DEFAULT_OG_IMAGE = 'https://neus.news/og-image.png';
export const LINK_ANCHOR_TEXT = 'Read on neus.news ↗';
const MAX_GRAPHEMES = 300;

export function getGraphemeLength(text: string): number {
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text)).length;
  }
  return Array.from(text).length;
}

export function createLinkFacet(
  fullText: string,
  anchorText: string,
  targetUrl: string
): BlueskyFacet | null {
  const encoder = new TextEncoder();
  const charIndex = fullText.lastIndexOf(anchorText);
  if (charIndex === -1) return null;

  const prefix = fullText.slice(0, charIndex);
  const byteStart = encoder.encode(prefix).byteLength;
  const byteEnd = byteStart + encoder.encode(anchorText).byteLength;

  return {
    index: { byteStart, byteEnd },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: targetUrl }],
  };
}

export function getUrlFacets(
  text: string,
  baseFacets?: BlueskyFacet[]
): BlueskyFacet[] {
  const encoder = new TextEncoder();
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const facets: BlueskyFacet[] = baseFacets ? [...baseFacets] : [];

  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const prefix = text.slice(0, match.index);
    const byteStart = encoder.encode(prefix).byteLength;
    const byteEnd = byteStart + encoder.encode(url).byteLength;

    const overlap = facets.some(
      (f) =>
        (byteStart >= f.index.byteStart && byteStart < f.index.byteEnd) ||
        (byteEnd > f.index.byteStart && byteEnd <= f.index.byteEnd)
    );

    if (!overlap) {
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
      });
    }
  }
  return facets;
}

export function formatBlueskyPost(story: BlueskyStoryData): {
  text: string;
  url: string;
  title: string;
  description: string;
  thumbUrl: string;
  facets: BlueskyFacet[];
} {
  const url = `${SITE_URL}/${story.slug}`;
  const totalArts = story.totalArticles;
  const numAngles = story.angles.length;

  // Reclaimed budget: title can safely be up to 85 characters
  let cleanTitle = story.title.trim();
  if (cleanTitle.length > 85) {
    cleanTitle = cleanTitle.slice(0, 82) + '...';
  }

  // Helper to build post text with anchor text instead of naked URL
  const buildText = (titleStr: string, angleLines: string[]) => {
    const parts = [
      `📰 Top Story: ${titleStr}`,
      '',
      `${totalArts} articles across ${numAngles} threads:`,
      ...angleLines,
      '',
      LINK_ANCHOR_TEXT,
    ];
    return parts.join('\n');
  };

  // Up to 3 threads with generous 45-char names
  const candidateAngles = story.angles.slice(0, 3);
  let angleLines = candidateAngles.map((a) => {
    let name = (a.storyAngle || a.headline || 'Thread').trim();
    if (name.length > 45) {
      name = name.slice(0, 43) + '..';
    }
    return `• ${name} (${a.articleCount})`;
  });

  let postText = buildText(cleanTitle, angleLines);

  // If over 300 graphemes, drop to top 2 threads
  if (getGraphemeLength(postText) > MAX_GRAPHEMES && angleLines.length > 2) {
    angleLines = angleLines.slice(0, 2);
    postText = buildText(cleanTitle, angleLines);
  }

  // If still over 300 graphemes, tighten title
  if (getGraphemeLength(postText) > MAX_GRAPHEMES) {
    cleanTitle = cleanTitle.slice(0, 50) + '...';
    postText = buildText(cleanTitle, angleLines);
  }

  // If still over, drop to 1 thread
  if (getGraphemeLength(postText) > MAX_GRAPHEMES && angleLines.length > 1) {
    angleLines = angleLines.slice(0, 1);
    postText = buildText(cleanTitle, angleLines);
  }

  const description =
    story.overview ||
    `Exploring ${totalArts} articles across ${numAngles} reporting threads on Neus.`;

  const anchorFacet = createLinkFacet(postText, LINK_ANCHOR_TEXT, url);
  const facets = anchorFacet ? [anchorFacet] : getUrlFacets(postText);

  return {
    text: postText,
    url,
    title: story.title,
    description,
    thumbUrl: story.ogImageUrl || DEFAULT_OG_IMAGE,
    facets,
  };
}

export async function uploadBlobToBluesky(
  accessJwt: string,
  imageUrl: string
): Promise<any | null> {
  const tryUpload = async (targetUrl: string): Promise<any | null> => {
    try {
      const imgRes = await fetch(targetUrl);
      if (!imgRes.ok) {
        console.warn(`[BLUESKY] Failed to fetch thumbnail image (${imgRes.status}): ${targetUrl}`);
        return null;
      }
      const rawContentType = imgRes.headers.get('content-type') || 'image/png';
      const contentType = rawContentType.split(';')[0].trim().toLowerCase();

      // AT Protocol XRPC rejects non-image MIME types
      if (!contentType.startsWith('image/')) {
        console.warn(`[BLUESKY] Thumbnail returned non-image content-type (${contentType}): ${targetUrl}`);
        return null;
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 1MB limit for Bluesky thumbnail blobs
      if (buffer.length > 1000000) {
        console.warn(`[BLUESKY] Thumbnail image exceeds 1MB limit (${buffer.length} bytes)`);
        return null;
      }

      const uploadRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          Authorization: `Bearer ${accessJwt}`,
        },
        body: buffer,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.warn(`[BLUESKY] uploadBlob failed (${uploadRes.status}): ${errText}`);
        return null;
      }

      const uploadData = (await uploadRes.json()) as any;
      return uploadData?.blob || null;
    } catch (err: any) {
      console.warn(`[BLUESKY] Error uploading thumbnail blob: ${err?.message || err}`);
      return null;
    }
  };

  const primaryBlob = await tryUpload(imageUrl);
  if (primaryBlob) return primaryBlob;

  // Fall back to DEFAULT_OG_IMAGE if a custom image URL failed or returned non-image
  if (imageUrl !== DEFAULT_OG_IMAGE) {
    console.info(`[BLUESKY] Falling back to default OG image: ${DEFAULT_OG_IMAGE}`);
    return await tryUpload(DEFAULT_OG_IMAGE);
  }

  return null;
}

export async function postToBluesky(options: {
  handle?: string;
  password?: string;
  text: string;
  url: string;
  title: string;
  description: string;
  thumbUrl?: string;
  facets?: BlueskyFacet[];
  dryRun?: boolean;
}): Promise<BlueskyPostResult> {
  const { handle, password, text, url, title, description, thumbUrl, facets, dryRun = false } = options;
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

    // 2. Upload thumbnail blob if provided
    let thumbBlob = null;
    if (thumbUrl) {
      thumbBlob = await uploadBlobToBluesky(accessJwt, thumbUrl);
    }

    // 3. Generate facets for clickable links
    const postFacets = facets || getUrlFacets(text);

    // 4. Construct record with rich external link card embed
    const externalEmbed: any = {
      uri: url,
      title,
      description,
    };
    if (thumbBlob) {
      externalEmbed.thumb = thumbBlob;
    }

    const record: any = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      facets: postFacets.length > 0 ? postFacets : undefined,
      embed: {
        $type: 'app.bsky.embed.external',
        external: externalEmbed,
      },
    };

    // 5. Create post record
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

export async function getRecentBlueskyPostUrls(handle: string): Promise<Set<string>> {
  const postedUrls = new Set<string>();
  try {
    const actor = handle.replace(/^@/, '');
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=50`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Neus-Engine/1.0',
        },
      }
    );
    if (!res.ok) {
      console.warn(`[BLUESKY] Could not fetch author feed (${res.status}): ${await res.text()}`);
      return postedUrls;
    }
    const data = (await res.json()) as any;
    const feed = data?.feed || [];
    for (const item of feed) {
      const record = item?.post?.record;
      // 1. External link card embed URI
      const embedUri = record?.embed?.external?.uri || item?.post?.embed?.external?.uri;
      if (embedUri && typeof embedUri === 'string') {
        postedUrls.add(embedUri.toLowerCase().trim());
      }
      // 2. Clickable link facets
      if (Array.isArray(record?.facets)) {
        for (const facet of record.facets) {
          if (Array.isArray(facet.features)) {
            for (const feature of facet.features) {
              if (feature?.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
                postedUrls.add(feature.uri.toLowerCase().trim());
              }
            }
          }
        }
      }
      // 3. Fallback regex in post text
      if (record?.text && typeof record.text === 'string') {
        const matches = record.text.match(/https?:\/\/[^\s]+/g);
        if (matches) {
          for (const m of matches) {
            postedUrls.add(m.toLowerCase().trim());
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[BLUESKY] Error fetching author feed: ${err?.message || err}`);
  }
  return postedUrls;
}

export function isStoryAlreadyPosted(
  story: { slug: string; primaryClusterSlug?: string; id?: string },
  postedUrls: Set<string>
): boolean {
  const targetSlugs = new Set(
    [story.slug, story.primaryClusterSlug]
      .filter((s): s is string => Boolean(s))
      .map((s) => s.toLowerCase().trim())
  );

  for (const rawUrl of postedUrls) {
    try {
      const parsed = new URL(rawUrl, SITE_URL);
      // Skip third-party links that might appear in the author feed
      if (parsed.hostname !== 'neus.news' && parsed.hostname !== 'www.neus.news') {
        continue;
      }

      // Normalise pathname by stripping leading and trailing slashes
      const normalizedPath = parsed.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();

      // Check direct match on normalizedPath
      if (targetSlugs.has(normalizedPath)) {
        return true;
      }

      // Also check last path segment in case of nested route like /clusters/:slug
      const segments = normalizedPath.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && targetSlugs.has(lastSegment)) {
        return true;
      }
    } catch {
      // Fallback: check exact string match
      const clean = rawUrl.toLowerCase().trim();
      for (const slug of targetSlugs) {
        if (clean === slug || clean === `/${slug}`) {
          return true;
        }
      }
    }
  }
  return false;
}

export interface SyndicationResult {
  attempted: boolean;
  published: boolean;
  skipped: boolean;
  reason?: string;
  uri?: string;
  title?: string;
  dryRun?: boolean;
}

export async function checkAndPublishTopStory(options?: {
  dryRun?: boolean;
  minArticles?: number;
}): Promise<SyndicationResult> {
  const handle = process.env.BLUESKY_HANDLE || 'neus.news';
  const password = process.env.BLUESKY_APP_PASSWORD;
  const isDryRun = options?.dryRun ?? (!password || process.env.NODE_ENV !== 'production');
  const minArticles = options?.minArticles ?? 8;

  // 1. Fetch top representative cluster from the ranked feed
  const rankedClusters = await getRankedClusters(1);
  if (!rankedClusters || rankedClusters.length === 0) {
    return { attempted: true, published: false, skipped: true, reason: 'no_clusters' };
  }

  const topCluster = rankedClusters[0];
  const story = topCluster.story;

  // Quality gate: Must be a multi-thread story
  if (!story || !story.clusters || story.clusters.length < 2) {
    return {
      attempted: true,
      published: false,
      skipped: true,
      reason: 'top_story_not_multi_thread',
      title: topCluster.headline || undefined,
    };
  }

  // Count active articles across threads
  const activeClusters = story.clusters.filter((c) => !c.archived && c.slug);
  const totalArticles = activeClusters.reduce(
    (sum, c) => sum + (c.articleAssignments?.length || 0),
    0
  );

  if (totalArticles < minArticles) {
    return {
      attempted: true,
      published: false,
      skipped: true,
      reason: `insufficient_articles_${totalArticles}_below_${minArticles}`,
      title: story.title,
    };
  }

  const primarySlug = topCluster.slug || activeClusters[0]?.slug || story.slug;
  if (!primarySlug) {
    return { attempted: true, published: false, skipped: true, reason: 'missing_slug' };
  }

  // 2. Primary check: Database persistence
  if (story.postedToBlueskyAt || (story as any).blueskyUri) {
    return {
      attempted: true,
      published: false,
      skipped: true,
      reason: 'already_posted_db',
      title: story.title,
    };
  }

  // 3. Secondary check: Live Bluesky feed (defense-in-depth)
  const postedUrls = await getRecentBlueskyPostUrls(handle);
  const alreadyPostedInFeed = isStoryAlreadyPosted(
    { slug: story.slug, primaryClusterSlug: primarySlug, id: story.id },
    postedUrls
  );

  if (alreadyPostedInFeed) {
    // Backfill database so subsequent cron cycles skip immediately
    await markStorySyndicated(story.id, 'at://existing').catch(() => {});
    return {
      attempted: true,
      published: false,
      skipped: true,
      reason: 'already_posted_feed',
      title: story.title,
    };
  }

  // 4. Prepare story data
  const angles: BlueskyAngle[] = activeClusters
    .map((c) => ({
      headline: c.headline,
      storyAngle: c.storyAngle,
      articleCount: c.articleAssignments?.length || 0,
    }))
    .sort((a, b) => b.articleCount - a.articleCount);

  const storyData: BlueskyStoryData = {
    id: story.id,
    title: story.title,
    slug: primarySlug,
    overview: story.overview,
    totalArticles,
    angles,
  };

  const { text, url, title, description, thumbUrl, facets } = formatBlueskyPost(storyData);

  // 5. Post or Dry Run
  const postResult = await postToBluesky({
    handle,
    password,
    text,
    url,
    title,
    description,
    thumbUrl,
    facets,
    dryRun: isDryRun,
  });

  if (postResult.success) {
    // 6. Record successful syndication in database
    if (!postResult.dryRun && postResult.uri) {
      await markStorySyndicated(story.id, postResult.uri).catch((err) => {
        console.warn(`[BLUESKY] Could not update story syndication state in db: ${err?.message || err}`);
      });
    }

    return {
      attempted: true,
      published: !postResult.dryRun,
      skipped: false,
      uri: postResult.uri,
      title: story.title,
      dryRun: postResult.dryRun,
    };
  } else {
    return {
      attempted: true,
      published: false,
      skipped: false,
      reason: postResult.error,
      title: story.title,
    };
  }
}

export async function draftOrPublishTopStory(options?: {
  dryRun?: boolean;
}): Promise<BlueskyPostResult | null> {
  const result = await checkAndPublishTopStory(options);
  if (result.skipped) {
    console.log(`[Bluesky] Story skipped: ${result.reason} ("${result.title || 'N/A'}")`);
    return null;
  }
  return {
    success: result.published || Boolean(result.dryRun),
    uri: result.uri,
    dryRun: result.dryRun,
    text: result.title || '',
    charCount: 0,
    error: result.reason,
  };
}

// CLI Execution entry point
const isDirectCall =
  process.argv[1] &&
  (process.argv[1].endsWith('bluesky.ts') || process.argv[1].endsWith('bluesky.js'));

if (isDirectCall) {
  const isPublish = process.argv.includes('--publish');
  const isDryRun = !isPublish;

  console.log(`\n--- BLUESKY TOP STORY CHECK [Mode: ${isDryRun ? 'DRY RUN' : 'PUBLISH'}] ---\n`);

  checkAndPublishTopStory({ dryRun: isDryRun })
    .then((result) => {
      if (result.skipped) {
        console.log(`[Skipped]: Reason = ${result.reason} | Title = "${result.title || 'N/A'}"`);
        process.exit(0);
      }

      if (result.dryRun) {
        console.log(`\n[Dry Run Success]: Eligible top story = "${result.title}"`);
        console.log('To publish for real, set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env, then run with --publish.');
      } else if (result.published) {
        console.log(`\nSuccessfully posted to Bluesky! URI: ${result.uri} | Title: "${result.title}"`);
      } else {
        console.error(`\nFailed to post: ${result.reason}`);
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Bluesky execution error:', err);
      process.exit(1);
    });
}
