import { registerServiceWorker } from './pwa';

describe('pwa service worker module', () => {
  it('safely handles non-browser environments without throwing', () => {
    expect(() => registerServiceWorker()).not.toThrow();
  });
});
