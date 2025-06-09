// dotenv loader for Neus engine
// Loads .env file in this directory before running the rest of the pipeline
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './lib/pipelineLogger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

logger.info('env.ts loaded');
logger.info('Node env', process.env.NODE_ENV);
logger.info('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'set' : 'unset');
logger.info(`PROXY_ADDRESS: ${process.env.PROXY_ADDRESS}`);
