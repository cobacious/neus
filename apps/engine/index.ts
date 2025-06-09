// runPipeline.ts
import { runPipeline } from './core/pipeline/pipeline';
import { logger } from './lib/pipelineLogger';

runPipeline()
  .then(() => {
    logger.info('Pipeline completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Pipeline failed:', err);
    process.exit(1);
  });
