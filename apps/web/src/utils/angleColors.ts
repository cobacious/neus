export interface AngleColorStyle {
  id: string;
  name: string;
  /** Exact hex color for chart bars, sparkline dots, and SVG visualizations */
  color: string;
  /** Soft background tint style (inline CSS or hex) */
  bg: string;
  /** Border color (inline CSS or hex) */
  border: string;
  /** Accessible text color meeting WCAG AA contrast (>= 4.5:1) */
  text: string;
  /** Slightly deepened dot color for small micro-dots if needed */
  dotColor: string;
}

/**
 * Editorial palette defined from Coolors:
 * 1. Blue slate: #4F6D7A
 * 2. Burnt Peach: #DD6E42
 * 3. Ash Grey: #B8C7B7
 * 4. Thistle: #D2BFDE
 * 5. Clay Soil: #805448
 * 6. Charcoal: #575353
 */
export const ANGLE_PALETTES: AngleColorStyle[] = [
  {
    id: 'blue-slate',
    name: 'Blue Slate',
    color: '#4F6D7A',
    bg: '#EEF3F5',
    border: '#4F6D7A',
    text: '#223842',
    dotColor: '#4F6D7A',
  },
  {
    id: 'burnt-peach',
    name: 'Burnt Peach',
    color: '#DD6E42',
    bg: '#FCF2EE',
    border: '#DD6E42',
    text: '#8C3411',
    dotColor: '#DD6E42',
  },
  {
    id: 'ash-grey',
    name: 'Ash Grey',
    color: '#B8C7B7',
    bg: '#F3F7F3',
    border: '#8FA58E',
    text: '#30432F',
    dotColor: '#849E83',
  },
  {
    id: 'thistle',
    name: 'Thistle',
    color: '#D2BFDE',
    bg: '#F9F5FC',
    border: '#B99DCB',
    text: '#4E3160',
    dotColor: '#A887BF',
  },
  {
    id: 'clay-soil',
    name: 'Clay Soil',
    color: '#805448',
    bg: '#F8F3F1',
    border: '#805448',
    text: '#4A2A22',
    dotColor: '#805448',
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    color: '#575353',
    bg: '#F5F4F4',
    border: '#575353',
    text: '#292525',
    dotColor: '#575353',
  },
];

export const DEFAULT_ANGLE_COLOR: AngleColorStyle = ANGLE_PALETTES[0];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAngleColor(key?: string | null, index?: number): AngleColorStyle {
  if (typeof index === 'number' && index >= 0) {
    return ANGLE_PALETTES[index % ANGLE_PALETTES.length];
  }
  if (!key) return DEFAULT_ANGLE_COLOR;
  const hash = hashString(key);
  return ANGLE_PALETTES[hash % ANGLE_PALETTES.length];
}

export function createAngleColorMap(
  angles: Array<{ id: string; name?: string | null } | string>
): Map<string, AngleColorStyle> {
  const map = new Map<string, AngleColorStyle>();
  angles.forEach((item, idx) => {
    const key = typeof item === 'string' ? item : item.id;
    const style = ANGLE_PALETTES[idx % ANGLE_PALETTES.length];
    map.set(key, style);
    if (typeof item !== 'string' && item.name) {
      map.set(item.name, style);
    }
  });
  return map;
}
