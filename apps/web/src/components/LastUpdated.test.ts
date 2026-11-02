import {
  formatLastUpdated,
  PIPELINE_STATUS_QUERY,
} from './LastUpdated';

describe('LastUpdated formatLastUpdated', () => {
  const now = 1793618400000;

  it('formats minutes ago', () => {
    const eighteenMinutesAgo = now - 18 * 60 * 1000;
    expect(formatLastUpdated(eighteenMinutesAgo, now)).toBe('Updated 18m ago');

    const oneMinuteAgo = now - 1 * 60 * 1000;
    expect(formatLastUpdated(oneMinuteAgo, now)).toBe('Updated 1m ago');
  });

  it('formats hours ago', () => {
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    expect(formatLastUpdated(twoHoursAgo, now)).toBe('Updated 2h ago');
  });

  it('formats days ago', () => {
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    expect(formatLastUpdated(threeDaysAgo, now)).toBe('Updated 3d ago');
  });

  it('formats timestamps under 60 seconds as Updated just now', () => {
    const thirtySecondsAgo = now - 30 * 1000;
    expect(formatLastUpdated(thirtySecondsAgo, now)).toBe('Updated just now');

    // Future due to slight clock skew
    const slightFuture = now + 5 * 1000;
    expect(formatLastUpdated(slightFuture, now)).toBe('Updated just now');
  });

  it('returns null for null, undefined or invalid dates', () => {
    expect(formatLastUpdated(null, now)).toBeNull();
    expect(formatLastUpdated(undefined, now)).toBeNull();
    expect(formatLastUpdated('invalid-date', now)).toBeNull();
    expect(formatLastUpdated(NaN, now)).toBeNull();
  });

  it('includes PIPELINE_STATUS_QUERY with pipelineStatus, lastRunAt and lastRunIso', () => {
    expect(PIPELINE_STATUS_QUERY).toContain('pipelineStatus');
    expect(PIPELINE_STATUS_QUERY).toContain('lastRunAt');
    expect(PIPELINE_STATUS_QUERY).toContain('lastRunIso');
  });
});
