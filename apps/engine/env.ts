// dotenv loader for Neus engine
// Loads .env file in this directory before running the rest of the pipeline
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

console.log(
  '[debug] env.ts loaded, OPENAI_API_KEY:',
  process.env.OPENAI_API_KEY ? 'set' : 'unset',
  'PROXY_ADDRESS:',
  process.env.PROXY_ADDRESS
);
