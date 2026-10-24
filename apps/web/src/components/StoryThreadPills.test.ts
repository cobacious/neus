import { buildThreadFilterUrl } from './StoryThreadPills';

describe('StoryThreadPills buildThreadFilterUrl', () => {
  it('appends thread query param to clean base URL', () => {
    expect(buildThreadFilterUrl('/ukraine-starlink', 'cluster-123')).toBe(
      '/ukraine-starlink?thread=cluster-123'
    );
  });

  it('appends thread query param with ampersand if query params already exist', () => {
    expect(buildThreadFilterUrl('/ukraine-starlink?src=feed', 'cluster-123')).toBe(
      '/ukraine-starlink?src=feed&thread=cluster-123'
    );
  });

  it('safely encodes special characters in thread IDs', () => {
    expect(buildThreadFilterUrl('/story-slug', 'thread with spaces & symbols')).toBe(
      '/story-slug?thread=thread%20with%20spaces%20%26%20symbols'
    );
  });
});
