import {
  getActiveClustersForStories,
  syncStoryWithAngles,
  mergeClusters,
  getStoriesForMatching,
  markDormantStories,
  getStoryArticlesForRealignment,
  realignStoryArticles,
  dissociateClusters,
  disbandUnderpopulatedStories,
} from '@neus/db';
import type { StoryInput } from '@neus/db';
import { cosineSimilarity } from './utils';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';
import { generateStructuredJson } from '../../lib/aiClient';
import {
  classifyArticleAnglesBatch,
  detectDuplicateClusters,
  CandidateClusterForMerge,
  ClusterMergeDecision,
} from '../../lib/typesafeClient';

export type NeighborhoodStory = {
  existingStoryId?: string | null;
  storyTitle: string;
  status: 'breaking' | 'developing';
  overview: string;
  angles: Array<{
    clusterId: string;
    angle: string;
  }>;
};

export type NeighborhoodEvaluation = {
  stories?: NeighborhoodStory[];
  story?: NeighborhoodStory | null;
};

export type CandidateStory = {
  id: string;
  title: string;
  status: string;
  overview: string | null;
  updatedAt?: Date | string;
  _count?: { clusters: number };
};

export type ClusterWithEmbedding = {
  id: string;
  headline?: string | null;
  summary?: string | null;
  createdAt: Date;
  storyId?: string | null;
  storyAngle?: string | null;
  embedding?: unknown;
  _count?: { articleAssignments: number };
  articleAssignments?: Array<{ createdAt: Date }>;
  [key: string]: any;
};

/**
 * Checks whether a candidate neighborhood represents an already-settled story.
 * If all clusters already belong to the same existing story, have assigned angles,
 * and haven't had new clusters or articles added in the past RECENT_ACTIVITY_HOURS,
 * LLM evaluation and realignment can be safely skipped.
 */
export function isSettledNeighborhood<T extends ClusterWithEmbedding>(
  neighborhood: T[],
  existingStories: Array<{
    id: string;
    title: string;
    status: string;
    overview: string | null;
    updatedAt?: Date | string;
    _count?: { clusters: number };
  }>,
  activityCutoff: Date,
  activeStoryClusterCounts?: Map<string, number>
): { settled: boolean; storyTitle?: string } {
  if (neighborhood.length < 2) return { settled: false };

  // All clusters in the candidate neighborhood must already belong to a story
  if (!neighborhood.every((c) => Boolean(c.storyId))) {
    return { settled: false };
  }

  // All clusters must belong to the exact same story
  const targetStoryId = neighborhood[0].storyId!;
  if (!neighborhood.every((c) => c.storyId === targetStoryId)) {
    return { settled: false };
  }

  // All clusters must already have an assigned storyAngle
  if (!neighborhood.every((c) => Boolean(c.storyAngle))) {
    return { settled: false };
  }

  // Verify the story exists in existingStories
  const matchedStory = existingStories.find((s) => s.id === targetStoryId);
  if (!matchedStory) {
    return { settled: false };
  }

  // If the story has more active clusters in the current evaluation window than are present in this neighborhood,
  // do not treat as settled (an angle might be dissociated or split into another neighborhood).
  // Uses activeStoryClusterCounts if provided, falling back to matchedStory._count.clusters for unit tests.
  const totalStoryClusters = activeStoryClusterCounts
    ? activeStoryClusterCounts.get(targetStoryId) ?? neighborhood.length
    : matchedStory._count?.clusters ?? neighborhood.length;

  if (totalStoryClusters > neighborhood.length) {
    return { settled: false };
  }

  // If matchedStory has an updatedAt timestamp, check if any cluster was created after the story was last organized
  if (matchedStory.updatedAt) {
    const storyUpdatedMs = new Date(matchedStory.updatedAt).getTime();
    const hasNewClusterSinceUpdate = neighborhood.some(
      (c) => new Date(c.createdAt).getTime() > storyUpdatedMs + 60000
    );
    if (hasNewClusterSinceUpdate) {
      return { settled: false };
    }
    return { settled: true, storyTitle: matchedStory.title };
  }

  // Fallback when story.updatedAt is not provided (e.g. minimal unit tests):
  // Check if any cluster in the neighborhood was created recently (< 48h)
  const hasRecentlyCreatedCluster = neighborhood.some(
    (c) => new Date(c.createdAt) >= activityCutoff
  );
  if (hasRecentlyCreatedCluster) {
    return { settled: false };
  }

  // Check if any cluster in the neighborhood received a new article assignment recently (< 48h)
  const hasRecentlyAssignedArticle = neighborhood.some((c) => {
    const latestArticleAt = c.articleAssignments?.[0]?.createdAt;
    return latestArticleAt && new Date(latestArticleAt) >= activityCutoff;
  });
  if (hasRecentlyAssignedArticle) {
    return { settled: false };
  }

  return { settled: true, storyTitle: matchedStory.title };
}

/**
 * Groups clusters into candidate neighborhoods using vector similarity and connected components.
 * Standalone clusters (degree 0) are excluded.
 */
export function buildNeighborhoods<T extends ClusterWithEmbedding>(
  clusters: T[],
  similarityThreshold: number = 0.78,
  maxNeighborhoodSize: number = 6
): T[][] {
  const validClusters = clusters.filter(
    (c) => Array.isArray(c.embedding) && (c.embedding as number[]).length > 0
  );

  const n = validClusters.length;
  if (n < 2) return [];

  const adj = new Map<number, number[]>();
  for (let i = 0; i < n; i++) adj.set(i, []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(
        validClusters[i].embedding as number[],
        validClusters[j].embedding as number[]
      );
      if (sim >= similarityThreshold) {
        adj.get(i)!.push(j);
        adj.get(j)!.push(i);
      }
    }
  }

  const visited = new Set<number>();
  const neighborhoods: T[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;

    const componentIndices: number[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      componentIndices.push(curr);
      for (const neighbor of adj.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (componentIndices.length >= 2) {
      const component = componentIndices.map((idx) => validClusters[idx]);
      if (component.length > maxNeighborhoodSize && similarityThreshold < 0.86) {
        // Tighten similarity threshold to break transitive chaining across distinct stories
        const subComponents = buildNeighborhoods(
          component,
          similarityThreshold + 0.04,
          maxNeighborhoodSize
        );
        neighborhoods.push(...subComponents);
      } else if (component.length > maxNeighborhoodSize) {
        // Slice into chunks of maxNeighborhoodSize
        for (let s = 0; s < component.length; s += maxNeighborhoodSize) {
          const chunk = component.slice(s, s + maxNeighborhoodSize);
          if (chunk.length >= 2) neighborhoods.push(chunk);
        }
      } else {
        neighborhoods.push(component);
      }
    }
  }

  return neighborhoods;
}

export function computeCentroidEmbedding(clusters: ClusterWithEmbedding[]): number[] | null {
  const validEmbeddings = clusters
    .map((c) => c.embedding)
    .filter((e): e is number[] => Array.isArray(e) && e.length > 0);

  if (validEmbeddings.length === 0) return null;

  const dim = validEmbeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const emb of validEmbeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= validEmbeddings.length;
  }

  return centroid;
}

export function findCandidateStoriesForNeighborhood(
  neighborhood: ClusterWithEmbedding[],
  existingStories: Array<{
    id: string;
    title: string;
    status: string;
    overview: string | null;
    embedding?: unknown;
  }>
): CandidateStory[] {
  const candidateMap = new Map<string, CandidateStory>();

  // 1. Check if any cluster in neighborhood already belongs to a story
  for (const c of neighborhood) {
    if (c.storyId) {
      const match = existingStories.find((s) => s.id === c.storyId);
      if (match) {
        candidateMap.set(match.id, {
          id: match.id,
          title: match.title,
          status: match.status,
          overview: match.overview,
          _count: (match as any)._count,
        });
      }
    }
  }

  // 2. Vector search: check if any cluster centroid has cosine similarity >= 0.74 with an existing story embedding
  for (const story of existingStories) {
    if (candidateMap.has(story.id)) continue;
    if (!Array.isArray(story.embedding) || (story.embedding as number[]).length === 0) continue;

    for (const c of neighborhood) {
      if (Array.isArray(c.embedding) && (c.embedding as number[]).length > 0) {
        const sim = cosineSimilarity(c.embedding as number[], story.embedding as number[]);
        if (sim >= 0.74) {
          candidateMap.set(story.id, {
            id: story.id,
            title: story.title,
            status: story.status,
            overview: story.overview,
            _count: (story as any)._count,
          });
          break;
        }
      }
    }
  }

  return Array.from(candidateMap.values());
}

async function evaluateNeighborhood(
  clusters: Array<{ id: string; headline: string | null; summary: string | null; date: string; articleCount?: number }>,
  candidateStories?: CandidateStory[]
): Promise<NeighborhoodEvaluation> {
  const prompt = `
You are an expert news editor and taxonomist.

Here is a candidate group of distinct news clusters identified by vector similarity:
${JSON.stringify(clusters, null, 2)}

TASK:
Analyze these clusters and determine:
Do 2 or more distinct clusters represent DIFFERENT ANGLES, chronological developments, or sub-stories of the SAME overarching news saga?
- If yes, provide for each story:
  - "existingStoryId": If this saga matches or develops an EXISTING STORY listed in the CANDIDATE STORIES below, specify its id. Otherwise null.
  - "storyTitle": An objective, neutral overarching news headline synthesizing what happened across the saga.
  - "status": One of "breaking" (first 12-24h of newly emerging breaking news where details are still arriving) or "developing" (multi-angle saga actively expanding in scope with related spin-offs/fallout).
  - "overview": A neutral 2-sentence macro-summary synthesizing the whole saga across all its angles.
  - "angles": Array of member clusters with:
    - "clusterId": The cluster id
    - "angle": A 2-5 word description of this cluster's specific angle/development (e.g. "Hospital Awakening", "Warden Resignation", "Legal Inquiry").

EDITORIAL TAXONOMY GUIDELINES:
A multi-angle "Story" is an overarching news topic that brings together 2 or more distinct angles, chronological chapters, or key facets of:
1. Narrative Sagas & Investigations: Unfolding events with direct consequences (e.g. an incident occurs -> hospital/investigative updates -> institutional fallout/resignation -> legal/judicial proceedings).
2. Major Scheduled Macro-Events: Significant calendar events with multiple major speeches, announcements, or debates (e.g. party conferences, bilateral summits, legislative budget sessions, tournaments).

CRITICAL TITLING & OVERVIEW RULES:
- The "storyTitle" MUST read like a real, neutral news headline with an active verb describing the overarching event or development (e.g. "Clashes Erupt Across France Over Student Protests and Rising Living Costs", "Vatican Confirms Pope Leo Diagnosed with Lung Cancer Following Surgery").
- DO NOT format "storyTitle" as an abstract topic label, Wikipedia category or list of nouns ending in "... and Fallout", "...: Speeches, Debates and Reactions" or "...: Court Proceedings and Witness Testimony". It must read like a real, neutral news headline.
- NEVER narrow the "storyTitle" to a single minor sub-angle or individual pledge (e.g. DO NOT name a party conference story after one specific tax pledge like "Badenoch Pledges to Scrap Inheritance Tax"; instead write "Conservative Party Opens Annual Conference Amid Debates Over Economic Strategy and Leadership").
- The "overview" must synthesize the entire overarching saga or event across all member angles.

FALSE POSITIVES TO KEEP STANDALONE (Return "stories": []):
Do NOT group clusters into a story merely because:
1. They share an entity or figure (e.g., an actor, CEO, or leader) but cover entirely unrelated actions or occurrences with no shared narrative or event thread.
2. They share a broad thematic beat (e.g., general healthcare news) with no shared event, initiative, or investigation connecting them.
3. If candidate clusters are unrelated standalone reports, return "stories": [].
${
  candidateStories && candidateStories.length > 0
    ? `\nCANDIDATE STORIES IN DATABASE (active or dormant sagas that may match this neighborhood):\n${JSON.stringify(
        candidateStories,
        null,
        2
      )}\n`
    : ''
}
Return JSON with this exact schema:
{
  "stories": [
    {
      "existingStoryId": string | null,
      "storyTitle": string,
      "status": "breaking" | "developing",
      "overview": string,
      "angles": [
        {
          "clusterId": string,
          "angle": string
        }
      ]
    }
  ]
}
`;

  return generateStructuredJson<NeighborhoodEvaluation>({
    prompt,
    systemInstruction: 'You are an objective news taxonomist. Return strict JSON only.',
    step: PipelineStep.Organize,
    schema: {
      type: 'OBJECT',
      properties: {
        stories: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              existingStoryId: { type: 'STRING', nullable: true },
              storyTitle: { type: 'STRING' },
              status: { type: 'STRING', enum: ['breaking', 'developing'] },
              overview: { type: 'STRING' },
              angles: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    clusterId: { type: 'STRING' },
                    angle: { type: 'STRING' },
                  },
                  required: ['clusterId', 'angle'],
                },
              },
            },
            required: ['storyTitle', 'status', 'overview', 'angles'],
          },
        },
      },
      required: ['stories'],
    },
  });
}

export interface ClassifyArticleAnglesDependencies {
  classifyBatch?: typeof classifyArticleAnglesBatch;
}

export async function classifyArticleAngles(
  storyTitle: string,
  angles: Array<{
    clusterId: string;
    angle: string;
    headline?: string | null;
    embedding?: number[] | null;
  }>,
  articles: Array<{
    articleId: string;
    currentClusterId: string;
    title: string;
    snippet?: string | null;
    content?: string | null;
    embedding?: unknown;
  }>,
  options?: {
    isExistingStory?: boolean;
    newClusterIds?: Set<string>;
  },
  deps: ClassifyArticleAnglesDependencies = {}
): Promise<Array<{ articleId: string; targetClusterId: string }>> {
  if (angles.length < 2 || articles.length === 0) return [];

  const anglesWithEmbeddings = angles.filter(
    (a) => Array.isArray(a.embedding) && (a.embedding as number[]).length > 0
  );

  const resolvedAssignments: Array<{ articleId: string; targetClusterId: string }> = [];
  const ambiguousArticles: Array<{
    articleId: string;
    currentClusterId: string;
    title: string;
    snippet?: string | null;
    content?: string | null;
  }> = [];

  const isExistingStory = options?.isExistingStory ?? false;
  const newClusterIds = options?.newClusterIds ?? new Set<string>();

  // 1. Vector Cosine Similarity Pre-filtering & Incremental evaluation
  for (const article of articles) {
    const isFromNewCluster = newClusterIds.has(article.currentClusterId);
    const artEmb =
      Array.isArray(article.embedding) && (article.embedding as number[]).length > 0
        ? (article.embedding as number[])
        : null;

    if (artEmb && anglesWithEmbeddings.length >= 2) {
      const matchingAngles = anglesWithEmbeddings.filter(
        (a) => (a.embedding as number[]).length === artEmb.length
      );

      if (matchingAngles.length >= 2) {
        const scored = matchingAngles
          .map((a) => ({
            clusterId: a.clusterId,
            similarity: cosineSimilarity(artEmb, a.embedding as number[]),
          }))
          .sort((x, y) => y.similarity - x.similarity);

        const best = scored[0];
        const second = scored[1];
        const margin = (best?.similarity ?? 0) - (second?.similarity ?? 0);

        // Confident match:
        // - If best match is current cluster with solid similarity (>= 0.65) and clear margin (>= 0.04), keep it.
        // - If best match is a different cluster with strong separation (similarity >= 0.70 and margin >= 0.04), reassign.
        if (best.clusterId === article.currentClusterId && best.similarity >= 0.65 && margin >= 0.04) {
          resolvedAssignments.push({ articleId: article.articleId, targetClusterId: best.clusterId });
          continue;
        } else if (best.similarity >= 0.70 && margin >= 0.04) {
          resolvedAssignments.push({ articleId: article.articleId, targetClusterId: best.clusterId });
          continue;
        }
      }
    }

    // Incremental optimization: if this is an existing story and the article is already
    // in an established cluster (not a new incoming cluster), keep its current assignment
    // rather than paying for a re-classification.
    if (isExistingStory && !isFromNewCluster && angles.some((a) => a.clusterId === article.currentClusterId)) {
      resolvedAssignments.push({ articleId: article.articleId, targetClusterId: article.currentClusterId });
      continue;
    }

    // Ambiguous, unassigned or new cluster article without high confidence: defer to System One
    ambiguousArticles.push({
      articleId: article.articleId,
      currentClusterId: article.currentClusterId,
      title: article.title,
      snippet: article.snippet,
      content: article.content,
    });
  }

  if (ambiguousArticles.length === 0) {
    logger.info(
      `[${PipelineStep.Organize}] All ${articles.length} article(s) for "${storyTitle}" resolved via vector similarity (0 API calls)`
    );
    return resolvedAssignments;
  }

  if (resolvedAssignments.length > 0) {
    logger.info(
      `[${PipelineStep.Organize}] ${resolvedAssignments.length}/${articles.length} article(s) resolved via vector similarity; classifying remaining ${ambiguousArticles.length} article(s) with System One...`
    );
  }

  const classifyBatch = deps.classifyBatch ?? classifyArticleAnglesBatch;
  logger.info(
    `[${PipelineStep.Organize}] Classifying ${ambiguousArticles.length} ambiguous article(s) for "${storyTitle}" with System One (parallel)...`
  );

  const batchResults = await classifyBatch({
    articles: ambiguousArticles.map((a) => ({
      id: a.articleId,
      title: a.title,
      snippet: a.snippet,
      content: a.content,
    })),
    angles: angles.map((a) => ({
      clusterId: a.clusterId,
      angle: a.angle,
      headline: a.headline,
    })),
    storyTitle,
    step: PipelineStep.Organize,
  });

  const classifiedAssignments: Array<{ articleId: string; targetClusterId: string }> = [];
  for (const res of batchResults) {
    if (res.targetClusterId) {
      classifiedAssignments.push({
        articleId: res.articleId,
        targetClusterId: res.targetClusterId,
      });
    }
  }

  return [...resolvedAssignments, ...classifiedAssignments];
}

export interface OrganizeStoryAnglesDependencies {
  detectDuplicateClusters?: typeof detectDuplicateClusters;
  classifyArticleAngles?: typeof classifyArticleAngles;
  evaluateNeighborhood?: typeof evaluateNeighborhood;
}

export async function organizeStoryAngles(
  options: { timeBudgetMs?: number } = {},
  deps: OrganizeStoryAnglesDependencies = {}
) {
  const detectDuplicatesFn = deps.detectDuplicateClusters ?? detectDuplicateClusters;
  const classifyAnglesFn = deps.classifyArticleAngles ?? classifyArticleAngles;
  const evaluateNeighborhoodFn = deps.evaluateNeighborhood ?? evaluateNeighborhood;

  logPipelineStep(PipelineStep.Organize, 'Organizing clusters into story angles & merging duplicates...');

  const activeClusters = await getActiveClustersForStories(30);

  if (activeClusters.length < 2) {
    logPipelineSection(
      PipelineStep.Organize,
      `Not enough active clusters to evaluate stories (${activeClusters.length} found). Skipping.`
    );
    return;
  }

  const existingStories = await getStoriesForMatching();

  const similarityThreshold = process.env.STORY_SIMILARITY_THRESHOLD
    ? parseFloat(process.env.STORY_SIMILARITY_THRESHOLD)
    : 0.78;

  const neighborhoods = buildNeighborhoods(activeClusters, similarityThreshold);

  logPipelineSection(
    PipelineStep.Organize,
    `Evaluated ${activeClusters.length} clusters: found ${neighborhoods.length} candidate neighborhoods (threshold >= ${similarityThreshold})`
  );

  if (neighborhoods.length === 0) {
    logger.info(
      `[${PipelineStep.Organize}] No cluster neighborhoods detected above threshold. All clusters are standalone.`
    );
    await disbandUnderpopulatedStories();
    // Still perform dormancy sweep even if no new neighborhoods formed
    const dormantCount = await markDormantStories(7);
    if (dormantCount > 0) {
      logger.info(
        `[${PipelineStep.Organize}] Marked ${dormantCount} inactive stories as dormant (no updates in 7+ days)`
      );
    }
    return;
  }

  let totalMerged = 0;
  let totalStoriesSynced = 0;
  let totalSkippedSettled = 0;

  // Pre-calculate active cluster count per story in the 30-day window
  const activeStoryClusterCounts = new Map<string, number>();
  for (const c of activeClusters) {
    if (c.storyId) {
      activeStoryClusterCounts.set(
        c.storyId,
        (activeStoryClusterCounts.get(c.storyId) || 0) + 1
      );
    }
  }

  const RECENT_ACTIVITY_HOURS = 48;
  const activityCutoff = new Date(Date.now() - RECENT_ACTIVITY_HOURS * 60 * 60 * 1000);

  // Time budget for the evaluation loop (default 8 minutes), overridable via env.
  const timeBudgetMs = process.env.ORGANIZE_TIME_BUDGET_MS
    ? parseInt(process.env.ORGANIZE_TIME_BUDGET_MS, 10)
    : 8 * 60 * 1000;
  const organizeStart = Date.now();
  let totalEvaluated = 0;
  let totalDeferred = 0;

  const hasRecentActivityIn = (n: ClusterWithEmbedding[]) =>
    n.some((c) => {
      const isNewCluster = new Date(c.createdAt) >= activityCutoff;
      const latestArticleAt = c.articleAssignments?.[0]?.createdAt;
      const hasNewArticle = latestArticleAt && new Date(latestArticleAt) >= activityCutoff;
      return isNewCluster || Boolean(hasNewArticle);
    });

  const latestActivityMs = (n: ClusterWithEmbedding[]) =>
    Math.max(
      ...n.map((c) =>
        Math.max(
          new Date(c.createdAt).getTime(),
          c.articleAssignments?.[0]?.createdAt
            ? new Date(c.articleAssignments[0].createdAt).getTime()
            : 0
        )
      )
    );

  // Freshest neighborhoods first, so breaking news is always handled before the budget runs out.
  const orderedNeighborhoods = [...neighborhoods].sort(
    (a, b) => latestActivityMs(b) - latestActivityMs(a)
  );

  for (let i = 0; i < orderedNeighborhoods.length; i++) {
    const neighborhood = orderedNeighborhoods[i];

    // Fast skip: if NO cluster in the candidate neighborhood was created or received new articles
    // in the past RECENT_ACTIVITY_HOURS, nothing has changed since the previous run.
    if (!hasRecentActivityIn(neighborhood)) {
      totalSkippedSettled++;
      logger.info(
        `[${PipelineStep.Organize}] Skipping inactive neighborhood ${i + 1}/${orderedNeighborhoods.length} (${neighborhood.length} clusters) (no new clusters or articles in past ${RECENT_ACTIVITY_HOURS}h)`
      );
      continue;
    }

    // Skip settled neighborhoods where all clusters already belong to the same existing story,
    // angles are assigned, and no new clusters or articles arrived in the past RECENT_ACTIVITY_HOURS
    const settledCheck = isSettledNeighborhood(
      neighborhood,
      existingStories,
      activityCutoff,
      activeStoryClusterCounts
    );
    if (settledCheck.settled) {
      totalSkippedSettled++;
      logger.info(
        `[${PipelineStep.Organize}] Skipping settled story neighborhood for "${settledCheck.storyTitle}" (no new clusters or articles in past ${RECENT_ACTIVITY_HOURS}h)`
      );
      continue;
    }

    // Time budget: stop starting new evaluations once the budget is spent. Neighborhoods are
    // processed freshest-first, and anything deferred still has recent activity so it is
    // picked up again on the next run. This keeps the pipeline inside the CI time limit so the
    // cleanup, archive and purge steps always get to run.
    if (Date.now() - organizeStart >= timeBudgetMs) {
      totalDeferred = orderedNeighborhoods.slice(i).filter(hasRecentActivityIn).length;
      logger.warn(
        `[${PipelineStep.Organize}] Time budget of ${Math.round(timeBudgetMs / 1000)}s reached after ${totalEvaluated} evaluations. Deferring ${totalDeferred} active neighborhood(s) to the next run.`
      );
      break;
    }
    totalEvaluated++;

    const neighborhoodClusterIds = new Set(neighborhood.map((c) => c.id));
    const mergedSourceIds = new Set<string>();

    // 1. Evaluate candidate duplicate clusters in the neighborhood
    const candidatesForMerge: CandidateClusterForMerge[] = neighborhood.map((c) => ({
      id: c.id,
      headline: c.headline,
      summary: c.summary,
      storyId: c.storyId,
      articleCount: c._count?.articleAssignments ?? 0,
      createdAt: c.createdAt,
      embedding: (Array.isArray(c.embedding) ? c.embedding : null) as number[] | null,
    }));

    const merges = await detectDuplicatesFn(candidatesForMerge, {
      minCosineSimilarity: 0.78,
      minDuplicateProbability: 0.85,
      step: PipelineStep.Organize,
    });

    for (const m of merges) {
      const validSources = m.sourceClusterIds.filter(
        (s) =>
          s !== m.targetClusterId &&
          neighborhoodClusterIds.has(s) &&
          !mergedSourceIds.has(s)
      );

      if (validSources.length > 0 && neighborhoodClusterIds.has(m.targetClusterId)) {
        await mergeClusters(m.targetClusterId, validSources);
        validSources.forEach((id) => mergedSourceIds.add(id));
        totalMerged += validSources.length;
        logger.info(
          `[${PipelineStep.Organize}] Merged ${validSources.length} duplicate cluster(s) into ${m.targetClusterId}`
        );
      }
    }

    const survivingNeighborhood = neighborhood.filter((c) => !mergedSourceIds.has(c.id));
    if (survivingNeighborhood.length < 2) {
      logger.info(
        `[${PipelineStep.Organize}] Only ${survivingNeighborhood.length} cluster(s) remain in neighborhood after merging duplicates. Skipping story umbrella evaluation.`
      );
      continue;
    }

    const candidateStories = findCandidateStoriesForNeighborhood(survivingNeighborhood, existingStories);

    const clustersForPrompt = survivingNeighborhood.map((c) => ({
      id: c.id,
      headline: c.headline,
      summary: c.summary,
      date: new Date(c.createdAt).toISOString().split('T')[0],
      articleCount: c._count?.articleAssignments ?? 0,
    }));

    let evalResult: NeighborhoodEvaluation;
    try {
      evalResult = await evaluateNeighborhoodFn(clustersForPrompt, candidateStories);
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Organize}] Failed evaluating neighborhood ${i + 1}/${orderedNeighborhoods.length}: ${err.message || err}`
      );
      continue;
    }

    // 2. Process story grouping & reactivation
    const storiesToSync =
      evalResult.stories ||
      (evalResult.story ? [evalResult.story] : []);

    const assignedClusterIds = new Set<string>();

    for (const storyItem of storiesToSync) {
      if (Array.isArray(storyItem.angles)) {
        const survivingAngles = storyItem.angles.filter(
          (a) => !mergedSourceIds.has(a.clusterId) && neighborhoodClusterIds.has(a.clusterId)
        );

        if (survivingAngles.length >= 2) {
          survivingAngles.forEach((a) => assignedClusterIds.add(a.clusterId));
          const survivingClusters = neighborhood.filter((c) =>
            survivingAngles.some((a) => a.clusterId === c.id)
          );
          const storyEmbedding = computeCentroidEmbedding(survivingClusters);

          const targetStoryId =
            storyItem.existingStoryId ||
            survivingClusters.find((c) => c.storyId)?.storyId;

          await syncStoryWithAngles({
            existingStoryId: targetStoryId || undefined,
            storyTitle: storyItem.storyTitle,
            status: storyItem.status || 'developing',
            overview: storyItem.overview,
            embedding: storyEmbedding,
            angles: survivingAngles,
          });
          totalStoriesSynced++;
          logger.info(
            `[${PipelineStep.Organize}] Grouped ${survivingAngles.length} angles under story: "${storyItem.storyTitle}"${
              targetStoryId ? ` (updated/reactivated: ${targetStoryId})` : ''
            }`
          );

          // Realign articles across story angles to correct misclassifications
          try {
            const angleClusterIds = survivingAngles.map((a) => a.clusterId);
            const storyArticles = await getStoryArticlesForRealignment(angleClusterIds);

            // Only run article classification if:
            // 1. New story created (!targetStoryId), OR
            // 2. Angle count/membership changed, OR
            // 3. A new cluster was added to this story since it was last organized
            const targetStory = targetStoryId
              ? existingStories.find((s) => s.id === targetStoryId)
              : null;
            const existingStoryClusterCount = targetStory?._count?.clusters;
            const hasAngleCountChange =
              existingStoryClusterCount !== undefined &&
              existingStoryClusterCount !== survivingAngles.length;
            const storyUpdatedMs = targetStory?.updatedAt
              ? new Date(targetStory.updatedAt).getTime()
              : 0;
            const hasNewClusterSinceUpdate = survivingClusters.some(
              (c) => new Date(c.createdAt).getTime() > storyUpdatedMs + 60000
            );

            if (
              storyArticles.length > 0 &&
              (!targetStoryId || hasAngleCountChange || hasNewClusterSinceUpdate)
            ) {
              const anglesWithHeadlines = survivingAngles.map((a) => {
                const cluster = survivingClusters.find((c) => c.id === a.clusterId);
                return {
                  clusterId: a.clusterId,
                  angle: a.angle,
                  headline: cluster?.headline ?? null,
                  embedding: (Array.isArray(cluster?.embedding) ? cluster.embedding : null) as number[] | null,
                };
              });

              const newClusterIds = new Set(
                survivingClusters
                  .filter(
                    (c) =>
                      new Date(c.createdAt).getTime() > storyUpdatedMs + 60000 ||
                      c.storyId !== targetStoryId
                  )
                  .map((c) => c.id)
              );

              const assignments = await classifyAnglesFn(
                storyItem.storyTitle,
                anglesWithHeadlines,
                storyArticles,
                {
                  isExistingStory: Boolean(targetStoryId),
                  newClusterIds,
                }
              );

              const validClusterIdSet = new Set(angleClusterIds);
              const validReassignments = assignments.filter(
                (r) =>
                  validClusterIdSet.has(r.targetClusterId) &&
                  storyArticles.some(
                    (a) => a.articleId === r.articleId && a.currentClusterId !== r.targetClusterId
                  )
              );

              if (validReassignments.length > 0) {
                const { updatedCount } = await realignStoryArticles(validReassignments);
                if (updatedCount > 0) {
                  logger.info(
                    `[${PipelineStep.Organize}] Realigned ${updatedCount} article(s) across angles for story "${storyItem.storyTitle}"`
                  );
                }
              }
            }
          } catch (realignErr: any) {
            logger.warn(
              `[${PipelineStep.Organize}] Article realignment skipped for "${storyItem.storyTitle}": ${realignErr.message || realignErr}`
            );
          }
        }
      }
    }

    // 3. Dissociate any clusters in this neighborhood that had a storyId but were NOT assigned to any story
    const unassignedNeighborhoodClusters = neighborhood.filter(
      (c) => c.storyId && !mergedSourceIds.has(c.id) && !assignedClusterIds.has(c.id)
    );

    if (unassignedNeighborhoodClusters.length > 0) {
      const clusterIdsToDissociate = unassignedNeighborhoodClusters.map((c) => c.id);
      await dissociateClusters(clusterIdsToDissociate);
      logger.info(
        `[${PipelineStep.Organize}] Dissociated ${clusterIdsToDissociate.length} cluster(s) from story (evaluated as standalone): ${clusterIdsToDissociate.join(', ')}`
      );
    }
  }

  // 4. Disband underpopulated stories (< 2 active clusters)
  const { disbandedStoriesCount, dissociatedClustersCount } = await disbandUnderpopulatedStories();
  if (disbandedStoriesCount > 0) {
    logger.info(
      `[${PipelineStep.Organize}] Disbanded ${disbandedStoriesCount} underpopulated story/stories (dissociated ${dissociatedClustersCount} single cluster(s))`
    );
  }

  // 5. Mark inactive stories as dormant (no updates in past 7 days)
  const dormantCount = await markDormantStories(7);
  if (dormantCount > 0) {
    logger.info(
      `[${PipelineStep.Organize}] Marked ${dormantCount} inactive stories as dormant (no updates in 7+ days)`
    );
  }

  logPipelineSection(
    PipelineStep.Organize,
    `Story organization complete in ${Math.round((Date.now() - organizeStart) / 1000)}s. Evaluated ${totalEvaluated} neighborhoods, deferred ${totalDeferred} to next run (time budget ${Math.round(timeBudgetMs / 1000)}s). Merged ${totalMerged} duplicate clusters, synchronized ${totalStoriesSynced} multi-angle stories, skipped ${totalSkippedSettled} settled stories, ${disbandedStoriesCount} disbanded, ${dormantCount} stories dormant.`
  );
}
