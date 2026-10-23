import { generateStructuredJson } from '../../../lib/aiClient';
import { PipelineStep } from '../../../lib/pipelineLogger';
import { CandidateStory } from './storyNeighborhoods';

export interface StoryCopyResult {
  storyTitle: string;
  status: 'breaking' | 'developing';
  overview: string;
  threads: Array<{
    clusterId: string;
    thread: string;
  }>;
}

/**
 * Synthesizes neutral, objective editorial copy for confirmed multi-thread story clusters.
 * Gemini makes zero taxonomy, merge or similarity decisions; its role is strictly editorial
 * presentation and copywriting.
 */
export async function synthesizeStoryCopy(
  clusters: Array<{
    id: string;
    headline: string | null;
    summary: string | null;
    date: string;
    articleCount?: number;
  }>,
  existingStory?: CandidateStory | null,
  step: PipelineStep = PipelineStep.Organize
): Promise<StoryCopyResult> {
  const prompt = `
You are an expert news copywriter and editor.

The following ${clusters.length} news clusters have been confirmed as distinct member threads of the exact same overarching news story:
${JSON.stringify(clusters, null, 2)}
${
  existingStory
    ? `\nPRE-EXISTING STORY IN DATABASE:\nTitle: "${existingStory.title}"\nOverview: "${existingStory.overview || ''}"\n`
    : ''
}
TASK:
Write the editorial presentation for this story:
1. "storyTitle": An objective, neutral overarching news headline synthesizing what happened across the story (must have an active verb describing the event or development, not an abstract topic label).
2. "overview": A neutral 2-sentence macro-summary synthesizing the entire saga across all member threads.
3. "status": One of "breaking" (first 12-24h of newly emerging news where details are still arriving) or "developing" (multi-thread saga actively expanding in scope with related spin-offs/fallout).
4. "threads": Array of member clusters with:
   - "clusterId": The cluster id
   - "thread": A 2-5 word description of this cluster's specific reporting thread (e.g. "Hospital Awakening", "Warden Resignation", "Legal Inquiry").

CRITICAL TITLING & OVERVIEW RULES:
- The "storyTitle" MUST read like a real, neutral news headline with an active verb describing the overarching event or development (e.g. "Clashes Erupt Across France Over Student Protests and Rising Living Costs", "Vatican Confirms Pope Leo Diagnosed with Lung Cancer Following Surgery").
- DO NOT format "storyTitle" as an abstract topic label, Wikipedia category or list of nouns ending in "... and Fallout", "...: Speeches, Debates and Reactions" or "...: Court Proceedings and Witness Testimony". It must read like a real, neutral news headline.
- NEVER narrow the "storyTitle" to a single minor sub-thread or individual pledge (e.g. DO NOT name a party conference story after one specific tax pledge like "Badenoch Pledges to Scrap Inheritance Tax"; instead write "Conservative Party Opens Annual Conference Amid Debates Over Economic Strategy and Leadership").
- The "overview" must synthesize the entire overarching saga or event across all member threads.

Return JSON with this exact schema:
{
  "storyTitle": string,
  "status": "breaking" | "developing",
  "overview": string,
  "threads": [
    {
      "clusterId": string,
      "thread": string
    }
  ]
}
`;

  return generateStructuredJson<StoryCopyResult>({
    prompt,
    systemInstruction:
      'You are an expert news copywriter. Write a neutral overarching headline, 2-sentence overview and distinct thread labels. Return strict JSON conforming to schema.',
    step,
    schema: {
      type: 'OBJECT',
      properties: {
        storyTitle: { type: 'STRING' },
        status: { type: 'STRING', enum: ['breaking', 'developing'] },
        overview: { type: 'STRING' },
        threads: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              clusterId: { type: 'STRING' },
              thread: { type: 'STRING' },
            },
            required: ['clusterId', 'thread'],
          },
        },
      },
      required: ['storyTitle', 'status', 'overview', 'threads'],
    },
  });
}
