// Re-export canonical pulse evaluation from @neus/db
export {
  evaluatePulseTrigger,
  findSurgeCluster,
  localCosineSimilarity,
  extractKeywords,
} from '@neus/db';
export type {
  PulseArticle,
  PulseConfig,
  PulseTriggerInput,
  PulseTriggerReason,
  PulseSurgeCluster,
  PulseTriggerResult,
} from '@neus/db';
