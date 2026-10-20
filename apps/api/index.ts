import 'dotenv/config';
import { createServer } from 'node:http';
import { createYoga, Plugin } from 'graphql-yoga';
import { useDisableIntrospection } from '@graphql-yoga/plugin-disable-introspection';
import { GraphQLError, getOperationAST } from 'graphql';
import { schema } from './schema';
import { handlePulseHttpRequest } from './pulse';

const isProd = process.env.NODE_ENV === 'production';

export const authPlugin: Plugin = {
  onExecute({ args }) {
    const operationAST = getOperationAST(args.document, args.operationName);

    if (operationAST && operationAST.operation === 'mutation') {
      // Must read from process.env at execution time to support tests changing env vars
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new GraphQLError('Server configuration error: API_KEY is not set.', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            http: { status: 500 }
          }
        });
      }

      const request = (args.contextValue as any).request;
      const authHeader = request?.headers?.get('authorization') || request?.headers?.get('Authorization');

      const match = authHeader?.match(/^Bearer\s+(.+)$/i);
      const token = match ? match[1].trim() : undefined;

      if (token !== apiKey) {
        throw new GraphQLError('Unauthorized: Invalid or missing API Key for mutation.', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 }
          }
        });
      }
    }
  }
};

const plugins: Plugin[] = [authPlugin];

// Disable introspection queries in production to prevent schema discovery
if (isProd) {
  plugins.push(useDisableIntrospection());
}

export const yoga = createYoga({
  schema,
  plugins,
});

export const requestListener = (req: any, res: any) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/pulse' || url.pathname === '/pulse') {
    return handlePulseHttpRequest(req, res);
  }
  return yoga(req, res);
};

if (process.env.NODE_ENV !== 'test') {
  const server = createServer(requestListener);
  const port = parseInt(process.env.PORT || '4000', 10);
  server.listen(port, () => {
    console.log(`API server running at http://localhost:${port} (GraphQL at /graphql, Pulse at /api/pulse)`);
  });
}
