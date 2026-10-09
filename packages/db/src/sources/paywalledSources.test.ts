import { isPaywalledSource } from './paywalledSources';

describe('isPaywalledSource', () => {
  it('returns true for known paywalled publication names', () => {
    expect(isPaywalledSource('The Times')).toBe(true);
    expect(isPaywalledSource('Financial Times')).toBe(true);
    expect(isPaywalledSource('The Telegraph')).toBe(true);
    expect(isPaywalledSource('The Economist')).toBe(true);
    expect(isPaywalledSource('Bloomberg')).toBe(true);
    expect(isPaywalledSource('Wall Street Journal')).toBe(true);
  });

  it('returns true for known paywalled domains and homepage URLs in source objects', () => {
    expect(isPaywalledSource({ name: 'The Times', domain: 'thetimes.com' })).toBe(true);
    expect(isPaywalledSource({ name: 'FT', homepageUrl: 'https://www.ft.com' })).toBe(true);
    expect(isPaywalledSource({ name: 'Telegraph', domain: 'telegraph.co.uk' })).toBe(true);
    expect(isPaywalledSource({ name: 'WSJ', homepageUrl: 'https://wsj.com' })).toBe(true);
  });

  it('returns true when paywalled property is explicitly set to true', () => {
    expect(isPaywalledSource({ name: 'Custom Outlet', paywalled: true })).toBe(true);
  });

  it('returns false for standard free-to-read sources', () => {
    expect(isPaywalledSource('BBC News')).toBe(false);
    expect(isPaywalledSource('The Guardian')).toBe(false);
    expect(isPaywalledSource('Sky News')).toBe(false);
    expect(isPaywalledSource('Daily Mail')).toBe(false);
    expect(isPaywalledSource({ name: 'The Guardian', domain: 'theguardian.com', paywalled: false })).toBe(false);
  });

  it('handles null and undefined gracefully', () => {
    expect(isPaywalledSource(null)).toBe(false);
    expect(isPaywalledSource(undefined)).toBe(false);
  });
});
