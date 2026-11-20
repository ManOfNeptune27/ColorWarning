import type { Srgb } from "./color.js";

/** WCAG 2 AA minimum contrast for normal text. */
export const AA_NORMAL_TEXT = 4.5;

/** Convert one gamma-encoded sRGB channel to linear light. */
export function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. Ignores alpha. */
export function relativeLuminance(color: Srgb): number {
  return 0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b);
}

/**
 * WCAG 2 contrast ratio, from 1 to 21.
 * Returns null when either color is translucent, because the ratio needs the painted color.
 */
export function contrastRatio(a: Srgb, b: Srgb): number | null {
  if (a.alpha !== 1 || b.alpha !== 1) return null;
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when the ratio meets WCAG 2 AA for normal-size text. */
export function meetsAaNormalText(ratio: number): boolean {
  return ratio >= AA_NORMAL_TEXT;
}
