import './env';
import { runPipeline } from './core/pipeline/pipeline';
import { logger } from './lib/pipelineLogger';

process.on('uncaughtException', (err: any) => {
  // Guard against known Node 22 Undici HTTP parser socket close assertion bug
  if (
    err?.code === 'ERR_ASSERTION' &&
    (err?.stack?.includes('undici') || err?.message?.includes('false == true'))
  ) {
    logger.warn(`[PROCESS] Suppressed benign Undici socket assertion error: ${err.message || err}`);
    return;
  }
  logger.error('Pipeline uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Pipeline unhandled rejection:', reason);
  process.exit(1);
});

runPipeline()
  .then(() => {
    logger.info('Pipeline completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Pipeline failed:', err);
    process.exit(1);
  });
