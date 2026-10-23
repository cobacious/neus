import { logger, PipelineStep } from './pipelineLogger';
import { recordAiUsage } from './aiUsage';

const TYPESAFE_API_BASE_URL =
  process.env.TYPESAFE_API_BASE_URL || 'https://api.typesafe.ai';

export interface ChoiceQuestionDef {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | Record<string, any> | null>;
}

export interface NoulQuestionDef {
  type: 'noul';
  instructions: string;
  criteria?: {
    true?: string;
    false?: string;
  };
}

export interface ScoreQuestionDef {
  type: 'score';
  instructions: string;
  criteria: string[] | Record<string, string>;
}

export type SystemOneQuestionDef = ChoiceQuestionDef | NoulQuestionDef | ScoreQuestionDef;

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface NoulAnswer {
  type: 'noul';
  noul: number;
}

export interface ScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}

export type SystemOneAnswer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export interface SystemOneRequestPayload {
  model?: string;
  state: any;
  questions: Record<string, SystemOneQuestionDef>;
}

export interface SystemOneResponse {
  model: string;
  answers: Record<string, SystemOneAnswer>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface SystemOneCallOptions {
  step?: PipelineStep | string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Checks if a TypeSafe API key is available in the current environment.
 */
export function isTypeSafeActive(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

/**
 * Default System One model.
 */
export function resolveTypeSafeModel(): string {
  return process.env.TYPESAFE_MODEL || 'jev-latest';
}

/**
 * Calls TypeSafe's System One API with automatic timing, usage tracking and retries.
 */
export async function callSystemOne(
  request: SystemOneRequestPayload,
  options: SystemOneCallOptions = {}
): Promise<SystemOneResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is not configured');
  }

  const model = request.model || resolveTypeSafeModel();
  const step = options.step || PipelineStep.Organize;
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxRetries = options.retries ?? 2;

  const url = `${TYPESAFE_API_BASE_URL}/v1/systemone`;
  const body = JSON.stringify({
    model,
    state: request.state,
    questions: request.questions,
  });

  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Neus-Engine/1.0',
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const durationMs = Date.now() - attemptStart;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const isRetryable = response.status === 429 || response.status >= 500;

        if (isRetryable && attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
          logger.warn(
            `[${step}] TypeSafe API HTTP ${response.status} (${errorText.slice(0, 100)}). Retrying in ${backoffMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        recordAiUsage({
          step: String(step),
          provider: 'typesafe',
          model,
          operation: 'judge',
          durationMs,
          failed: true,
        });

        throw new Error(`TypeSafe API HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as SystemOneResponse;
      const totalDuration = Date.now() - startTime;

      recordAiUsage({
        step: String(step),
        provider: 'typesafe',
        model: data.model || model,
        operation: 'judge',
        durationMs: totalDuration,
        promptTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      });

      return data;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries && !err.name?.includes('Abort')) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      break;
    }
  }

  recordAiUsage({
    step: String(step),
    provider: 'typesafe',
    model,
    operation: 'judge',
    durationMs: Date.now() - startTime,
    failed: true,
  });

  throw lastError || new Error('TypeSafe API call failed');
}

export interface ArticleAngleCandidate {
  clusterId: string;
  angle: string;
  headline?: string | null;
  summary?: string | null;
}

export interface ArticleInputForAngle {
  id: string;
  title: string;
  snippet?: string | null;
  content?: string | null;
}

export interface ArticleAngleResult {
  targetClusterId: string | null;
  confidence: number;
  choice: string;
  probabilities: Record<string, number>;
}

/**
 * Classifies an article into one of several candidate story angles, or returns null if
 * it fits none of the angles or confidence is low.
 */
export async function classifyArticleAngleWithJev(params: {
  article: ArticleInputForAngle;
  angles: ArticleAngleCandidate[];
  storyTitle?: string;
  minConfidence?: number;
  step?: PipelineStep;
}): Promise<ArticleAngleResult> {
  const { article, angles, storyTitle, minConfidence = 0.45, step = PipelineStep.Organize } = params;

  if (angles.length === 0) {
    return {
      targetClusterId: null,
      confidence: 1.0,
      choice: 'none_of_the_above',
      probabilities: { none_of_the_above: 1.0 },
    };
  }

  // Construct angle options map
  const criteria: Record<string, string> = {};
  for (const a of angles) {
    const key = `angle_${a.clusterId}`;
    const descParts: string[] = [`Angle focus: ${a.angle}`];
    if (a.headline) descParts.push(`Headline: ${a.headline}`);
    if (a.summary) descParts.push(`Summary: ${a.summary}`);
    criteria[key] = descParts.join(' | ');
  }
  criteria['none_of_the_above'] =
    'Does not clearly belong to any of these angles; describes a separate event or topic';

  // Construct state with headline, snippet and leading 2,000 characters of body
  const leadBody = article.content ? article.content.trim().slice(0, 2000) : undefined;
  const state: Record<string, any> = {
    storyUmbrella: storyTitle || undefined,
    articleHeadline: article.title,
    articleSnippet: article.snippet || undefined,
    articleLeadText: leadBody || undefined,
  };

  const response = await callSystemOne(
    {
      state,
      questions: {
        angle: {
          type: 'choice',
          instructions:
            'Which specific story angle does this news article belong to? Select none_of_the_above if it describes a different event or topic.',
          criteria,
        },
      },
    },
    { step }
  );

  const answer = response.answers['angle'] as ChoiceAnswer;
  if (!answer || answer.type !== 'choice') {
    throw new Error('TypeSafe response did not contain expected choice answer');
  }

  let targetClusterId: string | null = null;
  if (answer.choice.startsWith('angle_') && answer.confidence >= minConfidence) {
    targetClusterId = answer.choice.replace('angle_', '');
  }

  return {
    targetClusterId,
    confidence: answer.confidence,
    choice: answer.choice,
    probabilities: answer.probabilities,
  };
}

/**
 * Classifies multiple ambiguous articles against candidate angles in parallel batches.
 */
export async function classifyArticleAnglesBatchWithJev(params: {
  articles: ArticleInputForAngle[];
  angles: ArticleAngleCandidate[];
  storyTitle?: string;
  concurrency?: number;
  minConfidence?: number;
  step?: PipelineStep;
}): Promise<Array<{ articleId: string; targetClusterId: string | null; confidence: number; choice: string }>> {
  const {
    articles,
    angles,
    storyTitle,
    concurrency = 5,
    minConfidence = 0.45,
    step = PipelineStep.Organize,
  } = params;

  const results: Array<{
    articleId: string;
    targetClusterId: string | null;
    confidence: number;
    choice: string;
  }> = [];

  for (let i = 0; i < articles.length; i += concurrency) {
    const chunk = articles.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (art) => {
      try {
        const res = await classifyArticleAngleWithJev({
          article: art,
          angles,
          storyTitle,
          minConfidence,
          step,
        });
        return {
          articleId: art.id,
          targetClusterId: res.targetClusterId,
          confidence: res.confidence,
          choice: res.choice,
        };
      } catch (err: any) {
        logger.warn(
          `[${step}] Jev angle classification failed for article "${art.id}": ${err.message}`
        );
        return {
          articleId: art.id,
          targetClusterId: null,
          confidence: 0,
          choice: 'error',
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Verifies if two clusters describe the exact same real-world event.
 */
export async function verifyDuplicateClustersWithJev(params: {
  clusterA: { title: string; summary?: string | null };
  clusterB: { title: string; summary?: string | null };
  step?: PipelineStep;
}): Promise<{ isDuplicate: boolean; probability: number }> {
  const { clusterA, clusterB, step = PipelineStep.Cluster } = params;

  const state = {
    storyA: {
      headline: clusterA.title,
      summary: clusterA.summary || undefined,
    },
    storyB: {
      headline: clusterB.title,
      summary: clusterB.summary || undefined,
    },
  };

  const response = await callSystemOne(
    {
      state,
      questions: {
        is_same_event: {
          type: 'noul',
          instructions:
            'Are these two news stories reporting on the exact same specific real-world event?',
          criteria: {
            true: 'Both stories report on the exact same specific incident or occurrence.',
            false:
              'The stories cover different events, even if they share broad keywords, locations or related themes.',
          },
        },
      },
    },
    { step }
  );

  const answer = response.answers['is_same_event'] as NoulAnswer;
  if (!answer || answer.type !== 'noul') {
    throw new Error('TypeSafe response did not contain expected noul answer');
  }

  return {
    isDuplicate: answer.noul >= 0.85,
    probability: answer.noul,
  };
}
