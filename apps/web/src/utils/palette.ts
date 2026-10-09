/**
 * Neus Brand Design System Palette
 *
 * Sourced from Coolors, this 6-color editorial palette establishes
 * Neus's visual identity across charts, badges, timeline sparklines,
 * story angles, and UI accents:
 *
 * 1. Blue Slate:  #4F6D7A
 * 2. Burnt Peach: #DD6E42
 * 3. Ash Grey:    #B8C7B7
 * 4. Thistle:     #D2BFDE
 * 5. Clay Soil:   #805448
 * 6. Charcoal:    #575353
 */

export type BrandColorKey =
  | 'blue-slate'
  | 'burnt-peach'
  | 'ash-grey'
  | 'thistle'
  | 'clay-soil'
  | 'charcoal';

export interface BrandColorSwatch {
  id: BrandColorKey;
  name: string;
  /** Exact hex color for chart bars, sparkline dots, icons, and SVG visualizations */
  color: string;
  /** Soft background tint style meeting aesthetic readability (inline CSS or hex) */
  bg: string;
  /** Border color for chips and cards (inline CSS or hex) */
  border: string;
  /** Accessible text color meeting WCAG AA contrast (>= 4.5:1) */
  text: string;
  /** Slightly deepened dot color for micro-dots and indicators */
  dotColor: string;
}

export const BRAND_PALETTE: readonly BrandColorSwatch[] = [
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
] as const;

export const DEFAULT_BRAND_COLOR: BrandColorSwatch = BRAND_PALETTE[0];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a consistent brand color swatch for a given string key or sequential index.
 */
export function getBrandColor(key?: string | null, index?: number): BrandColorSwatch {
  if (typeof index === 'number' && index >= 0) {
    return BRAND_PALETTE[index % BRAND_PALETTE.length];
  }
  if (!key) return DEFAULT_BRAND_COLOR;
  const hash = hashString(key);
  return BRAND_PALETTE[hash % BRAND_PALETTE.length];
}

/**
 * Creates a map associating an array of items (or string keys) with brand color swatches.
 */
export function createBrandColorMap<T extends { id: string; name?: string | null } | string>(
  items: Array<T>
): Map<string, BrandColorSwatch> {
  const map = new Map<string, BrandColorSwatch>();
  items.forEach((item, idx) => {
    const key = typeof item === 'string' ? item : item.id;
    const swatch = BRAND_PALETTE[idx % BRAND_PALETTE.length];
    map.set(key, swatch);
    if (typeof item !== 'string' && item.name) {
      map.set(item.name, swatch);
    }
  });
  return map;
}
