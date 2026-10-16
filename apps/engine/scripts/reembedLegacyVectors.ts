import '../env';
import {
  getArticlesNeedingMigration,
  getClustersNeedingMigration,
  updateArticleEmbeddingsBatch,
  updateClusterEmbeddingsBatch,
  recomputeClusterCentroids,
} from '@neus/db';
import { generateEmbedding, generateEmbeddingsBatch } from '../lib/aiClient';
import { logger } from '../lib/pipelineLogger';
import { scoreClusters } from '../core/pipeline/scoreClusters';

const MAX_EMBEDDING_CHARS = 8192;
const BATCH_SIZE = 50;

async function runMigration() {
  const startedAt = Date.now();
  logger.info('[MIGRATION] Starting vector normalization to gemini-embedding-2...');

  // Step 1: Generate reference Gemini embedding to identify orthogonal OpenAI vectors
  logger.info('[MIGRATION] Generating reference Gemini vector...');
  const referenceGeminiVector = await generateEmbedding(
    'Standard news reference text for vector space detection'
  );

  // Step 2: Query articles needing re-embedding
  logger.info('[MIGRATION] Scanning database for legacy OpenAI article vectors...');
  const articles = await getArticlesNeedingMigration(referenceGeminiVector);
  logger.info(`[MIGRATION] Found ${articles.length} articles needing Gemini re-embedding`);

  // Step 3: Re-embed articles in batches
  let embeddedArticles = 0;
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const chunk = articles.slice(i, i + BATCH_SIZE);
    const validItems: Array<{ id: string; text: string }> = [];

    for (const a of chunk) {
      const textToEmbed = a.content || a.snippet || a.title;
      if (textToEmbed && textToEmbed.trim().length > 0) {
        validItems.push({
          id: a.id,
          text: textToEmbed.slice(0, MAX_EMBEDDING_CHARS),
        });
      }
    }

    if (validItems.length > 0) {
      const vectors = await generateEmbeddingsBatch(validItems.map((item) => item.text));
      const updates = validItems.map((item, idx) => ({
        id: item.id,
        embedding: vectors[idx],
      }));

      await updateArticleEmbeddingsBatch(updates);
      embeddedArticles += updates.length;
    }

    logger.info(
      `[MIGRATION] Progress: ${embeddedArticles}/${articles.length} articles re-embedded (${Math.round((embeddedArticles / articles.length) * 100)}%)`
    );
  }

  // Step 4: Query active clusters needing re-embedding
  logger.info('[MIGRATION] Scanning database for legacy OpenAI cluster vectors...');
  const clusters = await getClustersNeedingMigration(referenceGeminiVector);
  logger.info(`[MIGRATION] Found ${clusters.length} active clusters needing re-embedding`);

  // Step 5: Recalculate cluster centroids from updated articles
  const clusterIds = clusters.map((c) => c.id);
  const uncomputableIds = await recomputeClusterCentroids(clusterIds);
  logger.info(
    `[MIGRATION] Recomputed centroids for ${clusterIds.length - uncomputableIds.length} clusters`
  );

  // For clusters without valid member article embeddings, embed directly from headline + summary
  if (uncomputableIds.length > 0) {
    logger.info(
      `[MIGRATION] Directly embedding ${uncomputableIds.length} clusters without article embeddings...`
    );
    const clusterMap = new Map(clusters.map((c) => [c.id, c]));
    const fallbackItems: Array<{ id: string; text: string }> = [];

    for (const id of uncomputableIds) {
      const c = clusterMap.get(id);
      if (c) {
        const text = `${c.headline || ''}\n\n${c.summary || ''}`.trim();
        if (text) {
          fallbackItems.push({ id: c.id, text: text.slice(0, MAX_EMBEDDING_CHARS) });
        }
      }
    }

    for (let i = 0; i < fallbackItems.length; i += BATCH_SIZE) {
      const chunk = fallbackItems.slice(i, i + BATCH_SIZE);
      const vectors = await generateEmbeddingsBatch(chunk.map((item) => item.text));
      const updates = chunk.map((item, idx) => ({
        id: item.id,
        embedding: vectors[idx],
      }));
      await updateClusterEmbeddingsBatch(updates);
    }
  }

  // Step 6: Verify normalization
  logger.info('[MIGRATION] Verifying database normalization...');
  const remainingArticles = await getArticlesNeedingMigration(referenceGeminiVector);
  const remainingClusters = await getClustersNeedingMigration(referenceGeminiVector);

  logger.info(
    `[MIGRATION] Verification results: ${remainingArticles.length} legacy articles remaining, ${remainingClusters.length} legacy clusters remaining`
  );

  if (remainingArticles.length > 0 || remainingClusters.length > 0) {
    logger.warn('[MIGRATION] Some items were not normalized.');
  } else {
    logger.info('[MIGRATION] Success! All legacy vectors normalized to gemini-embedding-2');
  }

  // Step 7: Re-score clusters across database with tuned half-life
  logger.info('[MIGRATION] Re-scoring clusters with 24h half-life...');
  await scoreClusters();
  logger.info('[MIGRATION] Cluster scoring complete');

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  logger.info(`[MIGRATION] Migration finished in ${elapsedSeconds}s`);
}

runMigration()
  .then(() => {
    logger.info('[MIGRATION] Done.');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('[MIGRATION] Fatal error during migration:', err);
    process.exit(1);
  });
