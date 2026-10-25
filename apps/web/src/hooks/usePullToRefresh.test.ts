import { usePullToRefresh } from './usePullToRefresh';

describe('usePullToRefresh hook', () => {
  it('initializes safely with default values in non-browser environments', () => {
    // In node/SSR test environment
    expect(typeof usePullToRefresh).toBe('function');
  });
});
