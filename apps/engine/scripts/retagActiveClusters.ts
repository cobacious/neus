import '../env';
import {
  getRankedClusters,
  updateClusterTags,
  getStories,
  updateStoryTags,
} from '@neus/db';
import { classifyClusterTags } from '../lib/typesafeClient';
import { logger, PipelineStep } from '../lib/pipelineLogger';

async function runRetag() {
  const startedAt = Date.now();
  logger.info('[RETAG] Starting tag re-classification for top active clusters and stories...');

  if (!process.env.TYPESAFE_API_KEY) {
    logger.error('[RETAG] TYPESAFE_API_KEY is not configured in environment. Aborting.');
    process.exit(1);
  }

  // 1. Fetch active ranked clusters
  const clusters = await getRankedClusters(100);
  logger.info(`[RETAG] Processing ${clusters.length} active ranked cluster(s)...`);

  let updatedClusters = 0;
  for (const cluster of clusters) {
    if (!cluster.headline) continue;

    try {
      const newTags = await classifyClusterTags({
        headline: cluster.headline,
        summary: cluster.summary,
        step: PipelineStep.Summarise,
      });

      await updateClusterTags(cluster.id, newTags);
      updatedClusters++;
      logger.info(
        `[RETAG] Cluster: "${cluster.headline.slice(0, 45)}..." -> [${newTags.join(', ')}] (was: [${(cluster.tags || []).join(', ')}])`
      );
    } catch (err: any) {
      logger.error(`[RETAG] Failed re-tagging cluster ${cluster.id}: ${err.message || err}`);
    }
  }

  // 2. Re-pool active stories
  const activeStories = await getStories({ limit: 100 });
  logger.info(`[RETAG] Processing ${activeStories.length} active story(s)...`);

  let updatedStories = 0;
  for (const story of activeStories) {
    const tagFrequency = new Map<string, number>();

    for (const cluster of story.clusters) {
      if (Array.isArray(cluster.tags)) {
        for (const tag of cluster.tags) {
          tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
        }
      }
    }

    const pooledTags = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    await updateStoryTags(story.id, pooledTags);
    updatedStories++;
    logger.info(
      `[RETAG] Story: "${story.title.slice(0, 45)}..." -> [${pooledTags.join(', ')}] (was: [${(story.tags || []).join(', ')}])`
    );
  }

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.info(
    `[RETAG] Completed in ${durationSec}s: updated ${updatedClusters} cluster(s) and ${updatedStories} story(s).`
  );
}

runRetag()
  .catch((err) => {
    logger.error('[RETAG] Fatal error:', err);
    process.exit(1);
  });

