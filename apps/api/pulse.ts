import { IncomingMessage, ServerResponse } from 'node:http';
import Parser from 'rss-parser';
import {
  countUnclusteredArticles,
  evaluatePulseTrigger,
  getActiveSources,
  getLatestPipelineRunTime,
  getRecentArticlesForPulse,
  isPaywalledSource,
  PulseTriggerResult,
  syncArticles,
} from '@neus/db';

export interface PulseOptions {
  dryRun?: boolean;
  force?: boolean;
  ref?: string;
}

export interface PulseIngestionSummary {
  activeSources: number;
  successfulFeeds: number;
  failedFeeds: number;
  articlesFetched: number;
  newArticles: number;
  updatedArticles: number;
  unchangedArticles: number;
}

export interface PulseDispatchSummary {
  dispatched: boolean;
  reason?: string;
  targetRef?: string;
  status?: number;
}

export interface PulseExecutionResponse {
  success: boolean;
  timestamp: string;
  dryRun: boolean;
  ingestion: PulseIngestionSummary;
  evaluation: PulseTriggerResult;
  dispatch: PulseDispatchSummary;
}

const DEFAULT_FEED_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; NeusFeedReader/1.0; +https://neus.news)',
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'cobacious';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'neus';
const WORKFLOW_ID = 'run-pipeline.yml';

/**
 * Validates request authorization token against PULSE_SECRET or API_KEY.
 */
export function authorizePulseRequest(req: IncomingMessage, url: URL): boolean {
  const configuredSecret = process.env.PULSE_SECRET || process.env.API_KEY;

  // In test or non-production environment without configured secret, allow access
  if (!configuredSecret) {
    return process.env.NODE_ENV !== 'production';
  }

  // Check Bearer authorization header
  const authHeader = req.headers.authorization || (req.headers.Authorization as string | undefined);
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : undefined;
  if (token === configuredSecret) return true;

  // Check query parameter ?secret=
  const querySecret = url.searchParams.get('secret');
  if (querySecret === configuredSecret) return true;

  return false;
}

/**
 * Normalizes RSS category items to plain strings.
 */
function normalizeCategories(categories?: any[]): string[] | undefined {
  if (!categories || categories.length === 0) return undefined;
  return categories.map((cat) => (typeof cat === 'string' ? cat : cat._ || ''));
}

/**
 * Fetches and parses a single RSS feed with timeout and fallback headers.
 */
async function fetchSourceFeed(
  rssFeedUrl: string,
  sourceName: string,
  sourceId: string,
  timeoutMs = 12000
): Promise<any[]> {
  const parser = new Parser({
    headers: DEFAULT_FEED_FETCH_HEADERS,
    timeout: timeoutMs,
  });

  const feed = await parser.parseURL(rssFeedUrl);
  return (feed.items || []).map((item) => ({
    url: item.link || '',
    title: item.title || '',
    source: sourceName,
    sourceId,
    publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    snippet: item.contentSnippet || item.content || '',
    content: isPaywalledSource(sourceName) ? '' : undefined,
    author: item.creator || (item as any).author || undefined,
    categories: normalizeCategories(item.categories)?.join(','),
  }));
}

/**
 * Checks in-flight status and completion time of the GitHub Actions pipeline.
 */
async function checkGitHubWorkflowStatus(token?: string): Promise<{
  isRunInProgress: boolean;
  minutesSinceLastRun: number;
}> {
  if (!token) {
    const latestClusterTime = await getLatestPipelineRunTime();
    const minutesSince = latestClusterTime
      ? Math.max(0, (Date.now() - latestClusterTime.getTime()) / (60 * 1000))
      : 999;
    return { isRunInProgress: false, minutesSinceLastRun: minutesSince };
  }

  try {
    const runsUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${WORKFLOW_ID}/runs?per_page=5`;
    const res = await fetch(runsUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Neus-Pulse-Sentinel',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }

    const data = (await res.json()) as { workflow_runs?: any[] };
    const runs = data.workflow_runs || [];

    const isRunInProgress = runs.some(
      (r) => r.status === 'in_progress' || r.status === 'queued'
    );

    const latestCompleted = runs.find((r) => r.status === 'completed');
    let minutesSinceLastRun = 999;
    if (latestCompleted && latestCompleted.created_at) {
      const runTime = new Date(latestCompleted.created_at).getTime();
      minutesSinceLastRun = Math.max(0, (Date.now() - runTime) / (60 * 1000));
    } else {
      const fallbackTime = await getLatestPipelineRunTime();
      if (fallbackTime) {
        minutesSinceLastRun = Math.max(0, (Date.now() - fallbackTime.getTime()) / (60 * 1000));
      }
    }

    return { isRunInProgress, minutesSinceLastRun };
  } catch {
    // If GitHub API is unreachable, fall back to database cluster timestamp
    const fallbackTime = await getLatestPipelineRunTime();
    const minutesSince = fallbackTime
      ? Math.max(0, (Date.now() - fallbackTime.getTime()) / (60 * 1000))
      : 999;
    return { isRunInProgress: false, minutesSinceLastRun: minutesSince };
  }
}

/**
 * Triggers GitHub Actions workflow_dispatch.
 */
async function dispatchGitHubWorkflow(
  targetRef: string,
  token: string
): Promise<PulseDispatchSummary> {
  try {
    const dispatchUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`;
    const res = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Neus-Pulse-Sentinel',
      },
      body: JSON.stringify({ ref: targetRef }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 204 || res.ok) {
      return {
        dispatched: true,
        targetRef,
        status: res.status,
        reason: 'Workflow dispatched successfully',
      };
    }

    const errorBody = await res.text().catch(() => '');
    return {
      dispatched: false,
      targetRef,
      status: res.status,
      reason: `GitHub dispatch failed: HTTP ${res.status} ${errorBody}`,
    };
  } catch (err: any) {
    return {
      dispatched: false,
      targetRef,
      reason: `GitHub dispatch network error: ${err.message || err}`,
    };
  }
}

/**
 * Core Pulse handler: fetches feeds, updates database, evaluates triggers, and dispatches.
 */
export async function executePulse(options: PulseOptions = {}): Promise<PulseExecutionResponse> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const targetRef = options.ref || process.env.PULSE_GITHUB_REF || 'main';
  const githubToken = process.env.PULSE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

  // 1. Fetch active sources from database
  const activeSources = await getActiveSources();
  let successfulFeeds = 0;
  let failedFeeds = 0;
  const allArticles: any[] = [];

  // 2. Concurrently fetch RSS feeds with concurrency pool of 5
  const concurrency = 5;
  for (let i = 0; i < activeSources.length; i += concurrency) {
    const chunk = activeSources.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map((source) =>
        fetchSourceFeed(source.rssFeedUrl, source.name, source.id)
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successfulFeeds++;
        allArticles.push(...result.value);
      } else {
        failedFeeds++;
      }
    }
  }

  // Filter out any entries missing url or title
  const validArticles = allArticles.filter(
    (a) => a.url && a.title && a.publishedAt && a.sourceId
  );

  // 3. Upsert articles into database using syncArticles
  let newArticles = 0;
  let updatedArticles = 0;
  let unchangedArticles = 0;

  if (validArticles.length > 0) {
    const syncResult = await syncArticles(
      validArticles.map((a) => ({
        url: a.url,
        title: a.title,
        source: a.source,
        sourceId: a.sourceId,
        publishedAt: new Date(a.publishedAt),
        snippet: a.snippet,
        content: a.content,
        author: a.author,
        categories: a.categories,
      }))
    );
    newArticles = syncResult.created;
    updatedArticles = syncResult.updated;
    unchangedArticles = syncResult.unchanged;
  }

  // 4. Query metrics for trigger evaluation
  const [unclusteredArticleCount, recentArticles, workflowStatus] = await Promise.all([
    countUnclusteredArticles(3),
    getRecentArticlesForPulse(1),
    checkGitHubWorkflowStatus(githubToken),
  ]);

  // 5. Evaluate Pulse trigger policies
  const evaluation = evaluatePulseTrigger({
    isRunInProgress: workflowStatus.isRunInProgress,
    minutesSinceLastRun: workflowStatus.minutesSinceLastRun,
    unclusteredArticleCount,
    recentArticles: recentArticles.map((r) => ({
      id: r.id,
      title: r.title,
      sourceId: r.sourceId,
      publishedAt: r.publishedAt,
      embedding: r.embedding,
    })),
  });

  // 6. Handle dispatch decision
  let dispatch: PulseDispatchSummary;

  if (dryRun) {
    dispatch = {
      dispatched: false,
      targetRef,
      reason: 'Dry run mode active',
    };
  } else if (!evaluation.shouldTrigger && !force) {
    dispatch = {
      dispatched: false,
      targetRef,
      reason: `Trigger condition not met: ${evaluation.reason}`,
    };
  } else if (!githubToken) {
    dispatch = {
      dispatched: false,
      targetRef,
      reason: 'PULSE_GITHUB_TOKEN not configured in environment',
    };
  } else {
    dispatch = await dispatchGitHubWorkflow(targetRef, githubToken);
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    dryRun,
    ingestion: {
      activeSources: activeSources.length,
      successfulFeeds,
      failedFeeds,
      articlesFetched: validArticles.length,
      newArticles,
      updatedArticles,
      unchangedArticles,
    },
    evaluation,
    dispatch,
  };
}

/**
 * HTTP request listener for /api/pulse and /pulse routes.
 */
export async function handlePulseHttpRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Only handle GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Authorization check
  if (!authorizePulseRequest(req, url)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing Pulse token' }));
    return;
  }

  // Extract query parameters
  const dryRunParam = url.searchParams.get('dryRun');
  const forceParam = url.searchParams.get('force');
  const refParam = url.searchParams.get('ref');

  let bodyOptions: PulseOptions = {};
  if (req.method === 'POST') {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (raw.trim()) {
        bodyOptions = JSON.parse(raw);
      }
    } catch {
      // Ignore JSON parse errors and continue with query params
    }
  }

  const dryRun =
    dryRunParam !== null
      ? dryRunParam !== 'false' && dryRunParam !== '0'
      : (bodyOptions.dryRun ?? false);

  const force =
    forceParam !== null
      ? forceParam !== 'false' && forceParam !== '0'
      : (bodyOptions.force ?? false);

  const ref = refParam || bodyOptions.ref;

  try {
    const result = await executePulse({ dryRun, force, ref });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    });
    res.end(JSON.stringify(result, null, 2));
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: err.message || 'Internal Pulse error',
      })
    );
  }
}
