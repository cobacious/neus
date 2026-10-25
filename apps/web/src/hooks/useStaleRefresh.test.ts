import { useStaleRefresh } from './useStaleRefresh';

describe('useStaleRefresh hook', () => {
  it('exports a valid hook function', () => {
    expect(typeof useStaleRefresh).toBe('function');
  });
});
