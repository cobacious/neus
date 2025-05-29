// fetcher.ts
// A universal fetch wrapper for Node.js that supports optional proxying via https-proxy-agent if PROXY_ADDRESS is set.
// Always use this for HTTP(S) requests in the backend engine.

import nodeFetch, { RequestInit, Response } from 'node-fetch';

let agent: any = undefined;
if (process.env.PROXY_ADDRESS) {
  // Dynamically import https-proxy-agent only if needed
  const { HttpsProxyAgent } = await import('https-proxy-agent');
  agent = new HttpsProxyAgent(process.env.PROXY_ADDRESS);
  // Optionally log for debugging
  console.log(`[fetcher] Using proxy agent: ${process.env.PROXY_ADDRESS}`);
}

export async function fetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const opts = agent ? { ...options, agent } : options;
  return nodeFetch(url, opts);
}
