// Scheduler for periodic article ingestion
// Runs every 4 hours using setInterval (for dev/local); use a real scheduler in production

import './env'; // Loads .env and proxy support
import { runPipeline } from './core/pipeline/pipeline';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

process.on('unhandledRejection', (reason, promise) => {
  console.error('[fatal] Unhandled Rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught Exception:', err);
  process.exit(1);
});

// Run immediately, then every 4 hours
(async () => {
  try {
    await runPipeline();
    console.log('[debug] Initial runPipeline() completed. Scheduler will now run every 4 hours.');
  } catch (err) {
    console.error('[fatal] Error in initial runPipeline:', err);
    process.exit(1);
  }
})();
setInterval(runPipeline, FOUR_HOURS_MS);

process.on('exit', (code) => {
  console.log(`[debug] Process exiting with code ${code}`);
});

// TODO: Replace setInterval with a production scheduler (e.g. cron, serverless cron, or cloud scheduler)
