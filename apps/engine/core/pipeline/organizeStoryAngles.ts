import OpenAI from 'openai';
import { getActiveClustersForStories, syncStoryWithAngles } from '@neus/db';
import type { StoryInput } from '@neus/db';
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

function resolveGeminiModel(): string {
  const envModel = process.env.SUMMARY_MODEL;
  if (!envModel || envModel.includes('1.5') || envModel.includes('2.0') || envModel === 'gpt-4o-mini') {
    return 'gemini-flash-latest';
  }
  return envModel;
}

export type DiscoveredStoriesResponse = {
  stories: StoryInput[];
  standaloneClusterIds?: string[];
};

async function discoverStoriesWithGemini(
  apiKey: string,
  clusters: Array<{ id: string; headline: string | null; summary: string | null; date: string }>,
  maxRetries = 3
): Promise<DiscoveredStoriesResponse> {
  const modelName = resolveGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `
You are an expert news editor and taxonomist.

Here is a list of active news clusters from the past week:
${JSON.stringify(clusters, null, 2)}

TASK:
Analyze these clusters and identify if any of them are different angles, chronological developments, or sub-stories of the SAME overarching news saga (e.g. an evolving event, a developing investigation, or political fallout).

RULES:
1. Only group clusters into a "story" if they genuinely belong to the same overarching narrative or ongoing news event.
2. Each grouped story MUST contain 2 or more clusters.
3. For each grouped story, provide:
   - "storyTitle": A concise, neutral title representing the entire saga (e.g., "Christa Pike Botched Execution and Aftermath").
   - "status": One of "breaking" (first 24-48h), "evolving" (active developments over days), or "developing" (ongoing legal/political aftermath).
   - "overview": A neutral 2-sentence macro-summary synthesizing the whole saga across all its angles.
   - "angles": Array of member clusters, with:
     - "clusterId": The cluster id
     - "angle": A 2-5 word description of this cluster's specific angle/development (e.g., "Execution Attempt & Resignation", "Hospital Awakening", "Legal Fallout")
4. Clusters that are standalone, single-event stories with no sister clusters should be listed in "standaloneClusterIds".

Return JSON with this exact schema:
{
  "stories": [
    {
      "storyTitle": string,
      "status": "breaking" | "evolving" | "developing",
      "overview": string,
      "angles": [
        {
          "clusterId": string,
          "angle": string
        }
      ]
    }
  ],
  "standaloneClusterIds": string[]
}
`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are an objective news taxonomist. Return strict JSON only.' }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (res.status === 429) {
      const backoffMs = Math.pow(2, attempt) * 2500;
      logger.warn(
        `[${PipelineStep.Cluster}] Gemini rate limit (429) on attempt ${attempt}/${maxRetries}. Backing off for ${backoffMs / 1000}s...`
      );
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((r) => setTimeout(r, backoffMs));
      }
      continue;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini story grouping API error (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('Gemini story grouping response missing text');
    }

    return JSON.parse(content) as DiscoveredStoriesResponse;
  }

  throw new Error(`Exhausted ${maxRetries} retries for Gemini story grouping`);
}

async function discoverStoriesWithOpenAI(
  clusters: Array<{ id: string; headline: string | null; summary: string | null; date: string }>
): Promise<DiscoveredStoriesResponse> {
  const model = process.env.SUMMARY_MODEL || 'gpt-4o-mini';
  const prompt = `Analyze these clusters and group sister angles of the same overarching story into multi-angle stories:\n${JSON.stringify(clusters, null, 2)}`;

  const completion = await openai!.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are an objective news taxonomist. Return JSON with keys "stories" (array of {storyTitle, status, overview, angles: [{clusterId, angle}]}) and "standaloneClusterIds".',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 4096,
    temperature: 0.2,
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('OpenAI story grouping returned empty response');
  return JSON.parse(content) as DiscoveredStoriesResponse;
}

export async function organizeStoryAngles() {
  logPipelineStep(PipelineStep.Cluster, 'Organizing clusters into story angles & developing sagas...');

  const activeClusters = await getActiveClustersForStories(7);

  if (activeClusters.length < 2) {
    logPipelineSection(
      PipelineStep.Cluster,
      `Not enough active clusters to evaluate stories (${activeClusters.length} found). Skipping.`
    );
    return;
  }

  logPipelineSection(
    PipelineStep.Cluster,
    `Evaluating ${activeClusters.length} active clusters for multi-angle story connections`
  );

  const clustersForPrompt = activeClusters.map((c) => ({
    id: c.id,
    headline: c.headline,
    summary: c.summary,
    date: new Date(c.createdAt).toISOString().split('T')[0],
  }));

  let result: DiscoveredStoriesResponse;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    if (geminiKey) {
      result = await discoverStoriesWithGemini(geminiKey, clustersForPrompt);
    } else if (openai) {
      result = await discoverStoriesWithOpenAI(clustersForPrompt);
    } else {
      logger.warn(`[${PipelineStep.Cluster}] No Gemini or OpenAI API key available for story grouping.`);
      return;
    }
  } catch (err: any) {
    logger.error(`[${PipelineStep.Cluster}] Story grouping discovery failed: ${err.message || err}`);
    return;
  }

  const validClusterIds = new Set(activeClusters.map((c) => c.id));
  let storiesSynced = 0;

  for (const story of result.stories || []) {
    // Filter angles to only clusters that actually exist
    const validAngles = (story.angles || []).filter((a) => validClusterIds.has(a.clusterId));

    if (validAngles.length >= 2) {
      await syncStoryWithAngles({
        ...story,
        angles: validAngles,
      });
      storiesSynced++;
      logger.info(
        `[${PipelineStep.Cluster}] Grouped ${validAngles.length} angles under story: "${story.storyTitle}"`
      );
    }
  }

  logPipelineSection(
    PipelineStep.Cluster,
    `Story organization complete. ${storiesSynced} multi-angle stories synchronized.`
  );
}
