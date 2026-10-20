export interface PulseArticle {
  id: string;
  title: string;
  sourceId: string;
  publishedAt: Date;
  embedding?: number[] | null;
}

export interface PulseConfig {
  cooldownMinutes?: number; // default: 60
  batchArticleThreshold?: number; // default: 45
  heartbeatStalenessHours?: number; // default: 6
  surgeSourceThreshold?: number; // default: 3
  surgeWindowMinutes?: number; // default: 45
  surgeSimilarityThreshold?: number; // default: 0.88
}

export interface PulseTriggerInput {
  isRunInProgress: boolean;
  minutesSinceLastRun: number;
  unclusteredArticleCount: number;
  recentArticles: PulseArticle[];
  now?: number;
  config?: PulseConfig;
}

export type PulseTriggerReason =
  | 'run_in_progress'
  | 'cooldown_active'
  | 'breaking_surge'
  | 'batch_threshold'
  | 'heartbeat_staleness'
  | 'insufficient_activity';

export interface PulseSurgeCluster {
  uniqueSources: number;
  articleCount: number;
  titles: string[];
  sourceIds: string[];
  method: 'embedding' | 'lexical';
}

export interface PulseTriggerResult {
  shouldTrigger: boolean;
  reason: PulseTriggerReason;
  surgeCluster?: PulseSurgeCluster;
  metrics: {
    minutesSinceLastRun: number;
    unclusteredArticleCount: number;
    recentArticleCount: number;
  };
}

export function localCosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

const COMMON_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'after', 'over', 'into',
  'says', 'will', 'have', 'been', 'were', 'what', 'when', 'where', 'who', 'why',
  'how', 'out', 'about', 'more', 'year', 'years', 'time', 'first', 'new', 'just',
  'are', 'its', 'their', 'they', 'our', 'his', 'her', 'has', 'had', 'not', 'can',
  'all', 'one', 'two', 'news', 'live', 'amid', 'today', 'latest', 'could', 'would',
]);

/**
 * Extracts normalized significant keywords from a title for lexical surge comparison.
 */
export function extractKeywords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !COMMON_STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Finds connected components in an adjacency list.
 */
function findConnectedComponents(n: number, adj: Map<number, number[]>): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;

    const component: number[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const curr = queue.pop()!;
      component.push(curr);
      for (const neighbor of adj.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

export function findSurgeCluster(
  articles: PulseArticle[],
  surgeSourceThreshold: number,
  surgeSimilarityThreshold: number
): PulseSurgeCluster | undefined {
  // 1. Try vector embeddings first if at least surgeSourceThreshold articles have embeddings
  const embedded = articles.filter(
    (a) => Array.isArray(a.embedding) && a.embedding.length > 0
  );

  if (embedded.length >= surgeSourceThreshold) {
    const adj: Map<number, number[]> = new Map();
    for (let i = 0; i < embedded.length; i++) adj.set(i, []);

    for (let i = 0; i < embedded.length; i++) {
      const embA = embedded[i].embedding as number[];
      for (let j = i + 1; j < embedded.length; j++) {
        const embB = embedded[j].embedding as number[];
        const sim = localCosineSimilarity(embA, embB);
        if (sim >= surgeSimilarityThreshold) {
          adj.get(i)!.push(j);
          adj.get(j)!.push(i);
        }
      }
    }

    const components = findConnectedComponents(embedded.length, adj);
    let bestEmbeddingSurge: PulseSurgeCluster | undefined;

    for (const comp of components) {
      const compArticles = comp.map((idx) => embedded[idx]);
      const uniqueSources = new Set(compArticles.map((a) => a.sourceId));

      if (uniqueSources.size >= surgeSourceThreshold) {
        if (!bestEmbeddingSurge || uniqueSources.size > bestEmbeddingSurge.uniqueSources) {
          bestEmbeddingSurge = {
            uniqueSources: uniqueSources.size,
            articleCount: compArticles.length,
            titles: compArticles.map((a) => a.title),
            sourceIds: Array.from(uniqueSources),
            method: 'embedding',
          };
        }
      }
    }

    if (bestEmbeddingSurge) return bestEmbeddingSurge;
  }

  // 2. Lexical keyword overlap fallback for newly ingested articles lacking embeddings
  if (articles.length < surgeSourceThreshold) return undefined;

  const keywordsList = articles.map((a) => extractKeywords(a.title));
  const lexicalAdj: Map<number, number[]> = new Map();
  for (let i = 0; i < articles.length; i++) lexicalAdj.set(i, []);

  for (let i = 0; i < articles.length; i++) {
    const kwA = keywordsList[i];
    if (kwA.size < 2) continue;

    for (let j = i + 1; j < articles.length; j++) {
      const kwB = keywordsList[j];
      if (kwB.size < 2) continue;

      let sharedCount = 0;
      for (const word of kwA) {
        if (kwB.has(word)) sharedCount++;
      }

      // 3 or more shared keywords indicates high headline similarity on a breaking event
      if (sharedCount >= 3) {
        lexicalAdj.get(i)!.push(j);
        lexicalAdj.get(j)!.push(i);
      }
    }
  }

  const lexicalComponents = findConnectedComponents(articles.length, lexicalAdj);
  let bestLexicalSurge: PulseSurgeCluster | undefined;

  for (const comp of lexicalComponents) {
    const compArticles = comp.map((idx) => articles[idx]);
    const uniqueSources = new Set(compArticles.map((a) => a.sourceId));

    if (uniqueSources.size >= surgeSourceThreshold) {
      if (!bestLexicalSurge || uniqueSources.size > bestLexicalSurge.uniqueSources) {
        bestLexicalSurge = {
          uniqueSources: uniqueSources.size,
          articleCount: compArticles.length,
          titles: compArticles.map((a) => a.title),
          sourceIds: Array.from(uniqueSources),
          method: 'lexical',
        };
      }
    }
  }

  return bestLexicalSurge;
}

export function evaluatePulseTrigger(input: PulseTriggerInput): PulseTriggerResult {
  const {
    isRunInProgress,
    minutesSinceLastRun,
    unclusteredArticleCount,
    recentArticles,
    now = Date.now(),
    config = {},
  } = input;

  const cooldownMinutes = config.cooldownMinutes ?? 60;
  const batchArticleThreshold = config.batchArticleThreshold ?? 45;
  const heartbeatStalenessHours = config.heartbeatStalenessHours ?? 6;
  const surgeSourceThreshold = config.surgeSourceThreshold ?? 3;
  const surgeWindowMinutes = config.surgeWindowMinutes ?? 45;
  const surgeSimilarityThreshold = config.surgeSimilarityThreshold ?? 0.88;

  const metrics = {
    minutesSinceLastRun,
    unclusteredArticleCount,
    recentArticleCount: recentArticles.length,
  };

  // 1. Safety Guard: Never trigger concurrent pipeline runs
  if (isRunInProgress) {
    return { shouldTrigger: false, reason: 'run_in_progress', metrics };
  }

  // 2. Safety Guard: Enforce minimum cooldown period after previous run
  if (minutesSinceLastRun < cooldownMinutes) {
    return { shouldTrigger: false, reason: 'cooldown_active', metrics };
  }

  // 3. Emergency Surge Check: Detect multi-source breaking news events
  const surgeCutoffMs = now - surgeWindowMinutes * 60 * 1000;
  const surgeWindowArticles = recentArticles.filter(
    (a) => a.publishedAt.getTime() >= surgeCutoffMs
  );

  const surgeCluster = findSurgeCluster(
    surgeWindowArticles,
    surgeSourceThreshold,
    surgeSimilarityThreshold
  );

  if (surgeCluster) {
    return {
      shouldTrigger: true,
      reason: 'breaking_surge',
      surgeCluster,
      metrics,
    };
  }

  // 4. Batch Accumulation Trigger: Routine news volume threshold reached
  if (unclusteredArticleCount >= batchArticleThreshold) {
    return { shouldTrigger: true, reason: 'batch_threshold', metrics };
  }

  // 5. Heartbeat Staleness Guard: Maintenance run when too much time has elapsed
  if (minutesSinceLastRun >= heartbeatStalenessHours * 60) {
    return { shouldTrigger: true, reason: 'heartbeat_staleness', metrics };
  }

  // 6. Default: Quiet news cycle, wait for next pulse
  return { shouldTrigger: false, reason: 'insufficient_activity', metrics };
}
