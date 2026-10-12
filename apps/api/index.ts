import 'dotenv/config';
import { createServer } from 'node:http';
import { createYoga, Plugin } from 'graphql-yoga';
import { GraphQLError, getOperationAST } from 'graphql';
import { schema } from './schema';

const API_KEY = process.env.API_KEY;

const authPlugin: Plugin = {
  onExecute({ args }) {
    const operationAST = getOperationAST(args.document, args.operationName);

    if (operationAST && operationAST.operation === 'mutation') {
      if (!API_KEY) {
        throw new GraphQLError('Server configuration error: API_KEY is not set.', {
          extensions: {
            code: 'INTERNAL_SERVER_ERROR',
            http: { status: 500 }
          }
        });
      }

      const request = (args.contextValue as any).request;
      const authHeader = request?.headers?.get('authorization') || request?.headers?.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');

      if (token !== API_KEY) {
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

const yoga = createYoga({
  schema,
  plugins: [authPlugin]
});

const server = createServer(yoga);

const port = parseInt(process.env.PORT || '4000', 10);

server.listen(port, () => {
  console.log(`GraphQL server running at http://localhost:${port}/graphql`);
});
