import { registerServiceWorker, isStandalonePwa } from './pwa';

describe('pwa service worker module', () => {
  it('safely handles non-browser environments without throwing', () => {
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('returns false in non-browser or non-standalone environments', () => {
    expect(isStandalonePwa()).toBe(false);
  });
});
