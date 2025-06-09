// summarizeClusters.ts
// For each cluster without a headline/summary, generate them using OpenAI and update the cluster
import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarizeClusters() {
  logPipelineStep(PipelineStep.Summarise, 'Summarizing clusters...');
  // Find clusters missing a headline or summary
  const clusters = await prisma.cluster.findMany({
    where: {
      OR: [
        { headline: { equals: null } },
        { summary: { equals: null } },
        { headline: { equals: '' } },
        { summary: { equals: '' } },
      ],
    },
    include: {
      articleAssignments: {
        include: { article: true },
      },
    },
  });

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
      `Summarising cluster ${cluster.id} with ${articles.length} articles`
    );
    // Compose a prompt from article titles and snippets
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
      const content = completion.choices[0].message.content;
      let headline: string | null = null;
      let summary: string | null = null;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          headline = parsed.headline;
          summary = parsed.summary;
        } catch (e) {
          // fallback: try to extract headline/summary from text
          const match = content.match(/"headline"\s*:\s*"([^"]+)"[\s,]+"summary"\s*:\s*"([^"]+)"/);
          if (match) {
            headline = match[1] || null;
            summary = match[2] || null;
          }
        }
      }
      if (headline && summary) {
        await prisma.cluster.update({
          where: { id: cluster.id },
          data: { headline, summary },
        });
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
  logPipelineSection(PipelineStep.Summarise, 'Summarisation step complete.');
}
