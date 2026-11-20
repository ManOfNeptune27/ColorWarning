import type { Srgb } from "./color.js";
import { contrastRatio, meetsAaNormalText } from "./contrast.js";
import { deficiencies, oklabDistance, simulate, type Deficiency } from "./simulate.js";

/**
 * OKLab distance at or above this means the two colors look different to typical vision.
 * This is ColorWarning's cutoff, not a WCAG number.
 */
export const DISTINCT_OKLAB = 0.15;

/**
 * OKLab distance below this, after simulation, means the two colors have moved together.
 * This is ColorWarning's cutoff, not a WCAG number.
 */
export const COLLAPSED_OKLAB = 0.1;

export type CvdContrast = {
  kind: "cvd-contrast";
  deficiency: Deficiency;
  normal: number;
  simulated: number;
};

export type CvdCollision = {
  kind: "cvd-collision";
  deficiency: Deficiency;
  normalDistance: number;
  simulatedDistance: number;
};

/**
 * A text and background pair that passes AA and fails it after simulation.
 * Returns the deficiency with the lowest simulated ratio, or null when the pair does not do this.
 */
export function cvdContrast(text: Srgb, background: Srgb): CvdContrast | null {
  const normal = contrastRatio(text, background);
  if (normal === null || !meetsAaNormalText(normal)) return null;

  let worst: CvdContrast | null = null;
  for (const deficiency of deficiencies) {
    const simulated = contrastRatio(simulate(text, deficiency), simulate(background, deficiency));
    if (simulated === null || meetsAaNormalText(simulated)) continue;
    if (worst === null || simulated < worst.simulated) {
      worst = { kind: "cvd-contrast", deficiency, normal, simulated };
    }
  }
  return worst;
}

/**
 * Two colors that stay apart for typical vision and move together under simulation.
 * Returns the deficiency with the smallest simulated distance, or null when they do not.
 */
export function cvdCollision(a: Srgb, b: Srgb): CvdCollision | null {
  if (a.alpha !== 1 || b.alpha !== 1) return null;
  const normalDistance = oklabDistance(a, b);
  if (normalDistance < DISTINCT_OKLAB) return null;

  let worst: CvdCollision | null = null;
  for (const deficiency of deficiencies) {
    const simulatedDistance = oklabDistance(simulate(a, deficiency), simulate(b, deficiency));
    if (simulatedDistance >= COLLAPSED_OKLAB) continue;
    if (worst === null || simulatedDistance < worst.simulatedDistance) {
      worst = { kind: "cvd-collision", deficiency, normalDistance, simulatedDistance };
    }
  }
  return worst;
}
