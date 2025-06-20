// dotenv loader for Neus engine
// Loads .env file in this directory before running the rest of the pipeline
import 'dotenv/config';
import { logger } from './lib/pipelineLogger';

logger.info('Node env', process.env.NODE_ENV);
logger.info('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'set' : 'unset');
logger.info(`PROXY_ADDRESS: ${process.env.PROXY_ADDRESS}`);
if (process.env.TOKEN_LIMIT) {
  logger.info(`TOKEN_LIMIT: ${process.env.TOKEN_LIMIT}`);
}
