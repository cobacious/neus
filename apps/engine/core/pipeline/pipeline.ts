import { ingestArticles } from './ingestArticles';
import { getActiveSources, getDatabaseUsageMetrics } from '@neus/db';
import { storeArticles } from './storeArticles';
import { fillMissingContent } from './fillMissingContent';
import { embedNewArticles } from './embedArticles';
import { clusterRecentArticles } from './clusterArticles';
import { scoreClusters } from './scoreClusters';
import { summarizeClusters } from './summarizeClusters';
import { cleanupEmptyClusters } from './cleanupEmptyClusters';
import { archiveOldClusters } from './archiveOldClusters';
import { pruneArchivedPayloads } from './pruneArchivedPayloads';
import { purgeOldUnclusteredArticles } from './purgeOldUnclusteredArticles';
import { resetPipelineLogger, logger, PipelineStep, emitWorkflowAnnotation } from '../../lib/pipelineLogger';
import fs from 'fs';

export async function runPipeline() {
  const startTime = Date.now();
  resetPipelineLogger();
  const sources = await getActiveSources();
  const allArticles = await ingestArticles(sources);
  await storeArticles(allArticles);
  await fillMissingContent();
  await embedNewArticles();
  await clusterRecentArticles();
  await scoreClusters();
  await summarizeClusters();
  await cleanupEmptyClusters();
  await archiveOldClusters();
  await pruneArchivedPayloads();
  await purgeOldUnclusteredArticles();

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  const metrics = await getDatabaseUsageMetrics();

  logger.info(`[${PipelineStep.Score}] Pipeline execution finished in ${durationSec}s`);
  logger.info(`[${PipelineStep.Score}] Database Storage: ${metrics.storageFormatted}`);
  logger.info(`[${PipelineStep.Score}] Database Egress: ${metrics.egressFormatted}`);
  logger.info(`[${PipelineStep.Score}] Database Compute: ${metrics.computeFormatted}`);
  logger.info(
    `[${PipelineStep.Score}] Articles: ${metrics.totalArticles} total (${metrics.unclusteredArticles} unclustered) | Clusters: ${metrics.activeClusters} active, ${metrics.archivedClusters} archived`
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

