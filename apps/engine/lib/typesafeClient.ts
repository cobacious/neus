import { logger, PipelineStep } from './pipelineLogger';
import { recordAiUsage } from './aiUsage';
import { cosineSimilarity } from '../core/pipeline/utils';

const TYPESAFE_API_BASE_URL =
  process.env.TYPESAFE_API_BASE_URL || 'https://api.typesafe.ai';

export interface ChoiceQuestionDef {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | Record<string, any> | null>;
}

export interface NoulQuestionDef {
  type: 'noul';
  instructions: string;
  criteria?: {
    true?: string;
    false?: string;
  };
}

export interface ScoreQuestionDef {
  type: 'score';
  instructions: string;
  criteria: string[] | Record<string, string>;
}

export type SystemOneQuestionDef = ChoiceQuestionDef | NoulQuestionDef | ScoreQuestionDef;

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface NoulAnswer {
  type: 'noul';
  noul: number;
}

export interface ScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}

export type SystemOneAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export interface SystemOneRequestPayload {
  model?: string;
  state: any;
  questions: Record<string, SystemOneQuestionDef>;
}

export interface SystemOneResponse {
  model: string;
  answers: Record<string, SystemOneAnswer>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface SystemOneCallOptions {
  step?: PipelineStep | string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Default System One model.
 */
export function resolveTypeSafeModel(): string {
  return process.env.TYPESAFE_MODEL || 'jev-latest';
}

/**
 * Calls TypeSafe's System One API with automatic timing, usage tracking and retries.
 */
export async function callSystemOne(
  request: SystemOneRequestPayload,
  options: SystemOneCallOptions = {}
): Promise<SystemOneResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  const model = request.model || resolveTypeSafeModel();
  const step = options.step || PipelineStep.Organize;
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxRetries = options.retries ?? 2;

  const url = `${TYPESAFE_API_BASE_URL}/v1/systemone`;
  const body = JSON.stringify({
    model,
    state: request.state,
    questions: request.questions,
  });

  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Neus-Engine/1.0',
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const durationMs = Date.now() - attemptStart;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const isRetryable = response.status === 429 || response.status >= 500;

        if (isRetryable && attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
          logger.warn(
            `[${step}] TypeSafe API HTTP ${response.status} (${errorText.slice(0, 100)}). Retrying in ${backoffMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        recordAiUsage({
          step: String(step),
          provider: 'typesafe',
          model,
          operation: 'judge',
          durationMs,
          failed: true,
        });

        throw new Error(`TypeSafe API HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as SystemOneResponse;
      const totalDuration = Date.now() - startTime;

      recordAiUsage({
        step: String(step),
        provider: 'typesafe',
        model: data.model || model,
        operation: 'judge',
        durationMs: totalDuration,
        promptTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      });

      return data;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries && !err.name?.includes('Abort')) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      break;
    }
  }

  recordAiUsage({
    step: String(step),
    provider: 'typesafe',
    model,
    operation: 'judge',
    durationMs: Date.now() - startTime,
    failed: true,
  });

  throw lastError || new Error('TypeSafe API call failed');
}

export interface ArticleThreadCandidate {
  clusterId: string;
  thread?: string;
  angle?: string;
  headline?: string | null;
  summary?: string | null;
}

export type ArticleAngleCandidate = ArticleThreadCandidate;

export interface ArticleInputForThread {
  id: string;
  title: string;
  snippet?: string | null;
  content?: string | null;
}

export type ArticleInputForAngle = ArticleInputForThread;

export interface ArticleThreadResult {
  targetClusterId: string | null;
  confidence: number;
  choice: string;
  probabilities: Record<string, number>;
}

export type ArticleAngleResult = ArticleThreadResult;

/**
 * Classifies an article into one of several candidate story threads or returns null if
 * it fits none of the threads or confidence is low.
 */
export async function classifyArticleThread(params: {
  article: ArticleInputForThread;
  threads?: ArticleThreadCandidate[];
  angles?: ArticleAngleCandidate[];
  storyTitle?: string;
  minConfidence?: number;
  step?: PipelineStep;
}): Promise<ArticleThreadResult> {
  const candidateThreads = params.threads || params.angles || [];
  const { article, storyTitle, minConfidence = 0.45, step = PipelineStep.Organize } = params;

  if (candidateThreads.length === 0) {
    return {
      targetClusterId: null,
      confidence: 1.0,
      choice: 'none_of_the_above',
      probabilities: { none_of_the_above: 1.0 },
    };
  }

  // Construct thread options map
  const criteria: Record<string, string> = {};
  for (const t of candidateThreads) {
    const key = `thread_${t.clusterId}`;
    const descParts: string[] = [`Thread focus: ${t.thread || t.angle || 'General Thread'}`];
    if (t.headline) descParts.push(`Headline: ${t.headline}`);
    if (t.summary) descParts.push(`Summary: ${t.summary}`);
    criteria[key] = descParts.join(' | ');
  }
  criteria['none_of_the_above'] =
    'Does not clearly belong to any of these threads; describes a separate event or topic';

  // Construct state with headline, snippet and leading 2,000 characters of body
  const leadBody = article.content ? article.content.trim().slice(0, 2000) : undefined;
  const state: Record<string, any> = {
    storyUmbrella: storyTitle || undefined,
    articleHeadline: article.title,
    articleSnippet: article.snippet || undefined,
    articleLeadText: leadBody || undefined,
  };

  const response = await callSystemOne(
    {
      state,
      questions: {
        thread: {
          type: 'choice',
          instructions:
            'Which specific story thread does this news article belong to? Select none_of_the_above if it describes a different event or topic.',
          criteria,
        },
      },
    },
    { step }
  );

  const answer = (response.answers['thread'] || response.answers['angle']) as ChoiceAnswer;
  if (!answer || answer.type !== 'choice') {
    throw new Error('TypeSafe response did not contain expected choice answer');
  }

  let targetClusterId: string | null = null;
  if (
    (answer.choice.startsWith('thread_') || answer.choice.startsWith('angle_')) &&
    answer.confidence >= minConfidence
  ) {
    targetClusterId = answer.choice.replace(/^thread_|^angle_/, '');
  }

  return {
    targetClusterId,
    confidence: answer.confidence,
    choice: answer.choice,
    probabilities: answer.probabilities,
  };
}

// Backward compatibility alias
export const classifyArticleAngle = classifyArticleThread;

/**
 * Classifies multiple ambiguous articles against candidate threads in parallel batches.
 */
export async function classifyArticleThreadsBatch(params: {
  articles: ArticleInputForThread[];
  threads?: ArticleThreadCandidate[];
  angles?: ArticleAngleCandidate[];
  storyTitle?: string;
  concurrency?: number;
  minConfidence?: number;
  step?: PipelineStep;
}): Promise<Array<{ articleId: string; targetClusterId: string | null; confidence: number; choice: string }>> {
  const {
    articles,
    storyTitle,
    concurrency = 5,
    minConfidence = 0.45,
    step = PipelineStep.Organize,
  } = params;
  const candidateThreads = params.threads || params.angles || [];

  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  const results: Array<{
    articleId: string;
    targetClusterId: string | null;
    confidence: number;
    choice: string;
  }> = [];

  for (let i = 0; i < articles.length; i += concurrency) {
    const chunk = articles.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (art) => {
      try {
        const res = await classifyArticleThread({
          article: art,
          threads: candidateThreads,
          storyTitle,
          minConfidence,
          step,
        });
        return {
          articleId: art.id,
          targetClusterId: res.targetClusterId,
          confidence: res.confidence,
          choice: res.choice,
        };
      } catch (err: any) {
        logger.warn(
          `[${step}] System One thread classification failed for article "${art.id}": ${err.message}`
        );
        return {
          articleId: art.id,
          targetClusterId: null,
          confidence: 0,
          choice: 'error',
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

// Backward compatibility aliases
export const classifyArticleAnglesBatch = classifyArticleThreadsBatch;
export const classifyArticleAnglesBatchWithJev = classifyArticleThreadsBatch;

/**
 * Verifies if two clusters describe the exact same real-world event.
 */
export async function verifyDuplicateClusters(params: {
  clusterA: { title: string; summary?: string | null };
  clusterB: { title: string; summary?: string | null };
  step?: PipelineStep;
}): Promise<{ isDuplicate: boolean; probability: number }> {
  const { clusterA, clusterB, step = PipelineStep.Cluster } = params;

  const state = {
    storyA: {
      headline: clusterA.title,
      summary: clusterA.summary || undefined,
    },
    storyB: {
      headline: clusterB.title,
      summary: clusterB.summary || undefined,
    },
  };

  const response = await callSystemOne(
    {
      state,
      questions: {
        is_same_event: {
          type: 'noul',
          instructions:
            'Are these two news stories reporting on the exact same specific real-world event?',
          criteria: {
            true: 'Both stories report on the exact same specific incident or occurrence.',
            false:
              'The stories cover different events, even if they share broad keywords, locations or related themes.',
          },
        },
      },
    },
    { step }
  );

  const answer = response.answers['is_same_event'] as NoulAnswer;
  if (!answer || answer.type !== 'noul') {
    throw new Error('TypeSafe response did not contain expected noul answer');
  }

  return {
    isDuplicate: answer.noul >= 0.85,
    probability: answer.noul,
  };
}

export interface CandidateClusterForMerge {
  id: string;
  headline?: string | null;
  summary?: string | null;
  storyId?: string | null;
  articleCount: number;
  createdAt: Date | string;
  embedding?: number[] | null;
}

export interface ClusterMergeDecision {
  targetClusterId: string;
  sourceClusterIds: string[];
}

/**
 * Detects duplicate clusters within a candidate neighborhood using pairwise cosine similarity
 * and System One Noul verification.
 */
export async function detectDuplicateClusters(
  clusters: CandidateClusterForMerge[],
  options?: {
    minCosineSimilarity?: number;
    minDuplicateProbability?: number;
    step?: PipelineStep;
  }
): Promise<ClusterMergeDecision[]> {
  const minCosine = options?.minCosineSimilarity ?? 0.78;
  const minProb = options?.minDuplicateProbability ?? 0.85;
  const step = options?.step ?? PipelineStep.Organize;

  if (clusters.length < 2) return [];

  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  // 1. Identify candidate duplicate pairs with cosine similarity >= minCosine
  const candidatePairs: Array<[CandidateClusterForMerge, CandidateClusterForMerge, number]> = [];
  for (let i = 0; i < clusters.length; i++) {
    const c1 = clusters[i];
    const emb1 = Array.isArray(c1.embedding) && c1.embedding.length > 0 ? c1.embedding : null;
    if (!emb1) continue;

    for (let j = i + 1; j < clusters.length; j++) {
      const c2 = clusters[j];
      const emb2 = Array.isArray(c2.embedding) && c2.embedding.length > 0 ? c2.embedding : null;
      if (!emb2) continue;

      const sim = cosineSimilarity(emb1, emb2);
      if (sim >= minCosine) {
        candidatePairs.push([c1, c2, sim]);
      }
    }
  }

  if (candidatePairs.length === 0) return [];

  logger.info(
    `[${step}] Evaluating ${candidatePairs.length} candidate duplicate pair(s) with System One (cosine >= ${minCosine})...`
  );

  // 2. Evaluate candidate pairs with System One Noul in parallel
  const pairVerifications = await Promise.all(
    candidatePairs.map(async ([c1, c2, sim]) => {
      try {
        const res = await verifyDuplicateClusters({
          clusterA: { title: c1.headline || '', summary: c1.summary },
          clusterB: { title: c2.headline || '', summary: c2.summary },
          step,
        });
        return { c1, c2, sim, isDuplicate: res.probability >= minProb, probability: res.probability };
      } catch (err: any) {
        logger.warn(
          `[${step}] Duplicate verification failed for clusters ${c1.id} & ${c2.id}: ${err.message}`
        );
        return { c1, c2, sim, isDuplicate: false, probability: 0 };
      }
    })
  );

  // 3. Formulate merge decisions
  // An absorbed source cluster cannot be a target or a source for another merge in the same pass
  const mergedSources = new Set<string>();
  const mergesByTarget = new Map<string, Set<string>>();

  for (const item of pairVerifications) {
    if (!item.isDuplicate) continue;
    const { c1, c2, probability } = item;

    if (mergedSources.has(c1.id) || mergedSources.has(c2.id)) continue;

    // Determine target vs source:
    // 1. Prefer cluster with existing storyId
    // 2. Prefer cluster with more articles
    // 3. Prefer older cluster
    let target = c1;
    let source = c2;

    if (!c1.storyId && c2.storyId) {
      target = c2;
      source = c1;
    } else if (c1.storyId && !c2.storyId) {
      target = c1;
      source = c2;
    } else if (c2.articleCount > c1.articleCount) {
      target = c2;
      source = c1;
    } else if (c1.articleCount > c2.articleCount) {
      target = c1;
      source = c2;
    } else {
      const time1 = new Date(c1.createdAt).getTime();
      const time2 = new Date(c2.createdAt).getTime();
      if (time2 < time1) {
        target = c2;
        source = c1;
      }
    }

    logger.info(
      `[${step}] System One identified duplicate clusters: absorbing "${source.headline || source.id}" into "${target.headline || target.id}" (probability=${probability.toFixed(2)})`
    );

    mergedSources.add(source.id);
    if (!mergesByTarget.has(target.id)) {
      mergesByTarget.set(target.id, new Set());
    }
    mergesByTarget.get(target.id)!.add(source.id);
  }

  const decisions: ClusterMergeDecision[] = [];
  for (const [targetId, sourceSet] of mergesByTarget.entries()) {
    decisions.push({
      targetClusterId: targetId,
      sourceClusterIds: Array.from(sourceSet),
    });
  }

  return decisions;
}

export interface CandidateStoryContext {
  id: string;
  title: string;
  overview?: string | null;
}

export interface StorySagaDecision {
  existingStoryId: string | null;
  clusterIds: string[];
}

/**
 * Verifies if two distinct clusters report on different angles, developments or consequences
 * of the exact same overarching news saga.
 */
export async function verifySagaRelationship(params: {
  clusterA: { title: string; summary?: string | null };
  clusterB: { title: string; summary?: string | null };
  step?: PipelineStep;
}): Promise<{ isSameSaga: boolean; probability: number }> {
  const { clusterA, clusterB, step = PipelineStep.Organize } = params;

  const state = {
    storyA: {
      headline: clusterA.title,
      summary: clusterA.summary || undefined,
    },
    storyB: {
      headline: clusterB.title,
      summary: clusterB.summary || undefined,
    },
  };

  const response = await callSystemOne(
    {
      state,
      questions: {
        is_same_saga: {
          type: 'noul',
          instructions:
            'Do these two news reports cover different angles, developments or consequences of the exact same overarching news saga?',
          criteria: {
            true: 'Both reports cover different facets, developments or chronological consequences of the exact same overarching news saga (e.g. an incident and hospital aftermath, or an opening speech and policy debate at a summit).',
            false:
              'The reports cover separate or independent events, even if they share broad keywords, locations or related thematic beats.',
          },
        },
      },
    },
    { step }
  );

  const answer = response.answers['is_same_saga'] as NoulAnswer;
  if (!answer || answer.type !== 'noul') {
    throw new Error('TypeSafe response did not contain expected noul answer');
  }

  return {
    isSameSaga: answer.noul >= 0.85,
    probability: answer.noul,
  };
}

/**
 * Verifies if a cluster belongs to an existing news story saga.
 */
export async function verifyStoryMembership(params: {
  cluster: { title: string; summary?: string | null };
  story: { title: string; overview?: string | null };
  step?: PipelineStep;
}): Promise<{ isMember: boolean; probability: number }> {
  const { cluster, story, step = PipelineStep.Organize } = params;

  const state = {
    storyUmbrella: {
      title: story.title,
      overview: story.overview || undefined,
    },
    cluster: {
      headline: cluster.title,
      summary: cluster.summary || undefined,
    },
  };

  const response = await callSystemOne(
    {
      state,
      questions: {
        is_member: {
          type: 'noul',
          instructions:
            'Does this news report represent a specific angle, development or consequence belonging to the existing news saga?',
          criteria: {
            true: 'This report directly belongs under the overarching news saga described by the story title and overview.',
            false:
              'This report covers a separate occurrence or unrelated topic that does not belong under this specific story umbrella.',
          },
        },
      },
    },
    { step }
  );

  const answer = response.answers['is_member'] as NoulAnswer;
  if (!answer || answer.type !== 'noul') {
    throw new Error('TypeSafe response did not contain expected noul answer');
  }

  return {
    isMember: answer.noul >= 0.85,
    probability: answer.noul,
  };
}

/**
 * Evaluates candidate clusters within a neighborhood to identify confirmed multi-angle stories
 * using System One Noul judgments.
 */
export async function detectStorySagas(
  clusters: CandidateClusterForMerge[],
  candidateStories: CandidateStoryContext[] = [],
  options?: {
    minSagaProbability?: number;
    step?: PipelineStep;
  }
): Promise<StorySagaDecision[]> {
  const minProb = options?.minSagaProbability ?? 0.85;
  const step = options?.step ?? PipelineStep.Organize;

  if (clusters.length < 2) return [];

  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  // 1. If candidate stories exist, verify membership for clusters
  const matchedStoryClusters = new Map<string, Set<string>>();
  const unassignedClusters: CandidateClusterForMerge[] = [];

  for (const c of clusters) {
    let matchedId: string | null = null;

    if (c.storyId && candidateStories.some((s) => s.id === c.storyId)) {
      matchedId = c.storyId;
    } else if (candidateStories.length > 0) {
      for (const s of candidateStories) {
        try {
          const res = await verifyStoryMembership({
            cluster: { title: c.headline || '', summary: c.summary },
            story: { title: s.title, overview: s.overview },
            step,
          });
          if (res.probability >= minProb) {
            matchedId = s.id;
            break;
          }
        } catch (err: any) {
          logger.warn(`[${step}] Story membership verification failed for cluster ${c.id}: ${err.message}`);
        }
      }
    }

    if (matchedId) {
      if (!matchedStoryClusters.has(matchedId)) {
        matchedStoryClusters.set(matchedId, new Set());
      }
      matchedStoryClusters.get(matchedId)!.add(c.id);
    } else {
      unassignedClusters.push(c);
    }
  }

  const decisions: StorySagaDecision[] = [];

  // Collect confirmed existing stories with >= 2 member clusters in this neighborhood
  for (const [storyId, clusterIdSet] of matchedStoryClusters.entries()) {
    if (clusterIdSet.size >= 2) {
      decisions.push({
        existingStoryId: storyId,
        clusterIds: Array.from(clusterIdSet),
      });
    }
  }

  // 2. For unassigned clusters, evaluate pairwise saga relationships to discover new stories
  if (unassignedClusters.length >= 2) {
    const candidatePairs: Array<[CandidateClusterForMerge, CandidateClusterForMerge]> = [];
    for (let i = 0; i < unassignedClusters.length; i++) {
      for (let j = i + 1; j < unassignedClusters.length; j++) {
        candidatePairs.push([unassignedClusters[i], unassignedClusters[j]]);
      }
    }

    const pairVerifications = await Promise.all(
      candidatePairs.map(async ([c1, c2]) => {
        try {
          const res = await verifySagaRelationship({
            clusterA: { title: c1.headline || '', summary: c1.summary },
            clusterB: { title: c2.headline || '', summary: c2.summary },
            step,
          });
          return { c1, c2, isSameSaga: res.probability >= minProb };
        } catch (err: any) {
          logger.warn(`[${step}] Saga relationship check failed for clusters ${c1.id} & ${c2.id}: ${err.message}`);
          return { c1, c2, isSameSaga: false };
        }
      })
    );

    // Build connected components for new sagas
    const adjacency = new Map<string, Set<string>>();
    for (const c of unassignedClusters) {
      adjacency.set(c.id, new Set());
    }
    for (const item of pairVerifications) {
      if (item.isSameSaga) {
        adjacency.get(item.c1.id)!.add(item.c2.id);
        adjacency.get(item.c2.id)!.add(item.c1.id);
      }
    }

    const visited = new Set<string>();
    for (const c of unassignedClusters) {
      if (visited.has(c.id)) continue;

      const component: string[] = [];
      const queue = [c.id];
      visited.add(c.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        component.push(curr);
        for (const neighbor of adjacency.get(curr) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      if (component.length >= 2) {
        decisions.push({
          existingStoryId: null,
          clusterIds: component,
        });
      }
    }
  }

  return decisions;
}
