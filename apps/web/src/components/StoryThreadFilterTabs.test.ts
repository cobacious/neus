import { resolveActiveThreadId } from './StoryThreadFilterTabs';

describe('StoryThreadFilterTabs resolveActiveThreadId', () => {
  const validClusterIds = ['cluster-1', 'cluster-2', 'cluster-3'];

  it('returns null when threadParam is missing or empty', () => {
    expect(resolveActiveThreadId(validClusterIds, null)).toBeNull();
    expect(resolveActiveThreadId(validClusterIds, undefined)).toBeNull();
    expect(resolveActiveThreadId(validClusterIds, '')).toBeNull();
  });

  it('returns the matched cluster ID when threadParam exists in valid IDs', () => {
    expect(resolveActiveThreadId(validClusterIds, 'cluster-2')).toBe('cluster-2');
  });

  it('returns null when threadParam does not exist in valid cluster IDs', () => {
    expect(resolveActiveThreadId(validClusterIds, 'unknown-cluster')).toBeNull();
  });

  it('supports Set of valid IDs directly', () => {
    const idSet = new Set(['cluster-a', 'cluster-b']);
    expect(resolveActiveThreadId(idSet, 'cluster-a')).toBe('cluster-a');
    expect(resolveActiveThreadId(idSet, 'cluster-c')).toBeNull();
  });
});
