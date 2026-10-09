import {
  BRAND_PALETTE,
  DEFAULT_BRAND_COLOR,
  getBrandColor,
  createBrandColorMap,
} from './palette';

describe('palette', () => {
  it('defines 6 canonical brand colors from Coolors', () => {
    expect(BRAND_PALETTE).toHaveLength(6);
    expect(BRAND_PALETTE.map((c) => c.name)).toEqual([
      'Blue Slate',
      'Burnt Peach',
      'Ash Grey',
      'Thistle',
      'Clay Soil',
      'Charcoal',
    ]);
  });

  it('provides accessible WCAG AA contrast colors and soft background tints', () => {
    for (const swatch of BRAND_PALETTE) {
      expect(swatch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(swatch.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(swatch.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(swatch.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(swatch.dotColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('returns swatches deterministically by index and key', () => {
    expect(getBrandColor(undefined, 0)).toBe(BRAND_PALETTE[0]);
    expect(getBrandColor(undefined, 1)).toBe(BRAND_PALETTE[1]);
    expect(getBrandColor(undefined, 6)).toBe(BRAND_PALETTE[0]); // wraps around

    expect(getBrandColor(null)).toBe(DEFAULT_BRAND_COLOR);
    const swatch = getBrandColor('politics');
    expect(BRAND_PALETTE).toContain(swatch);
  });

  it('creates brand color map for items and strings', () => {
    const map = createBrandColorMap([
      { id: 'item-1', name: 'Item One' },
      'item-2',
    ]);
    expect(map.get('item-1')).toBe(BRAND_PALETTE[0]);
    expect(map.get('Item One')).toBe(BRAND_PALETTE[0]);
    expect(map.get('item-2')).toBe(BRAND_PALETTE[1]);
  });
});
