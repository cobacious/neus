import { GraphQLError, parse } from 'graphql';
import { authPlugin } from './index';

describe('authPlugin', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv, API_KEY: 'testkey' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should not throw if the operation is a query', () => {
    const document = parse('query { __schema { types { name } } }');
    const args: any = { document, operationName: null, contextValue: { request: { headers: new Map() } } };

    expect(() => {
      // @ts-ignore
      authPlugin.onExecute({ args });
    }).not.toThrow();
  });

  it('should throw an error if no authorization header is provided for a mutation', () => {
    const document = parse('mutation { createSource(name: "test", rssFeedUrl: "http://test.com") { id } }');
    const args: any = { document, operationName: null, contextValue: { request: { headers: new Map() } } };

    expect(() => {
      // @ts-ignore
      authPlugin.onExecute({ args });
    }).toThrow(new GraphQLError('Unauthorized: Invalid or missing API Key for mutation.'));
  });

  it('should not throw an error if a valid authorization header is provided for a mutation', () => {
    const document = parse('mutation { createSource(name: "test", rssFeedUrl: "http://test.com") { id } }');
    const headers = new Map();
    headers.set('authorization', 'Bearer testkey');
    const args: any = { document, operationName: null, contextValue: { request: { headers } } };

    expect(() => {
      // @ts-ignore
      authPlugin.onExecute({ args });
    }).not.toThrow();
  });
});
