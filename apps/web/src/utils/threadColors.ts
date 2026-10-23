import {
  BrandColorSwatch,
  BRAND_PALETTE,
  DEFAULT_BRAND_COLOR,
  getBrandColor,
  createBrandColorMap,
} from './palette';

export type ThreadColorStyle = BrandColorSwatch;

export const THREAD_PALETTES: readonly ThreadColorStyle[] = BRAND_PALETTE;
export const DEFAULT_THREAD_COLOR: ThreadColorStyle = DEFAULT_BRAND_COLOR;

export const getThreadColor = getBrandColor;
export const createThreadColorMap = createBrandColorMap;
