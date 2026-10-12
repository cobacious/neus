import { getSourceInitial } from './SourceFavicon';

describe('SourceFavicon getSourceInitial', () => {
  it('extracts uppercase initial from source name', () => {
    expect(getSourceInitial('BBC News')).toBe('B');
    expect(getSourceInitial('The Guardian')).toBe('T');
    expect(getSourceInitial('financial times')).toBe('F');
    expect(getSourceInitial('reuters')).toBe('R');
  });

  it('handles leading whitespace', () => {
    expect(getSourceInitial('  Sky News')).toBe('S');
  });

  it('falls back to S for null, undefined, or empty names', () => {
    expect(getSourceInitial(null)).toBe('S');
    expect(getSourceInitial(undefined)).toBe('S');
    expect(getSourceInitial('')).toBe('S');
    expect(getSourceInitial('   ')).toBe('S');
  });
});
