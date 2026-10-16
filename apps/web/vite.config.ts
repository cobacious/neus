import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function serverlessApiDevPlugin(): Plugin {
  return {
    name: 'serverless-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/feed.xml' || url === '/rss.xml') {
          try {
            const feedModule = await server.ssrLoadModule('/api/feed.ts');
            return await feedModule.default(req, res);
          } catch (e) {
            console.error('Dev RSS feed error:', e);
            return next(e);
          }
        }
        if (url === '/sitemap.xml') {
          try {
            const sitemapModule = await server.ssrLoadModule('/api/sitemap.ts');
            return await sitemapModule.default(req, res);
          } catch (e) {
            console.error('Dev sitemap error:', e);
            return next(e);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serverlessApiDevPlugin()],
});
