import { cosineSimilarity } from '../utils';
import { logger, PipelineStep } from '../../../lib/pipelineLogger';
import { classifyArticleThreadsBatch } from '../../../lib/typesafeClient';

export type StoryThreadWithHeadline = {
  clusterId: string;
  thread: string;
  headline?: string | null;
  embedding?: number[] | null;
};

// Backward compatibility alias
export type StoryAngleWithHeadline = StoryThreadWithHeadline;

export interface ClassifyArticleThreadsDependencies {
  classifyBatch?: typeof classifyArticleThreadsBatch;
}

export async function classifyArticleThreads(
  storyTitle: string,
  threads: StoryThreadWithHeadline[],
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
  deps: ClassifyArticleThreadsDependencies = {}
): Promise<Array<{ articleId: string; targetClusterId: string }>> {
  if (threads.length < 2 || articles.length === 0) return [];

  const threadsWithEmbeddings = threads.filter(
    (t) => Array.isArray(t.embedding) && (t.embedding as number[]).length > 0
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

    if (artEmb && threadsWithEmbeddings.length >= 2) {
      const matchingThreads = threadsWithEmbeddings.filter(
        (t) => (t.embedding as number[]).length === artEmb.length
      );

      if (matchingThreads.length >= 2) {
        const scored = matchingThreads
          .map((t) => ({
            clusterId: t.clusterId,
            similarity: cosineSimilarity(artEmb, t.embedding as number[]),
          }))
          .sort((x, y) => y.similarity - x.similarity);

        const best = scored[0];
        const second = scored[1];
        const margin = (best?.similarity ?? 0) - (second?.similarity ?? 0);

        // Confident match:
        // - If best match is current cluster with solid similarity (>= 0.65) and clear margin (>= 0.04), keep it.
        // - If best match is a different cluster with strong separation (similarity >= 0.70 and margin >= 0.04), reassign.
        if (
          best.clusterId === article.currentClusterId &&
          best.similarity >= 0.65 &&
          margin >= 0.04
        ) {
          resolvedAssignments.push({
            articleId: article.articleId,
            targetClusterId: best.clusterId,
          });
          continue;
        } else if (best.similarity >= 0.7 && margin >= 0.04) {
          resolvedAssignments.push({
            articleId: article.articleId,
            targetClusterId: best.clusterId,
          });
          continue;
        }
      }
    }

    // Incremental optimization: if this is an existing story and the article is already
    // in an established cluster (not a new incoming cluster), keep its current assignment
    // rather than paying for an LLM re-classification.
    if (
      isExistingStory &&
      !isFromNewCluster &&
      threads.some((t) => t.clusterId === article.currentClusterId)
    ) {
      resolvedAssignments.push({
        articleId: article.articleId,
        targetClusterId: article.currentClusterId,
      });
      continue;
    }

    // Ambiguous, unassigned or new cluster article without high confidence: defer to model evaluation
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
      `[${PipelineStep.Organize}] All ${articles.length} article(s) for "${storyTitle}" resolved via vector similarity (0 LLM calls)`
    );
    return resolvedAssignments;
  }

  if (resolvedAssignments.length > 0) {
    logger.info(
      `[${PipelineStep.Organize}] ${resolvedAssignments.length}/${articles.length} article(s) resolved via vector similarity; classifying remaining ${ambiguousArticles.length} article(s)...`
    );
  }

  const llmAssignments: Array<{ articleId: string; targetClusterId: string }> = [];
  const classifyBatchFn = deps.classifyBatch ?? classifyArticleThreadsBatch;

  logger.info(
    `[${PipelineStep.Organize}] Classifying ${ambiguousArticles.length} ambiguous article(s) for "${storyTitle}" with TypeSafe Jev (parallel)...`
  );

  const jevResults = await classifyBatchFn({
    articles: ambiguousArticles.map((a) => ({
      id: a.articleId,
      title: a.title,
      snippet: a.snippet,
      content: a.content,
    })),
    threads: threads.map((t) => ({
      clusterId: t.clusterId,
      thread: t.thread,
      headline: t.headline,
    })),
    storyTitle,
    step: PipelineStep.Organize,
  });

  for (const res of jevResults) {
    if (res.targetClusterId) {
      llmAssignments.push({
        articleId: res.articleId,
        targetClusterId: res.targetClusterId,
      });
    }
  }

  return [...resolvedAssignments, ...llmAssignments];
}

// Backward compatibility alias
export const classifyArticleAngles = classifyArticleThreads;
