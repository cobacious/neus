import dotenv from 'dotenv';
import path from 'path';

// Load .env from engine directory and current working directory
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { logger } from './lib/pipelineLogger';

logger.info('Node env', process.env.NODE_ENV);
logger.info('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'set' : 'unset');
logger.info('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'set' : 'unset');
if (process.env.TOKEN_LIMIT) {
  logger.info(`TOKEN_LIMIT: ${process.env.TOKEN_LIMIT}`);
}
