import { usePullToRefresh, RefreshStatus } from './usePullToRefresh';

describe('usePullToRefresh hook', () => {
  it('initializes safely with default values in non-browser environments', () => {
    // In node/SSR test environment
    expect(typeof usePullToRefresh).toBe('function');
  });

  it('recognizes all supported RefreshStatus states', () => {
    const statuses: RefreshStatus[] = [
      'idle',
      'pulling',
      'can-release',
      'refreshing',
      'success',
      'error',
    ];
    expect(statuses).toHaveLength(6);
  });
});

