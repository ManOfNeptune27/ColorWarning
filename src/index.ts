export const packageName = "colorwarning";

export { parseColor, type Srgb } from "./color.js";
export {
  AA_NORMAL_TEXT,
  contrastRatio,
  linearize,
  meetsAaNormalText,
  relativeLuminance,
} from "./contrast.js";
export { deficiencies, oklabDistance, simulate, type Deficiency } from "./simulate.js";
export {
  COLLAPSED_OKLAB,
  DISTINCT_OKLAB,
  cvdCollision,
  cvdContrast,
  type CvdCollision,
  type CvdContrast,
} from "./verdicts.js";
export {
  extractCss,
  extractFile,
  extractSource,
  extractTailwindTheme,
  extractTokens,
  type CheckedUse,
  type ColorUse,
  type SourceToken,
  type UncheckedReason,
  type UncheckedUse,
  type UseKind,
} from "./extract.js";
