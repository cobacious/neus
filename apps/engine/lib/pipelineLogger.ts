// pipelineLogger.ts
// Centralized logger for pipeline steps with numbering and labels
import pino from 'pino';

export enum PipelineStep {
  Ingest = 'INGEST',
  Store = 'STORE',
  Fetch = 'FETCH',
  Embed = 'EMBED',
  Cluster = 'CLUSTER',
  Summarise = 'SUMMARISE',
  Score = 'SCORE',
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
});

let step = 1;

export function logPipelineStep(label: PipelineStep, message: string) {
  if (process.env.NODE_ENV === 'development') {
    logger.info('='.repeat(80));
  }
  logger.info(`[${label}] Step ${step}. ${message}`);
  if (process.env.NODE_ENV === 'development') {
    logger.info('-'.repeat(80));
  }
  step++;
}

export function logPipelineSection(label: PipelineStep, message: string, args?: any) {
  logger.info(`[${label}] ${message}`, ...(args ?? []));
}

export function resetPipelineLogger() {
  step = 1;
}

export { logger };
