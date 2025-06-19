import 'dotenv/config';
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const yoga = createYoga({ schema });

const server = createServer(yoga);

const port = parseInt(process.env.PORT || '4000', 10);

server.listen(port, () => {
  console.log(`GraphQL server running at http://localhost:${port}/graphql`);
});
