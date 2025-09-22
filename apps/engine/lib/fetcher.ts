import nodeFetch, { RequestInit, Response } from 'node-fetch';
import { logger } from './pipelineLogger';
import { HttpsProxyAgent } from 'https-proxy-agent';

let agent: any = undefined;

if (process.env.PROXY_ADDRESS) {
  console.log('[FETCHER] PROXY_ADDRESS detected:', process.env.PROXY_ADDRESS);

  // Trust self-signed certs inside the proxy agent
  agent = new HttpsProxyAgent(process.env.PROXY_ADDRESS);
  (agent as any).options.rejectUnauthorized = false; // ← override TLS rejection manually

  console.log('[FETCHER] Proxy agent created with rejectUnauthorized=false');
} else {
  console.log('[FETCHER] No PROXY_ADDRESS set');
}

export async function fetch(url: string, options: RequestInit = {}): Promise<Response> {
  console.log('[FETCHER] Requesting URL:', url);
  const opts = agent ? { ...options, agent } : options;

  try {
    return await nodeFetch(url, opts);
  } catch (error) {
    logger.error(`[FETCHER] Error fetching ${url}:`, error);
    throw error;
  }
}
