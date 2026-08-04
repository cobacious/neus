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

async function getGeminiSummary(apiKey: string, prompt: string): Promise<{ headline: string; summary: string }> {
  const modelName = process.env.SUMMARY_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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

  const provider = useGemini
    ? `gemini (${process.env.SUMMARY_MODEL || 'gemini-flash-latest'})`
    : `openai (${process.env.SUMMARY_MODEL || 'gpt-4o-mini'})`;
  logPipelineSection(PipelineStep.Summarise, `Using ${provider} for summaries`);

  const geminiKey = process.env.GEMINI_API_KEY;

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
      let result: { headline: string; summary: string };
      if (useGemini && geminiKey) {
        result = await getGeminiSummary(geminiKey, prompt);
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
  }

  logPipelineSection(PipelineStep.Summarise, 'Summarisation step complete.');
}
