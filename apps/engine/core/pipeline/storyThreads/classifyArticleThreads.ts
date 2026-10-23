import { cosineSimilarity } from '../utils';
import { logger, PipelineStep } from '../../../lib/pipelineLogger';
import { generateStructuredJson } from '../../../lib/aiClient';

export type StoryThreadWithHeadline = {
  clusterId: string;
  thread: string;
  headline?: string | null;
  embedding?: number[] | null;
};

// Backward compatibility alias
export type StoryAngleWithHeadline = StoryThreadWithHeadline;

export async function classifyArticleThreads(
  storyTitle: string,
  threads: StoryThreadWithHeadline[],
  articles: Array<{
    articleId: string;
    currentClusterId: string;
    title: string;
    embedding?: unknown;
  }>,
  options?: {
    isExistingStory?: boolean;
    newClusterIds?: Set<string>;
  }
): Promise<Array<{ articleId: string; targetClusterId: string }>> {
  if (threads.length < 2 || articles.length === 0) return [];

  const threadsWithEmbeddings = threads.filter(
    (t) => Array.isArray(t.embedding) && (t.embedding as number[]).length > 0
  );

  const resolvedAssignments: Array<{ articleId: string; targetClusterId: string }> = [];
  const ambiguousArticles: Array<{ articleId: string; currentClusterId: string; title: string }> = [];

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

    // Ambiguous, unassigned or new cluster article without high confidence: defer to LLM
    ambiguousArticles.push({
      articleId: article.articleId,
      currentClusterId: article.currentClusterId,
      title: article.title,
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
      `[${PipelineStep.Organize}] ${resolvedAssignments.length}/${articles.length} article(s) resolved via vector similarity; classifying remaining ${ambiguousArticles.length} article(s) with LLM...`
    );
  }

  const BATCH_SIZE = 25;
  const llmAssignments: Array<{ articleId: string; targetClusterId: string }> = [];

  for (let i = 0; i < ambiguousArticles.length; i += BATCH_SIZE) {
    const batch = ambiguousArticles.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(ambiguousArticles.length / BATCH_SIZE);

    logger.info(
      `[${PipelineStep.Organize}] Classifying batch ${batchIndex}/${totalBatches} (${batch.length} articles) for "${storyTitle}"...`
    );

    const prompt = `You are an objective news editor organizing a multi-thread story.
Story: "${storyTitle}"

Defined Threads in this Story:
${threads.map((t) => `- ID: "${t.clusterId}" | Thread: "${t.thread}"${t.headline ? ` | Headline: "${t.headline}"` : ''}`).join('\n')}

Articles to assign:
${batch.map((a, idx) => `${idx + 1}. ID: "${a.articleId}" | Title: "${a.title}"`).join('\n')}

TASK:
For each article, determine which thread ID it most accurately represents based on its headline and core event.
Assign every article to the single best-matching thread cluster ID.

Return JSON with key "assignments": Array<{ articleId: string, targetClusterId: string }>`;

    const parsed = await generateStructuredJson<{
      assignments: Array<{ articleId: string; targetClusterId: string }>;
    }>({
      prompt,
      systemInstruction:
        'You are an objective news editor. Assign articles to their most accurate thread. Return strict JSON only.',
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

    if (parsed && Array.isArray(parsed.assignments)) {
      llmAssignments.push(...parsed.assignments);
    }
  }

  return [...resolvedAssignments, ...llmAssignments];
}

// Backward compatibility alias
export const classifyArticleAngles = classifyArticleThreads;
