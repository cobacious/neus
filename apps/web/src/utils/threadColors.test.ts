import {
  THREAD_PALETTES,
  DEFAULT_THREAD_COLOR,
  getThreadColor,
  createThreadColorMap,
} from './threadColors';

describe('threadColors', () => {
  it('defines the 6 agreed Coolors palette swatches with high-contrast text', () => {
    expect(THREAD_PALETTES).toHaveLength(6);
    expect(THREAD_PALETTES[0].color).toBe('#4F6D7A'); // Blue slate
    expect(THREAD_PALETTES[1].color).toBe('#DD6E42'); // Burnt Peach
    expect(THREAD_PALETTES[2].color).toBe('#B8C7B7'); // Ash Grey
    expect(THREAD_PALETTES[3].color).toBe('#D2BFDE'); // Thistle
    expect(THREAD_PALETTES[4].color).toBe('#805448'); // Clay Soil
    expect(THREAD_PALETTES[5].color).toBe('#575353'); // Charcoal

    // Verify all have defined bg, border and accessible text
    THREAD_PALETTES.forEach((p) => {
      expect(p.bg).toBeDefined();
      expect(p.border).toBeDefined();
      expect(p.text).toBeDefined();
      expect(p.color).toBeDefined();
    });
  });

  it('assigns palette items sequentially by index', () => {
    expect(getThreadColor(null, 0).color).toBe('#4F6D7A');
    expect(getThreadColor(null, 1).color).toBe('#DD6E42');
    expect(getThreadColor(null, 2).color).toBe('#B8C7B7');
    expect(getThreadColor(null, 6).color).toBe('#4F6D7A'); // wraps around
  });

  it('assigns colors deterministically by string key when index is omitted', () => {
    const col1 = getThreadColor('Legal Challenges');
    const col2 = getThreadColor('Legal Challenges');
    expect(col1).toEqual(col2);
  });

  it('returns default thread color for null/undefined', () => {
    expect(getThreadColor(null)).toEqual(DEFAULT_THREAD_COLOR);
    expect(getThreadColor(undefined)).toEqual(DEFAULT_THREAD_COLOR);
  });

  it('builds a thread color map preserving order for a story', () => {
    const threads = [
      { id: 'thread-1', name: 'Legal Challenges' },
      { id: 'thread-2', name: 'Corrections Chief Resignation' },
      { id: 'thread-3', name: 'Hospital Recovery' },
    ];
    const map = createThreadColorMap(threads);
    expect(map.get('thread-1')?.color).toBe('#4F6D7A');
    expect(map.get('Legal Challenges')?.color).toBe('#4F6D7A');
    expect(map.get('thread-2')?.color).toBe('#DD6E42');
    expect(map.get('Corrections Chief Resignation')?.color).toBe('#DD6E42');
    expect(map.get('thread-3')?.color).toBe('#B8C7B7');
    expect(map.get('Hospital Recovery')?.color).toBe('#B8C7B7');
  });
});
