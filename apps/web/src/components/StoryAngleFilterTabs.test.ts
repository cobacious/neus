import { resolveActiveAngleId } from './StoryAngleFilterTabs';

describe('StoryAngleFilterTabs resolveActiveAngleId', () => {
  const validClusterIds = ['cluster-1', 'cluster-2', 'cluster-3'];

  it('returns null when angleParam is missing or empty', () => {
    expect(resolveActiveAngleId(validClusterIds, null)).toBeNull();
    expect(resolveActiveAngleId(validClusterIds, undefined)).toBeNull();
    expect(resolveActiveAngleId(validClusterIds, '')).toBeNull();
  });

  it('returns the matched cluster ID when angleParam exists in valid IDs', () => {
    expect(resolveActiveAngleId(validClusterIds, 'cluster-2')).toBe('cluster-2');
  });

  it('returns null when angleParam does not exist in valid cluster IDs', () => {
    expect(resolveActiveAngleId(validClusterIds, 'unknown-cluster')).toBeNull();
  });

  it('supports Set of valid IDs directly', () => {
    const idSet = new Set(['cluster-a', 'cluster-b']);
    expect(resolveActiveAngleId(idSet, 'cluster-a')).toBe('cluster-a');
    expect(resolveActiveAngleId(idSet, 'cluster-c')).toBeNull();
  });
});
