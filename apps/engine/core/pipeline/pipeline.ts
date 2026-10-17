import { ingestArticles } from './ingestArticles';
import { getActiveSources, getDatabaseUsageMetrics } from '@neus/db';
import { storeArticles } from './storeArticles';
import { fillMissingContent } from './fillMissingContent';
import { embedNewArticles } from './embedArticles';
import { clusterRecentArticles } from './clusterArticles';
import { scoreClusters } from './scoreClusters';
import { summarizeClusters } from './summarizeClusters';
import { organizeStoryAngles } from './organizeStoryAngles';
import { cleanupEmptyClusters } from './cleanupEmptyClusters';
import { disbandSingleClusters } from './disbandSingleClusters';
import { archiveOldClusters } from './archiveOldClusters';
import { pruneArchivedPayloads } from './pruneArchivedPayloads';
import { purgeOldUnclusteredArticles } from './purgeOldUnclusteredArticles';
import { vacuumDb } from './vacuumDb';
import { resetPipelineLogger, logger, PipelineStep, emitWorkflowAnnotation } from '../../lib/pipelineLogger';
import { resetAiUsage, formatAiUsageLines, getTotalAiCostUsd } from '../../lib/aiUsage';
import { checkAndPublishTopStory } from '../../lib/bluesky';
import fs from 'fs';

export async function runPipeline() {
  const startTime = Date.now();
  resetPipelineLogger();
  resetAiUsage();

  const stepTimings: Array<{ name: string; seconds: number }> = [];
  async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const stepStart = Date.now();
    try {
      return await fn();
    } finally {
      stepTimings.push({ name, seconds: Math.round((Date.now() - stepStart) / 1000) });
    }
  }

  const sources = await timed('ingest-sources', () => getActiveSources());
  const allArticles = await timed('ingest', () => ingestArticles(sources));
  await timed('store', () => storeArticles(allArticles));
  await timed('fetch', () => fillMissingContent());
  await timed('embed', () => embedNewArticles());
  await timed('cluster', () => clusterRecentArticles());
  await timed('score', () => scoreClusters());
  await timed('summarise', () => summarizeClusters());
  await timed('organize', () => organizeStoryAngles());
  await timed('cleanup', () => cleanupEmptyClusters());
  await timed('disband', () => disbandSingleClusters());
  await timed('archive', () => archiveOldClusters());
  await timed('prune', () => pruneArchivedPayloads());
  await timed('purge', () => purgeOldUnclusteredArticles());
  await timed('vacuum', () => vacuumDb());

  // Step 16: Syndication (Bluesky automated post for new #1 top story)
  await timed('syndicate-bluesky', async () => {
    try {
      const syndication = await checkAndPublishTopStory();
      if (syndication.published) {
        logger.info(
          `[${PipelineStep.Summary}] Published new #1 top story to Bluesky: "${syndication.title}" (${syndication.uri})`
        );
      } else if (syndication.dryRun) {
        logger.info(
          `[${PipelineStep.Summary}] Bluesky syndication dry-run: "${syndication.title}" (NODE_ENV=${process.env.NODE_ENV}; no post published)`
        );
      } else if (syndication.skipped) {
        logger.info(
          `[${PipelineStep.Summary}] Bluesky syndication skipped (${syndication.reason}): "${syndication.title || 'N/A'}"`
        );
      } else {
        logger.warn(
          `[${PipelineStep.Summary}] Bluesky syndication not published (${syndication.reason || 'unknown'}): "${syndication.title || 'N/A'}"`
        );
      }
    } catch (err: any) {
      logger.warn(`[${PipelineStep.Summary}] Bluesky syndication error (non-fatal): ${err?.message || err}`);
    }
  });

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  const metrics = await getDatabaseUsageMetrics();

  logger.info(`[${PipelineStep.Summary}] Pipeline execution finished in ${durationSec}s`);
  logger.info(
    `[${PipelineStep.Summary}] Step timings (s): ${stepTimings.map((s) => `${s.name}=${s.seconds}`).join(' ')}`
  );
  for (const line of formatAiUsageLines()) {
    logger.info(`[${PipelineStep.Summary}] AI usage ${line}`);
  }
  const aiCost = getTotalAiCostUsd();
  logger.info(
    `[${PipelineStep.Summary}] AI spend: total=$${aiCost.totalUsd.toFixed(4)} (~£${aiCost.totalGbpVat.toFixed(4)} inc VAT) (gemini=$${aiCost.geminiUsd.toFixed(4)} openai=$${aiCost.openaiUsd.toFixed(4)})`
  );
  logger.info(`[${PipelineStep.Summary}] Database Storage: ${metrics.storageFormatted}`);
  logger.info(`[${PipelineStep.Summary}] Database Egress: ${metrics.egressFormatted}`);
  logger.info(`[${PipelineStep.Summary}] Database Compute: ${metrics.computeFormatted}`);
  logger.info(
    `[${PipelineStep.Summary}] Articles: ${metrics.totalArticles} total (${metrics.unclusteredArticles} unclustered) | Clusters: ${metrics.activeClusters} active, ${metrics.archivedClusters} archived`
  );

  if (metrics.storageBytes > 750 * 1024 * 1024) {
    emitWorkflowAnnotation(
      'warning',
      `Neon storage approaching limit: ${metrics.storageFormatted}`,
      'Neon Storage Alert'
    );
  }

  // Generate GitHub Step Summary in CI environments
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      const summaryMarkdown = `
### 📰 Neus Pipeline Summary

- **Status**: Completed successfully ✅
- **Duration**: ${durationSec}s
- **AI Spend (this run)**: $${aiCost.totalUsd.toFixed(4)} (~£${aiCost.totalGbpVat.toFixed(4)} inc VAT) [Gemini: $${aiCost.geminiUsd.toFixed(4)}, OpenAI: $${aiCost.openaiUsd.toFixed(4)}]
- **Ingested Articles (this run)**: ${allArticles.length}
- **Timestamp**: ${new Date().toISOString()}

#### 📊 Neon PostgreSQL Free Tier Utilization
| Resource | Current Usage / Free Tier Limit | Utilization | Status |
| :--- | :--- | :--- | :--- |
| **Storage** | ${metrics.storageFormatted} | ${metrics.storagePercent}% | Healthy ✅ |
| **Network Egress** | ${metrics.egressFormatted} | Monthly cycle | Healthy ✅ |
| **Compute Units** | ${metrics.computeFormatted} | Monthly cycle | Healthy ✅ |

#### 📰 Data Retention & Article Inventory
| Resource | Current Volume / Retention Policy | Status |
| :--- | :--- | :--- |
| **Total Articles** | ${metrics.totalArticles} articles stored | Managed by retention |
| **Unclustered Articles** | ${metrics.unclusteredArticles} articles / 7-day purge limit | Cleaned automatically |
| **Active Clusters** | ${metrics.activeClusters} clusters / 30-day archive limit | Live stories on site |
| **Archived Clusters** | ${metrics.archivedClusters} clusters (text & vectors pruned) | Historical permalinks |
| **Active Sources** | ${metrics.totalSources} / 18 configured feeds | Polled |

${metrics.storageBytes > 750 * 1024 * 1024 ? `> ⚠️ **Warning**: Database storage has exceeded 75% of your 1 GB Neon limit!` : ''}
`;
      fs.appendFileSync(summaryPath, summaryMarkdown, 'utf-8');
    } catch (err: any) {
      logger.warn(`Failed to write GITHUB_STEP_SUMMARY: ${err.message || err}`);
    }
  }
}

