import OpenAI from 'openai';
import {
  getActiveClustersForStories,
  syncStoryWithAngles,
  mergeClusters,
  getStoriesForMatching,
  markDormantStories,
} from '@neus/db';
import type { StoryInput } from '@neus/db';
import { cosineSimilarity } from './utils';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';

const useGemini = !!process.env.GEMINI_API_KEY;

const openai = !useGemini
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    })
  : null;

function resolveGeminiModel(): string {
  const envModel = process.env.SUMMARY_MODEL;
  if (!envModel || envModel.includes('1.5') || envModel.includes('2.0') || envModel === 'gpt-4o-mini') {
    return 'gemini-flash-latest';
  }
  return envModel;
}

export type NeighborhoodMerge = {
  targetClusterId: string;
  sourceClusterIds: string[];
};

export type NeighborhoodStory = {
  existingStoryId?: string | null;
  storyTitle: string;
  status: 'breaking' | 'developing' | 'dormant';
  overview: string;
  angles: Array<{
    clusterId: string;
    angle: string;
  }>;
};

export type NeighborhoodEvaluation = {
  merges: NeighborhoodMerge[];
  story: NeighborhoodStory | null;
};

export type CandidateStory = {
  id: string;
  title: string;
  status: string;
  overview: string | null;
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
  [key: string]: any;
};

/**
 * Groups clusters into candidate neighborhoods using vector similarity and connected components.
 * Standalone clusters (degree 0) are excluded.
 */
export function buildNeighborhoods<T extends ClusterWithEmbedding>(
  clusters: T[],
  similarityThreshold: number = 0.78
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
      neighborhoods.push(componentIndices.map((idx) => validClusters[idx]));
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
          });
          break;
        }
      }
    }
  }

  return Array.from(candidateMap.values());
}

function cleanJsonResponse<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

async function evaluateNeighborhoodWithGemini(
  apiKey: string,
  clusters: Array<{ id: string; headline: string | null; summary: string | null; date: string; articleCount?: number }>,
  candidateStories?: CandidateStory[],
  maxRetries = 3
): Promise<NeighborhoodEvaluation> {
  const modelName = resolveGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `
You are an expert news editor and taxonomist.

Here is a candidate group of closely related news clusters identified by vector similarity:
${JSON.stringify(clusters, null, 2)}

TASK:
Analyze these clusters and determine:
1. MERGES (Duplicate Coverage): Are any of these clusters redundant duplicates covering the EXACT SAME event, announcement, or angle without distinct new developments? (e.g. duplicate wire coverage of the same press release or incident).
   - If yes, specify which should be merged into which. The "targetClusterId" must be the more detailed cluster (or the one with more articles).
   - "sourceClusterIds" are the duplicate clusters that will be absorbed into target and deleted.
2. STORY (Multi-angle saga): After accounting for any merges, do 2 or more distinct remaining clusters represent DIFFERENT ANGLES, chronological developments, or sub-stories of the SAME overarching news saga?
   - If yes, provide:
     - "existingStoryId": If this saga matches or develops an EXISTING STORY listed in the CANDIDATE STORIES below, specify its id. Otherwise null.
     - "storyTitle": A concise, neutral title for the overarching saga.
     - "status": One of "breaking" (first 24-48h of fast-moving breaking news) or "developing" (active ongoing developments/fallout over days/weeks).
     - "overview": A neutral 2-sentence macro-summary synthesizing the whole saga across all its angles.
     - "angles": Array of member clusters with:
       - "clusterId": The cluster id (must NOT be a merged source cluster)
       - "angle": A 2-5 word description of this cluster's specific angle/development (e.g. "Hospital Awakening", "Warden Resignation", "Legal Inquiry").
   - If no (e.g., they are all duplicates of a single event, or they are unrelated events that share coincidental keywords), return null for "story".
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
  "story": {
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
  } | null
}
`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are an objective news taxonomist. Return strict JSON only.' }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (res.status === 429) {
      const backoffMs = Math.pow(2, attempt) * 2000;
      logger.warn(
        `[${PipelineStep.Cluster}] Gemini rate limit (429) on attempt ${attempt}/${maxRetries}. Backing off for ${backoffMs / 1000}s...`
      );
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((r) => setTimeout(r, backoffMs));
      }
      continue;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini neighborhood evaluation API error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('Gemini neighborhood evaluation response missing text');
    }

    try {
      return cleanJsonResponse<NeighborhoodEvaluation>(content);
    } catch (parseErr: any) {
      logger.warn(
        `[${PipelineStep.Cluster}] Failed to parse JSON response on attempt ${attempt}/${maxRetries}: ${parseErr.message}`
      );
      if (attempt === maxRetries) {
        throw parseErr;
      }
    }
  }

  throw new Error(`Exhausted ${maxRetries} retries for Gemini neighborhood evaluation`);
}

async function evaluateNeighborhoodWithOpenAI(
  clusters: Array<{ id: string; headline: string | null; summary: string | null; date: string; articleCount?: number }>,
  candidateStories?: CandidateStory[]
): Promise<NeighborhoodEvaluation> {
  const model = process.env.SUMMARY_MODEL || 'gpt-4o-mini';
  const prompt = `Analyze this candidate neighborhood of clusters. Identify any duplicate clusters to merge, and whether distinct remaining clusters form a multi-angle story:\n${JSON.stringify(clusters, null, 2)}${
    candidateStories && candidateStories.length > 0
      ? `\nCandidate Existing Stories:\n${JSON.stringify(candidateStories, null, 2)}`
      : ''
  }`;

  const completion = await openai!.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are an objective news taxonomist. Return JSON with keys "merges" (array of {targetClusterId, sourceClusterIds: string[]}) and "story" ({existingStoryId: string | null, storyTitle, status, overview, angles: [{clusterId, angle}]} or null).',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
    temperature: 0.1,
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('OpenAI neighborhood evaluation returned empty response');
  return cleanJsonResponse<NeighborhoodEvaluation>(content);
}

export async function organizeStoryAngles() {
  logPipelineStep(PipelineStep.Cluster, 'Organizing clusters into story angles & merging duplicates...');

  const activeClusters = await getActiveClustersForStories(30);

  if (activeClusters.length < 2) {
    logPipelineSection(
      PipelineStep.Cluster,
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
    PipelineStep.Cluster,
    `Evaluated ${activeClusters.length} clusters: found ${neighborhoods.length} candidate neighborhoods (threshold >= ${similarityThreshold})`
  );

  if (neighborhoods.length === 0) {
    logger.info(
      `[${PipelineStep.Cluster}] No cluster neighborhoods detected above threshold. All clusters are standalone.`
    );
    // Still perform dormancy sweep even if no new neighborhoods formed
    const dormantCount = await markDormantStories(7);
    if (dormantCount > 0) {
      logger.info(
        `[${PipelineStep.Cluster}] Marked ${dormantCount} inactive stories as dormant (no updates in 7+ days)`
      );
    }
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  let totalMerged = 0;
  let totalStoriesSynced = 0;

  for (let i = 0; i < neighborhoods.length; i++) {
    const neighborhood = neighborhoods[i];
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
      if (geminiKey) {
        evalResult = await evaluateNeighborhoodWithGemini(geminiKey, clustersForPrompt, candidateStories);
      } else if (openai) {
        evalResult = await evaluateNeighborhoodWithOpenAI(clustersForPrompt, candidateStories);
      } else {
        logger.warn(`[${PipelineStep.Cluster}] No Gemini or OpenAI API key available for neighborhood evaluation.`);
        return;
      }
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Cluster}] Failed evaluating neighborhood ${i + 1}/${neighborhoods.length}: ${err.message || err}`
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
            `[${PipelineStep.Cluster}] Merged ${validSources.length} duplicate cluster(s) into ${m.targetClusterId}`
          );
        }
      }
    }

    // 2. Process story grouping & reactivation
    if (evalResult.story && Array.isArray(evalResult.story.angles)) {
      const survivingAngles = evalResult.story.angles.filter(
        (a) => !mergedSourceIds.has(a.clusterId) && neighborhoodClusterIds.has(a.clusterId)
      );

      if (survivingAngles.length >= 2) {
        const survivingClusters = neighborhood.filter((c) =>
          survivingAngles.some((a) => a.clusterId === c.id)
        );
        const storyEmbedding = computeCentroidEmbedding(survivingClusters);

        const targetStoryId =
          evalResult.story.existingStoryId ||
          neighborhood.find((c) => c.storyId)?.storyId;

        await syncStoryWithAngles({
          existingStoryId: targetStoryId || undefined,
          storyTitle: evalResult.story.storyTitle,
          status: evalResult.story.status || 'developing',
          overview: evalResult.story.overview,
          embedding: storyEmbedding,
          angles: survivingAngles,
        });
        totalStoriesSynced++;
        logger.info(
          `[${PipelineStep.Cluster}] Grouped ${survivingAngles.length} angles under story: "${evalResult.story.storyTitle}"${
            targetStoryId ? ` (updated/reactivated: ${targetStoryId})` : ''
          }`
        );
      }
    }
  }

  // 3. Mark inactive stories as dormant (no updates in past 7 days)
  const dormantCount = await markDormantStories(7);
  if (dormantCount > 0) {
    logger.info(
      `[${PipelineStep.Cluster}] Marked ${dormantCount} inactive stories as dormant (no updates in 7+ days)`
    );
  }

  logPipelineSection(
    PipelineStep.Cluster,
    `Story organization complete. Merged ${totalMerged} duplicate clusters, synchronized ${totalStoriesSynced} multi-angle stories, ${dormantCount} stories dormant.`
  );
}
