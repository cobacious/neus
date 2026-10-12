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

  const executeHook = (args: any) => {
    (authPlugin.onExecute as (payload: any) => void)({ args });
  };

  it('should not throw if the operation is a query', () => {
    const document = parse('query { __schema { types { name } } }');
    const args = {
      document,
      operationName: null,
      contextValue: { request: { headers: new Headers() } },
    };

    expect(() => executeHook(args)).not.toThrow();
  });

  it('should throw UNAUTHENTICATED if no authorization header is provided for a mutation', () => {
    const document = parse('mutation { createSource(name: "test", rssFeedUrl: "http://test.com") { id } }');
    const args = {
      document,
      operationName: null,
      contextValue: { request: { headers: new Headers() } },
    };

    expect(() => executeHook(args)).toThrow(
      new GraphQLError('Unauthorized: Invalid or missing API Key for mutation.')
    );
  });

  it('should throw UNAUTHENTICATED if an invalid authorization token is provided for a mutation', () => {
    const document = parse('mutation { createSource(name: "test", rssFeedUrl: "http://test.com") { id } }');
    const headers = new Headers();
    headers.set('authorization', 'Bearer wrongkey');
    const args = {
      document,
      operationName: null,
      contextValue: { request: { headers } },
    };

    expect(() => executeHook(args)).toThrow(
      new GraphQLError('Unauthorized: Invalid or missing API Key for mutation.')
    );
  });

  it('should throw UNAUTHENTICATED if authorization header is malformed', () => {
    const document = parse('mutation { createSource(name: "test", rssFeedUrl: "http://test.com") { id } }');
    const headers = new Headers();
    headers.set('authorization', 'Basic testkey');
    const args = {
      document,
      operationName: null,
      contextValue: { request: { headers } },
    };

    expect(() => executeHook(args)).toThrow(
      new GraphQLError('Unauthorized: Invalid or missing API Key for mutation.')
    );
  });

  it('should not throw if a valid authorization header is provided for a mutation (case-insensitive)', () => {
    const document = parse('mutation { createSource(name: "test", rssFeedUrl: "http://test.com") { id } }');
    const headers = new Headers();
    headers.set('authorization', 'bearer testkey');
    const args = {
      document,
      operationName: null,
      contextValue: { request: { headers } },
    };

    expect(() => executeHook(args)).not.toThrow();
  });

  it('should throw 500 error if API_KEY is not configured on the server', () => {
    delete process.env.API_KEY;
    const document = parse('mutation { createSource(name: "test", rssFeedUrl: "http://test.com") { id } }');
    const headers = new Headers();
    headers.set('authorization', 'Bearer testkey');
    const args = {
      document,
      operationName: null,
      contextValue: { request: { headers } },
    };

    expect(() => executeHook(args)).toThrow(
      new GraphQLError('Server configuration error: API_KEY is not set.')
    );
  });
});
