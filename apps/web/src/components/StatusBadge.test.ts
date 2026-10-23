import { resolveStoryStatus, STATUS_CONFIG } from './StatusBadge';

describe('STATUS_CONFIG', () => {
  it('maps breaking to Burnt Peach (#DD6E42) from agreed Coolors editorial palette', () => {
    expect(STATUS_CONFIG.breaking.topBorder).toBe('#DD6E42');
    expect(STATUS_CONFIG.breaking.badgeBorder).toBe('#DD6E42');
    expect(STATUS_CONFIG.breaking.text).toBe('#8C3411');
    expect(STATUS_CONFIG.breaking.dot).toBe('#DD6E42');
    expect(STATUS_CONFIG.breaking.bg).toBe('#FFFFFF');
    expect(STATUS_CONFIG.breaking.label).toBe('Breaking');
  });

  it('maps developing to Blue Slate (#4F6D7A) from agreed Coolors editorial palette', () => {
    expect(STATUS_CONFIG.developing.topBorder).toBe('#4F6D7A');
    expect(STATUS_CONFIG.developing.badgeBorder).toBe('#4F6D7A');
    expect(STATUS_CONFIG.developing.text).toBe('#223842');
    expect(STATUS_CONFIG.developing.dot).toBe('#4F6D7A');
    expect(STATUS_CONFIG.developing.bg).toBe('#FFFFFF');
    expect(STATUS_CONFIG.developing.label).toBe('Developing');
  });
});

describe('resolveStoryStatus', () => {
  const now = new Date('2026-10-09T12:00:00.000Z').getTime();

  it('drops dormant status completely (returns null)', () => {
    expect(resolveStoryStatus('dormant', undefined, now)).toBeNull();
    expect(resolveStoryStatus('Dormant', undefined, now)).toBeNull();
  });

  it('returns null for inactive stories (> 7 days without updates)', () => {
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    expect(
      resolveStoryStatus(
        'developing',
        { createdAt: eightDaysAgo, lastUpdatedAt: eightDaysAgo, isMultiThread: true },
        now
      )
    ).toBeNull();

    expect(
      resolveStoryStatus(
        'breaking',
        { createdAt: eightDaysAgo, lastUpdatedAt: eightDaysAgo, isMultiThread: false },
        now
      )
    ).toBeNull();
  });

  it('returns breaking for freshly created breaking stories (< 18h)', () => {
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    const oneHourAgo = now - 1 * 60 * 60 * 1000;

    // Single cluster
    expect(
      resolveStoryStatus(
        'breaking',
        { createdAt: twoHoursAgo, lastUpdatedAt: oneHourAgo, isMultiThread: false },
        now
      )
    ).toBe('breaking');

    // Multi-thread story
    expect(
      resolveStoryStatus(
        'breaking',
        { createdAt: twoHoursAgo, lastUpdatedAt: oneHourAgo, isMultiThread: true },
        now
      )
    ).toBe('breaking');
  });

  it('decays breaking multi-thread stories to developing after initial breaking window', () => {
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    // Multi-thread story decays to developing
    expect(
      resolveStoryStatus(
        'breaking',
        { createdAt: threeDaysAgo, lastUpdatedAt: twoHoursAgo, isMultiThread: true },
        now
      )
    ).toBe('developing');
  });

  it('decays breaking standalone clusters to null (no badge) after initial breaking window', () => {
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    // Standalone cluster drops to clean default (null)
    expect(
      resolveStoryStatus(
        'breaking',
        { createdAt: threeDaysAgo, lastUpdatedAt: twoHoursAgo, isMultiThread: false },
        now
      )
    ).toBeNull();
  });

  it('never assigns developing to a standalone single-cluster report', () => {
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    // Even if status string is 'developing', single clusters cannot be developing
    expect(
      resolveStoryStatus(
        'developing',
        { createdAt: oneDayAgo, lastUpdatedAt: now, isMultiThread: false },
        now
      )
    ).toBeNull();
  });

  it('assigns developing to active multi-thread stories', () => {
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    expect(
      resolveStoryStatus(
        'developing',
        { createdAt: twoDaysAgo, lastUpdatedAt: now, isMultiThread: true },
        now
      )
    ).toBe('developing');
  });

  it('returns clean default (null) for routine news and standalone clusters past breaking', () => {
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const oneHourAgo = now - 1 * 60 * 60 * 1000;

    // Routine standalone cluster past breaking window -> null
    expect(
      resolveStoryStatus(
        null,
        { createdAt: threeDaysAgo, lastUpdatedAt: oneHourAgo, isMultiThread: false },
        now
      )
    ).toBeNull();

    // Fresh standalone cluster (< 12h) -> breaking
    expect(
      resolveStoryStatus(
        null,
        { createdAt: now - 2 * 60 * 60 * 1000, lastUpdatedAt: now - 1 * 60 * 60 * 1000, isMultiThread: false },
        now
      )
    ).toBe('breaking');

    // Default with no metadata
    expect(resolveStoryStatus(null, undefined, now)).toBeNull();
  });
});
