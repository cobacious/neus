import React from 'react';
import ReactDOM from 'react-dom/client';
import { cacheExchange, createClient, fetchExchange, Provider } from 'urql';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';
import { registerServiceWorker } from './pwa';

registerServiceWorker();

// Resolve GraphQL endpoint, automatically matching LAN hostname when testing on mobile devices
const resolveApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    try {
      const parsed = new URL(envUrl, window.location.href);
      if (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        parsed.hostname = window.location.hostname;
        return parsed.toString();
      }
      return parsed.toString();
    } catch {
      return envUrl;
    }
  }
  return `http://${window.location.hostname || 'localhost'}:4000/graphql`;
};

const client = createClient({
  url: resolveApiUrl(),
  exchanges: [cacheExchange, fetchExchange],
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider value={client}>
      <App />
      <Analytics />
    </Provider>
  </React.StrictMode>
);
