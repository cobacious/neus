import { getClustersToSummarize, updateClusterSummary, ensureClusterStory } from '@neus/db';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';
import { generateStructuredJson } from '../../lib/aiClient';
import { mapConcurrent } from './utils';

export async function generateClusterSummary(prompt: string): Promise<{ headline: string; summary: string }> {
  return generateStructuredJson<{ headline: string; summary: string }>({
    prompt,
    systemInstruction: 'You are a neutral news editor. Return JSON only with keys "headline" and "summary".',
    step: PipelineStep.Summarise,
    temperature: 0.4,
    maxTokens: 1024,
    schema: {
      type: 'OBJECT',
      properties: {
        headline: { type: 'STRING' },
        summary: { type: 'STRING' },
      },
      required: ['headline', 'summary'],
    },
  });
}

export interface SummarizeClustersDependencies {
  generateClusterSummary?: (prompt: string) => Promise<{ headline: string; summary: string }>;
  getClustersToSummarize?: () => Promise<any[]>;
}

export async function summarizeClusters(
  deps: SummarizeClustersDependencies = {}
) {
  const generateSummaryFn = deps.generateClusterSummary ?? generateClusterSummary;
  logPipelineStep(PipelineStep.Summarise, 'Summarizing clusters...');

  const clusters = deps.getClustersToSummarize
    ? await deps.getClustersToSummarize()
    : await getClustersToSummarize();

  if (clusters.length === 0) {
    logPipelineSection(
      PipelineStep.Summarise,
      'No clusters found that need summarization. Skipping summarization step.'
    );
    return;
  }

  logPipelineSection(
    PipelineStep.Summarise,
    `Found ${clusters.length} cluster(s) needing summarization.`
  );

  await mapConcurrent(clusters, 5, async (cluster) => {
    const articles = cluster.articleAssignments
      .map((a) => a.article)
      .filter((a): a is NonNullable<typeof a> => Boolean(a));

    if (articles.length === 0) {
      logger.warn(
        `[${PipelineStep.Summarise}]: Cluster ${cluster.id} has no valid articles. Skipping.`
      );
      return;
    }

    logPipelineSection(
      PipelineStep.Summarise,
      `Summarising cluster ${cluster.id} with ${articles.length} article(s)`
    );

    const prompt = `Given the following news articles, generate a neutral, concise headline and a 2-3 sentence summary that best represents the group.\n\nArticles:\n${articles
      .map((a) => `- ${a.title}${a.snippet ? `: ${a.snippet}` : ''}`)
      .join('\n')}\n\nRespond in JSON with keys 'headline' and 'summary'.`;

    try {
      const result = await generateSummaryFn(prompt);
      await updateClusterSummary(cluster.id, result.headline, result.summary);
      try {
        await ensureClusterStory(cluster.id, result.headline, result.summary);
      } catch (storyErr: any) {
        logger.warn(
          `[${PipelineStep.Summarise}]: Failed ensuring story for cluster ${cluster.id}: ${storyErr.message || storyErr}`
        );
      }
      logPipelineSection(PipelineStep.Summarise, `Updated cluster ${cluster.id}`);
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Summarise}]: Error summarizing cluster ${cluster.id}:`,
        err.message || err
      );
    }
  });

  logPipelineSection(PipelineStep.Summarise, 'Summarisation step complete.');
}
