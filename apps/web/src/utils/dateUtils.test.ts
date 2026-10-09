import { parseDate, formatRelativeTime, formatDateHeader } from './dateUtils';

describe('dateUtils', () => {
  describe('parseDate', () => {
    it('handles null, undefined, empty string, and invalid inputs safely', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate('   ')).toBeNull();
      expect(parseDate('not-a-date')).toBeNull();
      expect(parseDate(NaN)).toBeNull();
      expect(parseDate(-100)).toBeNull();
    });

    it('parses ISO date strings', () => {
      const iso = '2026-10-08T14:30:00.000Z';
      const parsed = parseDate(iso);
      expect(parsed).not.toBeNull();
      expect(parsed?.toISOString()).toBe(iso);
    });

    it('parses numeric timestamps (ms)', () => {
      const ms = 1728469200000;
      const parsed = parseDate(ms);
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(ms);
    });

    it('parses numeric timestamps in string format', () => {
      const ms = 1728469200000;
      const parsed = parseDate('1728469200000');
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(ms);
    });

    it('parses Unix timestamps in seconds', () => {
      const sec = 1728469200;
      const parsed = parseDate(sec);
      expect(parsed).not.toBeNull();
      expect(parsed?.getTime()).toBe(sec * 1000);
    });

    it('preserves valid Date objects', () => {
      const d = new Date('2026-10-09T09:00:00.000Z');
      expect(parseDate(d)?.getTime()).toBe(d.getTime());
    });
  });

  describe('formatRelativeTime', () => {
    const now = new Date('2026-10-09T12:00:00.000Z').getTime();

    it('returns N/A for nullish or invalid values', () => {
      expect(formatRelativeTime(null)).toBe('N/A');
      expect(formatRelativeTime(undefined)).toBe('N/A');
      expect(formatRelativeTime('invalid')).toBe('N/A');
    });

    it('formats times under 1 minute as Just now', () => {
      expect(formatRelativeTime(now - 30000, now)).toBe('Just now');
      // Clock skew (slightly in future)
      expect(formatRelativeTime(now + 10000, now)).toBe('Just now');
    });

    it('formats minutes ago', () => {
      expect(formatRelativeTime(now - 5 * 60000, now)).toBe('5m ago');
      expect(formatRelativeTime(now - 59 * 60000, now)).toBe('59m ago');
    });

    it('formats hours ago', () => {
      expect(formatRelativeTime(now - 2 * 3600000, now)).toBe('2h ago');
      expect(formatRelativeTime(now - 23 * 3600000, now)).toBe('23h ago');
    });

    it('formats days ago', () => {
      expect(formatRelativeTime(now - 3 * 86400000, now)).toBe('3d ago');
      expect(formatRelativeTime(now - 6 * 86400000, now)).toBe('6d ago');
    });

    it('formats older dates with month and day', () => {
      const oldDate = new Date('2026-09-01T12:00:00.000Z');
      const res = formatRelativeTime(oldDate, now);
      expect(res).toMatch(/Sep/);
    });

    it('formats ISO string dates without producing "Invalid Date"', () => {
      const iso = new Date(now - 2 * 3600000).toISOString();
      expect(formatRelativeTime(iso, now)).toBe('2h ago');
    });
  });

  describe('formatDateHeader', () => {
    it('returns Unknown Date for invalid inputs', () => {
      expect(formatDateHeader(null)).toBe('Unknown Date');
      expect(formatDateHeader('invalid')).toBe('Unknown Date');
    });

    it('formats date headers cleanly', () => {
      const d = '2026-10-08T12:00:00.000Z';
      const formatted = formatDateHeader(d);
      expect(formatted).toMatch(/Oct/);
      expect(formatted).not.toContain('Invalid');
    });
  });
});
