import '../env';
import {
  getClustersNeedingTags,
  updateClusterTags,
  getStoriesNeedingTags,
  updateStoryTags,
} from '@neus/db';
import { classifyClusterTags } from '../lib/typesafeClient';
import { logger, PipelineStep } from '../lib/pipelineLogger';

async function runBackfill() {
  const startedAt = Date.now();
  logger.info('[BACKFILL] Starting topic tag backfill for active clusters and stories...');

  if (!process.env.TYPESAFE_API_KEY) {
    logger.error('[BACKFILL] TYPESAFE_API_KEY is not configured in environment. Aborting.');
    process.exit(1);
  }

  // 1. Clusters
  const clusters = await getClustersNeedingTags(200);
  logger.info(`[BACKFILL] Found ${clusters.length} active cluster(s) needing tags`);

  let clusterCount = 0;
  for (const cluster of clusters) {
    if (!cluster.headline) continue;

    try {
      const tags = await classifyClusterTags({
        headline: cluster.headline,
        summary: cluster.summary,
        step: PipelineStep.Summarise,
      });

      if (tags.length > 0) {
        await updateClusterTags(cluster.id, tags);
        clusterCount++;
        logger.info(
          `[BACKFILL] Tagged cluster "${cluster.headline.slice(0, 50)}..." -> [${tags.join(', ')}]`
        );
      } else {
        logger.warn(
          `[BACKFILL] No tags classified for cluster "${cluster.headline.slice(0, 50)}..."`
        );
      }
    } catch (err: any) {
      logger.error(
        `[BACKFILL] Failed tagging cluster ${cluster.id}: ${err.message || err}`
      );
    }
  }

  // 2. Stories
  const stories = await getStoriesNeedingTags(100);
  logger.info(`[BACKFILL] Found ${stories.length} story(s) needing tags`);

  let storyCount = 0;
  for (const story of stories) {
    const tagFrequency = new Map<string, number>();

    for (const cluster of story.clusters) {
      for (const tag of cluster.tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      }
    }

    const pooledTags = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    if (pooledTags.length > 0) {
      await updateStoryTags(story.id, pooledTags);
      storyCount++;
      logger.info(
        `[BACKFILL] Tagged story "${story.title}" -> [${pooledTags.join(', ')}]`
      );
    }
  }

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.info(
    `[BACKFILL] Completed in ${durationSec}s: tagged ${clusterCount} cluster(s) and ${storyCount} story(s).`
  );
}

runBackfill()
  .catch((err) => {
    logger.error('[BACKFILL] Fatal error:', err);
    process.exit(1);
  });
