import OpenAI from 'openai';
import { getClustersToSummarize, updateClusterSummary } from '@neus/db';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';

const useGemini = !!process.env.GEMINI_API_KEY;

const openai = !useGemini
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    })
  : null;

function resolveGeminiSummaryModel(): string {
  const envModel = process.env.SUMMARY_MODEL;
  if (!envModel || envModel.includes('1.5') || envModel.includes('2.0') || envModel === 'gpt-4o-mini') {
    return 'gemini-flash-latest';
  }
  return envModel;
}

async function getGeminiSummaryWithRetry(
  apiKey: string,
  prompt: string,
  maxRetries = 3
): Promise<{ headline: string; summary: string }> {
  const modelName = resolveGeminiSummaryModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'You are a neutral news editor. Return JSON only with keys "headline" and "summary".' }],
          },
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (res.status === 429) {
        // Backoff: 5s on 1st retry, 10s on 2nd retry, 20s on 3rd retry
        const backoffMs = Math.pow(2, attempt) * 2500;
        logger.warn(
          `[${PipelineStep.Summarise}] Gemini rate limit (429) on attempt ${attempt}/${maxRetries}. Waiting ${backoffMs / 1000}s for rate limit window to reset...`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini summary API error (${res.status}): ${errorText}`);
      }

      const data = (await res.json()) as any;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('Gemini summary response missing text');
      }

      const parsed = JSON.parse(content);
      if (!parsed.headline || !parsed.summary) {
        throw new Error('Gemini summary missing headline or summary field');
      }
      return { headline: parsed.headline, summary: parsed.summary };
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  throw new Error('Exhausted all retries for Gemini summary');
}

async function getOpenAISummary(prompt: string): Promise<{ headline: string; summary: string }> {
  const model = process.env.SUMMARY_MODEL || 'gpt-4o-mini';
  const completion = await openai!.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a helpful news editor.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 256,
    temperature: 0.4,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error('OpenAI summary response missing content');
  }

  const parsed = JSON.parse(content);
  if (!parsed.headline || !parsed.summary) {
    throw new Error('OpenAI summary missing headline or summary field');
  }
  return { headline: parsed.headline, summary: parsed.summary };
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

  const provider = useGemini
    ? `gemini (${resolveGeminiSummaryModel()})`
    : `openai (${process.env.SUMMARY_MODEL || 'gpt-4o-mini'})`;
  logPipelineSection(PipelineStep.Summarise, `Using ${provider} for summaries (processing ${clustersToSummarize.length} clusters)`);

  const geminiKey = process.env.GEMINI_API_KEY;

  for (const cluster of clustersToSummarize) {
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
      let result: { headline: string; summary: string };
      if (useGemini && geminiKey) {
        result = await getGeminiSummaryWithRetry(geminiKey, prompt);
      } else {
        result = await getOpenAISummary(prompt);
      }

      await updateClusterSummary(cluster.id, result.headline, result.summary);
      logPipelineSection(PipelineStep.Summarise, `Updated cluster ${cluster.id}`);
    } catch (err: any) {
      logger.error(
        `[${PipelineStep.Summarise}]: ${useGemini ? 'Gemini' : 'OpenAI'} error for cluster ${cluster.id}:`,
        err.message || err
      );
    }

    // Pace requests with a 1-second delay to respect Gemini RPM rate limits
    if (useGemini) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  logPipelineSection(PipelineStep.Summarise, 'Summarisation step complete.');
}
