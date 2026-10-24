import { buildThreadFilterUrl } from './StoryThreadPills';

describe('StoryThreadPills buildThreadFilterUrl', () => {
  it('appends thread query param and articles hash to clean base URL', () => {
    expect(buildThreadFilterUrl('/ukraine-starlink', 'cluster-123')).toBe(
      '/ukraine-starlink?thread=cluster-123#articles-coverage'
    );
  });

  it('appends thread query param with ampersand and hash if query params already exist', () => {
    expect(buildThreadFilterUrl('/ukraine-starlink?src=feed', 'cluster-123')).toBe(
      '/ukraine-starlink?src=feed&thread=cluster-123#articles-coverage'
    );
  });

  it('safely encodes special characters in thread IDs', () => {
    expect(buildThreadFilterUrl('/story-slug', 'thread with spaces & symbols')).toBe(
      '/story-slug?thread=thread%20with%20spaces%20%26%20symbols#articles-coverage'
    );
  });
});
