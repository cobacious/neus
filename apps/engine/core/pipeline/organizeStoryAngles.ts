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

export type NeighborhoodMerge = {
  targetClusterId: string;
  sourceClusterIds: string[];
};

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
  merges: NeighborhoodMerge[];
  stories?: NeighborhoodStory[];
  story?: NeighborhoodStory | null;
};

export type CandidateStory = {
  id: string;
  title: string;
  status: string;
  overview: string | null;
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
    _count?: { clusters: number };
  }>,
  activityCutoff: Date
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

  // If the story has more clusters in the database than are present in this neighborhood,
  // do not treat as settled (an angle might be dissociated or split)
  if (matchedStory._count && matchedStory._count.clusters > neighborhood.length) {
    return { settled: false };
  }

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

Here is a candidate group of closely related news clusters identified by vector similarity:
${JSON.stringify(clusters, null, 2)}

TASK:
Analyze these clusters and determine:
1. MERGES (Duplicate Coverage): Are any of these clusters redundant duplicates covering the EXACT SAME event, announcement, or angle without distinct new developments? (e.g. duplicate wire coverage of the same press release or incident).
   - If yes, specify which should be merged into which. The "targetClusterId" must be the more detailed cluster (or the one with more articles).
   - "sourceClusterIds" are the duplicate clusters that will be absorbed into target and deleted.
2. STORIES (Multi-angle saga): After accounting for any merges, do 2 or more distinct remaining clusters represent DIFFERENT ANGLES, chronological developments, or sub-stories of the SAME overarching news saga?
   - If yes, provide for each story:
     - "existingStoryId": If this saga matches or develops an EXISTING STORY listed in the CANDIDATE STORIES below, specify its id. Otherwise null.
     - "storyTitle": A concise, neutral title for the overarching saga.
     - "status": One of "breaking" (first 12-24h of newly emerging breaking news where details are still arriving) or "developing" (multi-angle saga actively expanding in scope with related spin-offs/fallout).
     - "overview": A neutral 2-sentence macro-summary synthesizing the whole saga across all its angles.
     - "angles": Array of member clusters with:
       - "clusterId": The cluster id (must NOT be a merged source cluster)
       - "angle": A 2-5 word description of this cluster's specific angle/development (e.g. "Hospital Awakening", "Warden Resignation", "Legal Inquiry").

EDITORIAL TAXONOMY GUIDELINES:
A multi-angle "Story" is an overarching news topic that brings together 2 or more distinct angles, chronological chapters, or key facets of:
1. Narrative Sagas & Investigations: Unfolding events with direct consequences (e.g. an incident occurs -> hospital/investigative updates -> institutional fallout/resignation -> legal/judicial proceedings).
2. Major Scheduled Macro-Events: Significant calendar events with multiple major speeches, announcements, or debates (e.g. party conferences, bilateral summits, legislative budget sessions, tournaments).

CRITICAL TITLING & OVERVIEW RULES:
- The "storyTitle" MUST be an objective, balanced MACRO-UMBRELLA headline representing the whole story or event (e.g., "Conservative Party Conference: Speeches, Policy Debates, and Reactions", "Botched Execution of Christa Pike and Fallout").
- NEVER name the "storyTitle" after a single specific sub-angle, individual policy pledge, or single participant (e.g. DO NOT name a multi-angle conference story after one specific policy pledge like "Badenoch Pledges to Scrap Inheritance Tax" — that subordinates the other angles!).
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
  "merges": [
    {
      "targetClusterId": string,
      "sourceClusterIds": string[]
    }
  ],
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
        merges: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              targetClusterId: { type: 'STRING' },
              sourceClusterIds: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['targetClusterId', 'sourceClusterIds'],
          },
        },
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
      required: ['merges', 'stories'],
    },
  });
}

export async function classifyArticleAngles(
  storyTitle: string,
  angles: Array<{ clusterId: string; angle: string; headline?: string | null }>,
  articles: Array<{ articleId: string; currentClusterId: string; title: string }>
): Promise<Array<{ articleId: string; targetClusterId: string }>> {
  if (angles.length < 2 || articles.length === 0) return [];

  const BATCH_SIZE = 25;
  const allAssignments: Array<{ articleId: string; targetClusterId: string }> = [];

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    logger.info(
      `[${PipelineStep.Organize}] Classifying batch ${batchIndex}/${totalBatches} (${batch.length} articles) for "${storyTitle}"...`
    );

    const prompt = `You are an objective news editor organizing a multi-angle story.
Story: "${storyTitle}"

Defined Angles in this Story:
${angles.map((a) => `- ID: "${a.clusterId}" | Angle: "${a.angle}"${a.headline ? ` | Headline: "${a.headline}"` : ''}`).join('\n')}

Articles to assign:
${batch.map((a, idx) => `${idx + 1}. ID: "${a.articleId}" | Title: "${a.title}"`).join('\n')}

TASK:
For each article, determine which angle ID it most accurately represents based on its headline and core event.
Assign every article to the single best-matching angle cluster ID.

Return JSON with key "assignments": Array<{ articleId: string, targetClusterId: string }>`;

    const parsed = await generateStructuredJson<{
      assignments: Array<{ articleId: string; targetClusterId: string }>;
    }>({
      prompt,
      systemInstruction:
        'You are an objective news editor. Assign articles to their most accurate angle. Return strict JSON only.',
      step: PipelineStep.Organize,
      schema: {
        type: 'OBJECT',
        properties: {
          assignments: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                articleId: { type: 'STRING' },
                targetClusterId: { type: 'STRING' },
              },
              required: ['articleId', 'targetClusterId'],
            },
          },
        },
        required: ['assignments'],
      },
    });

    if (Array.isArray(parsed.assignments)) {
      allAssignments.push(...parsed.assignments);
    }
  }

  return allAssignments;
}

export async function organizeStoryAngles() {
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

  const RECENT_ACTIVITY_HOURS = 48;
  const activityCutoff = new Date(Date.now() - RECENT_ACTIVITY_HOURS * 60 * 60 * 1000);

  for (let i = 0; i < neighborhoods.length; i++) {
    const neighborhood = neighborhoods[i];

    // Skip settled neighborhoods where all clusters already belong to the same existing story,
    // angles are assigned, and no new clusters or articles arrived in the past RECENT_ACTIVITY_HOURS
    const settledCheck = isSettledNeighborhood(neighborhood, existingStories, activityCutoff);
    if (settledCheck.settled) {
      totalSkippedSettled++;
      logger.info(
        `[${PipelineStep.Organize}] Skipping settled story neighborhood for "${settledCheck.storyTitle}" (no new clusters or articles in past ${RECENT_ACTIVITY_HOURS}h)`
      );
      continue;
    }

    const candidateStories = findCandidateStoriesForNeighborhood(neighborhood, existingStories);

    const clustersForPrompt = neighborhood.map((c) => ({
      id: c.id,
      headline: c.headline,
      summary: c.summary,
      date: new Date(c.createdAt).toISOString().split('T')[0],
      articleCount: c._count?.articleAssignments ?? 0,
    }));

    let evalResult: NeighborhoodEvaluation;
    try {
      evalResult = await evaluateNeighborhood(clustersForPrompt, candidateStories);
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Organize}] Failed evaluating neighborhood ${i + 1}/${neighborhoods.length}: ${err.message || err}`
      );
      continue;
    }

    const neighborhoodClusterIds = new Set(neighborhood.map((c) => c.id));
    const mergedSourceIds = new Set<string>();

    // 1. Process merges
    for (const m of evalResult.merges || []) {
      if (m.targetClusterId && Array.isArray(m.sourceClusterIds)) {
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
            // 1. Angle count/membership changed, OR
            // 2. Any cluster in this story received new articles or was created in the last 48h
            const hasRecentActivity = survivingClusters.some((c) => {
              const latest = (c as any).articleAssignments?.[0]?.createdAt;
              return (
                (latest && new Date(latest) >= activityCutoff) ||
                new Date(c.createdAt) >= activityCutoff
              );
            });
            const existingStoryClusterCount = targetStoryId
              ? existingStories.find((s) => s.id === targetStoryId)?._count?.clusters
              : undefined;
            const hasAngleCountChange =
              existingStoryClusterCount !== undefined &&
              existingStoryClusterCount !== survivingAngles.length;

            if (
              storyArticles.length > 0 &&
              (hasRecentActivity || hasAngleCountChange || !targetStoryId)
            ) {
              const anglesWithHeadlines = survivingAngles.map((a) => ({
                clusterId: a.clusterId,
                angle: a.angle,
                headline: survivingClusters.find((c) => c.id === a.clusterId)?.headline ?? null,
              }));

              const assignments = await classifyArticleAngles(
                storyItem.storyTitle,
                anglesWithHeadlines,
                storyArticles
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
    `Story organization complete. Merged ${totalMerged} duplicate clusters, synchronized ${totalStoriesSynced} multi-angle stories, skipped ${totalSkippedSettled} settled stories, ${disbandedStoriesCount} disbanded, ${dormantCount} stories dormant.`
  );
}
