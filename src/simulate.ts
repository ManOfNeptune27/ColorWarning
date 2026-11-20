import type { Srgb } from "./color.js";
import { linearize } from "./contrast.js";

export type Deficiency = "protanopia" | "deuteranopia" | "tritanopia";

export const deficiencies: readonly Deficiency[] = ["protanopia", "deuteranopia", "tritanopia"];

type MatrixRow = readonly [number, number, number];
type Matrix = readonly [MatrixRow, MatrixRow, MatrixRow];

/**
 * Machado, Oliveira, and Fernandes 2009, full severity.
 * Each matrix multiplies a column of linear sRGB.
 */
const machado: Record<Deficiency, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** Simulate one deficiency. Alpha is left unchanged. */
export function simulate(color: Srgb, deficiency: Deficiency): Srgb {
  const linear: [number, number, number] = [linearize(color.r), linearize(color.g), linearize(color.b)];
  const matrix = machado[deficiency];
  return {
    r: encode(dot(matrix[0], linear)),
    g: encode(dot(matrix[1], linear)),
    b: encode(dot(matrix[2], linear)),
    alpha: color.alpha,
  };
}

/** Euclidean distance in OKLab. Larger means easier to tell apart. */
export function oklabDistance(a: Srgb, b: Srgb): number {
  const left = oklab(a);
  const right = oklab(b);
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function dot(row: readonly [number, number, number], rgb: readonly [number, number, number]): number {
  return row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2];
}

function encode(linear: number): number {
  const channel = Math.min(1, Math.max(0, linear));
  if (channel <= 0.0031308) return 12.92 * channel;
  return 1.055 * channel ** (1 / 2.4) - 0.055;
}

function oklab(color: Srgb): [number, number, number] {
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
