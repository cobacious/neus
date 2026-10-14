import { getClustersToSummarize, updateClusterSummary } from '@neus/db';
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

export async function summarizeClusters() {
  logPipelineStep(PipelineStep.Summarise, 'Summarizing clusters...');

  const clusters = await getClustersToSummarize();

  if (clusters.length === 0) {
    logPipelineSection(
      PipelineStep.Summarise,
      'No clusters found that need summarization. Skipping summarization step.'
    );
    return;
  }

  const MAX_SUMMARIES_PER_RUN = process.env.MAX_SUMMARIES
    ? parseInt(process.env.MAX_SUMMARIES, 10)
    : 0;

  const clustersToSummarize =
    MAX_SUMMARIES_PER_RUN > 0 ? clusters.slice(0, MAX_SUMMARIES_PER_RUN) : clusters;

  logPipelineSection(
    PipelineStep.Summarise,
    `Summarizing ${clustersToSummarize.length} clusters`
  );

  const CONCURRENCY = process.env.SUMMARIZE_CONCURRENCY
    ? parseInt(process.env.SUMMARIZE_CONCURRENCY, 10)
    : 3;

  await mapConcurrent(clustersToSummarize, CONCURRENCY, async (cluster) => {
    const articles = cluster.articleAssignments.map((a) => a.article);
    if (articles.length === 0) return;

    logPipelineSection(
      PipelineStep.Summarise,
      `Summarising cluster ${cluster.id} with ${articles.length} article(s)`
    );

    const prompt = `Given the following news articles, generate a neutral, concise headline and a 2-3 sentence summary that best represents the group.\n\nArticles:\n${articles
      .map((a) => `- ${a.title}${a.snippet ? `: ${a.snippet}` : ''}`)
      .join('\n')}\n\nRespond in JSON with keys 'headline' and 'summary'.`;

    try {
      const result = await generateClusterSummary(prompt);
      await updateClusterSummary(cluster.id, result.headline, result.summary);
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
