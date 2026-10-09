import {
  BrandColorSwatch,
  BRAND_PALETTE,
  DEFAULT_BRAND_COLOR,
  getBrandColor,
  createBrandColorMap,
} from './palette';

/**
 * Backward compatibility alias: AngleColorStyle delegates to BrandColorSwatch.
 * The 6-color editorial palette is Neus's core brand design system palette.
 */
export type AngleColorStyle = BrandColorSwatch;

export const ANGLE_PALETTES: readonly AngleColorStyle[] = BRAND_PALETTE;
export const DEFAULT_ANGLE_COLOR: AngleColorStyle = DEFAULT_BRAND_COLOR;

export const getAngleColor = getBrandColor;
export const createAngleColorMap = createBrandColorMap;
