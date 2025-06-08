// runPipeline.ts
import { runPipeline } from './pipeline';

runPipeline()
  .then(() => {
    console.log('[runPipeline] Pipeline completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[runPipeline] Pipeline failed:', err);
    process.exit(1);
  });
