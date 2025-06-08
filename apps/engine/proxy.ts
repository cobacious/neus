// proxy.ts is now unused. All proxy logic is handled in fetcher.ts.
// This file can be safely deleted.

// proxy.ts
// If PROXY_ADDRESS is set, patch global fetch to use https-proxy-agent for all requests (for debugging/proxying)

console.log('[debug] proxy.ts loaded, PROXY_ADDRESS:', process.env.PROXY_ADDRESS);
if (process.env.PROXY_ADDRESS) {
  (async () => {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const proxyAddress = process.env.PROXY_ADDRESS!;
    const proxyAgent = new HttpsProxyAgent(proxyAddress);
    // Patch global fetch (works for node-fetch consumers)
    (globalThis as any).fetch = (url: any, options?: any) => {
      console.log('[debug] Proxying fetch to:', url);
      return fetch(url, { ...(options || {}), agent: proxyAgent });
    };
    console.log(`[debug] Global fetch patched to use proxy: ${proxyAddress}`);
  })();
}
