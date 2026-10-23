import { generateStructuredJson } from '../../../lib/aiClient';
import { PipelineStep } from '../../../lib/pipelineLogger';
import { CandidateStory } from './storyNeighborhoods';

export type NeighborhoodMerge = {
  targetClusterId: string;
  sourceClusterIds: string[];
};

export type NeighborhoodStory = {
  existingStoryId?: string | null;
  storyTitle: string;
  status: 'breaking' | 'developing';
  overview: string;
  threads: Array<{
    clusterId: string;
    thread: string;
  }>;
};

export type NeighborhoodEvaluation = {
  merges: NeighborhoodMerge[];
  stories?: NeighborhoodStory[];
  story?: NeighborhoodStory | null;
};

export async function evaluateStoryNeighborhood(
  clusters: Array<{
    id: string;
    headline: string | null;
    summary: string | null;
    date: string;
    articleCount?: number;
  }>,
  candidateStories?: CandidateStory[],
  step: PipelineStep = PipelineStep.Organize
): Promise<NeighborhoodEvaluation> {
  const prompt = `
You are an expert news editor and taxonomist.

Here is a candidate group of closely related news clusters identified by vector similarity:
${JSON.stringify(clusters, null, 2)}

TASK:
Analyze these clusters and determine:
1. MERGES (Duplicate Coverage): Are any of these clusters redundant duplicates covering the EXACT SAME event, announcement, or reporting thread without distinct new developments? (e.g. duplicate wire coverage of the same press release or incident).
   - If yes, specify which should be merged into which. The "targetClusterId" must be the more detailed cluster (or the one with more articles).
   - "sourceClusterIds" are the duplicate clusters that will be absorbed into target and deleted.
2. STORIES (Multi-thread saga): After accounting for any merges, do 2 or more distinct remaining clusters represent DIFFERENT REPORTING THREADS, chronological developments, or sub-stories of the SAME overarching news saga?
   - If yes, provide for each story:
     - "existingStoryId": If this saga matches or develops an EXISTING STORY listed in the CANDIDATE STORIES below, specify its id. Otherwise null.
     - "storyTitle": An objective, neutral overarching news headline synthesizing what happened across the saga.
     - "status": One of "breaking" (first 12-24h of newly emerging breaking news where details are still arriving) or "developing" (multi-thread saga actively expanding in scope with related spin-offs/fallout).
     - "overview": A neutral 2-sentence macro-summary synthesizing the whole saga across all its reporting threads.
     - "threads": Array of member clusters with:
       - "clusterId": The cluster id (must NOT be a merged source cluster)
       - "thread": A 2-5 word description of this cluster's specific reporting thread/development (e.g. "Hospital Awakening", "Warden Resignation", "Legal Inquiry").

EDITORIAL TAXONOMY GUIDELINES:
A multi-thread "Story" is an overarching news topic that brings together 2 or more distinct reporting threads, chronological chapters, or key facets of:
1. Narrative Sagas & Investigations: Unfolding events with direct consequences (e.g. an incident occurs -> hospital/investigative updates -> institutional fallout/resignation -> legal/judicial proceedings).
2. Major Scheduled Macro-Events: Significant calendar events with multiple major speeches, announcements, or debates (e.g. party conferences, bilateral summits, legislative budget sessions, tournaments).

CRITICAL TITLING & OVERVIEW RULES:
- The "storyTitle" MUST read like a real, neutral news headline with an active verb describing the overarching event or development (e.g. "Clashes Erupt Across France Over Student Protests and Rising Living Costs", "Vatican Confirms Pope Leo Diagnosed with Lung Cancer Following Surgery").
- DO NOT format "storyTitle" as an abstract topic label, Wikipedia category or list of nouns ending in "... and Fallout", "...: Speeches, Debates and Reactions" or "...: Court Proceedings and Witness Testimony". It must read like a real, neutral news headline.
- NEVER narrow the "storyTitle" to a single minor sub-thread or individual pledge (e.g. DO NOT name a party conference story after one specific tax pledge like "Badenoch Pledges to Scrap Inheritance Tax"; instead write "Conservative Party Opens Annual Conference Amid Debates Over Economic Strategy and Leadership").
- The "overview" must synthesize the entire overarching saga or event across all member threads.

FALSE POSITIVES TO KEEP STANDALONE (Return "stories": []):
Do NOT group clusters into a story merely because:
1. They share an entity or figure (e.g., an actor, CEO, or leader) but cover entirely unrelated actions or occurrences with no shared narrative or event thread.
2. They share a broad thematic beat (e.g., general healthcare news) with no shared event, initiative, or investigation connecting them.
3. If candidate clusters are unrelated standalone reports, return "stories": [].
${
  candidateStories && candidateStories.length > 0
    ? `\nCANDIDATE STORIES IN DATABASE (active or dormant sagas that may match this neighborhood):\n${JSON.stringify(
        candidateStories.map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          overview: s.overview,
        })),
        null,
        2
      )}\n`
    : ''
}
Format response strictly as JSON conforming to schema.
`;

  return generateStructuredJson<NeighborhoodEvaluation>({
    prompt,
    systemInstruction:
      'You are a rigorous, objective news editor grouping related coverage into coherent story threads. Return strict JSON conforming to schema.',
    step,
    schema: {
      type: 'OBJECT',
      properties: {
        merges: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              targetClusterId: { type: 'STRING' },
              sourceClusterIds: {
                type: 'ARRAY',
                items: { type: 'STRING' },
              },
            },
            required: ['targetClusterId', 'sourceClusterIds'],
          },
        },
        stories: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              existingStoryId: { type: 'STRING', nullable: true },
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
        },
      },
      required: ['merges', 'stories'],
    },
  });
}

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
