import OpenAI from 'openai';
import {
  getClustersToSummarize,
  updateClusterSummary,
} from '@neus/db';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TOKEN_CAP = 10000; // Adjust your token budget here
let totalTokensUsed = 0;

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

  for (const cluster of clusters) {
    const articles = cluster.articleAssignments.map((a) => a.article);
    if (articles.length === 0) continue;

    logPipelineSection(
      PipelineStep.Summarise,
      `Summarising cluster ${cluster.id} with ${articles.length} article(s)`
    );

    const prompt = `Given the following news articles, generate a neutral, concise headline and a 2-3 sentence summary that best represents the group.\n\nArticles:\n${articles
      .map((a) => `- ${a.title}${a.snippet ? `: ${a.snippet}` : ''}`)
      .join('\n')}\n\nRespond in JSON with keys 'headline' and 'summary'.`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful news editor.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 256,
        temperature: 0.4,
      });

      const usage = completion.usage?.total_tokens || 0;
      totalTokensUsed += usage;
      console.log(`Cluster ${cluster.id} used ${usage} tokens (total: ${totalTokensUsed})`);

      if (totalTokensUsed > TOKEN_CAP) {
        console.warn('Token cap reached. Aborting summarisation.');
        break;
      }

      const content = completion.choices[0].message.content;
      let headline: string | null = null;
      let summary: string | null = null;

      if (content) {
        try {
          const parsed = JSON.parse(content);
          headline = parsed.headline;
          summary = parsed.summary;
        } catch (e) {
          const match = content.match(/"headline"\s*:\s*"([^"]+)"[\s,]+"summary"\s*:\s*"([^"]+)"/);
          if (match) {
            headline = match[1] || null;
            summary = match[2] || null;
          }
        }
      }

      if (headline && summary) {
        await updateClusterSummary(cluster.id, headline, summary);
        logPipelineSection(PipelineStep.Summarise, `Updated cluster ${cluster.id}`);
      } else {
        logger.warn(
          `[${PipelineStep.Summarise}]: Failed to parse headline/summary for cluster ${cluster.id}`
        );
      }
    } catch (err) {
      logger.error(`[${PipelineStep.Summarise}]: OpenAI error for cluster ${cluster.id}:`, err);
    }
  }

  logPipelineSection(
    PipelineStep.Summarise,
    `Summarisation step complete. Total tokens used: ${totalTokensUsed}`
  );
}
