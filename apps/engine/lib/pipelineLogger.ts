// pipelineLogger.ts
// Centralized logger for pipeline steps with numbering and labels

import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  } : undefined,
});

let step = 1;

export function logPipelineStep(label: string) {
  logger.info('\n' + '='.repeat(80));
  logger.info(`[pipeline] ${step}. ${label}`);
  step++;
}

export function logPipelineSection(label: string) {
  logger.info('\n' + '='.repeat(80));
  logger.info(`[pipeline] ${label}`);
}

export function resetPipelineLogger() {
  step = 1;
}

export { logger };
