import {
  ANGLE_PALETTES,
  DEFAULT_ANGLE_COLOR,
  getAngleColor,
  createAngleColorMap,
} from './angleColors';

describe('angleColors', () => {
  it('defines the 6 agreed Coolors palette swatches with high-contrast text', () => {
    expect(ANGLE_PALETTES).toHaveLength(6);
    expect(ANGLE_PALETTES[0].color).toBe('#4F6D7A'); // Blue slate
    expect(ANGLE_PALETTES[1].color).toBe('#DD6E42'); // Burnt Peach
    expect(ANGLE_PALETTES[2].color).toBe('#B8C7B7'); // Ash Grey
    expect(ANGLE_PALETTES[3].color).toBe('#D2BFDE'); // Thistle
    expect(ANGLE_PALETTES[4].color).toBe('#805448'); // Clay Soil
    expect(ANGLE_PALETTES[5].color).toBe('#575353'); // Charcoal

    // Verify all have defined bg, border, and accessible text
    ANGLE_PALETTES.forEach((p) => {
      expect(p.bg).toBeDefined();
      expect(p.border).toBeDefined();
      expect(p.text).toBeDefined();
      expect(p.color).toBeDefined();
    });
  });

  it('assigns palette items sequentially by index', () => {
    expect(getAngleColor(null, 0).color).toBe('#4F6D7A');
    expect(getAngleColor(null, 1).color).toBe('#DD6E42');
    expect(getAngleColor(null, 2).color).toBe('#B8C7B7');
    expect(getAngleColor(null, 6).color).toBe('#4F6D7A'); // wraps around
  });

  it('assigns colors deterministically by string key when index is omitted', () => {
    const col1 = getAngleColor('Legal Challenges');
    const col2 = getAngleColor('Legal Challenges');
    expect(col1).toEqual(col2);
  });

  it('returns default angle color for null/undefined', () => {
    expect(getAngleColor(null)).toEqual(DEFAULT_ANGLE_COLOR);
    expect(getAngleColor(undefined)).toEqual(DEFAULT_ANGLE_COLOR);
  });

  it('builds an angle color map preserving order for a story', () => {
    const angles = [
      { id: 'angle-1', name: 'Legal Challenges' },
      { id: 'angle-2', name: 'Corrections Chief Resignation' },
      { id: 'angle-3', name: 'Hospital Recovery' },
    ];
    const map = createAngleColorMap(angles);
    expect(map.get('angle-1')?.color).toBe('#4F6D7A');
    expect(map.get('Legal Challenges')?.color).toBe('#4F6D7A');
    expect(map.get('angle-2')?.color).toBe('#DD6E42');
    expect(map.get('Corrections Chief Resignation')?.color).toBe('#DD6E42');
    expect(map.get('angle-3')?.color).toBe('#B8C7B7');
    expect(map.get('Hospital Recovery')?.color).toBe('#B8C7B7');
  });
});
