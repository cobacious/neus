import { isPaywalled } from './paywallUtils';

describe('isPaywalled', () => {
  it('detects paywalled UK publications by name', () => {
    expect(isPaywalled('The Times')).toBe(true);
    expect(isPaywalled('Financial Times')).toBe(true);
    expect(isPaywalled('The Telegraph')).toBe(true);
    expect(isPaywalled('The Economist')).toBe(true);
    expect(isPaywalled('Bloomberg')).toBe(true);
  });

  it('detects paywalled UK publications by source object', () => {
    expect(isPaywalled({ name: 'The Times', homepageUrl: 'https://www.thetimes.com' })).toBe(true);
    expect(isPaywalled({ name: 'FT', homepageUrl: 'https://www.ft.com' })).toBe(true);
    expect(isPaywalled({ name: 'Telegraph', domain: 'telegraph.co.uk' })).toBe(true);
    expect(isPaywalled({ name: 'Custom Outlet', paywalled: true })).toBe(true);
  });

  it('recognizes free publications as non-paywalled', () => {
    expect(isPaywalled('BBC News')).toBe(false);
    expect(isPaywalled('The Guardian')).toBe(false);
    expect(isPaywalled('Sky News')).toBe(false);
    expect(isPaywalled('Channel 4 News')).toBe(false);
    expect(isPaywalled('The Independent UK')).toBe(false);
    expect(isPaywalled('Daily Express')).toBe(false);
    expect(isPaywalled('The i Paper')).toBe(false);
    expect(isPaywalled('Metro UK')).toBe(false);
  });

  it('handles null and undefined gracefully', () => {
    expect(isPaywalled(null)).toBe(false);
    expect(isPaywalled(undefined)).toBe(false);
  });
});
