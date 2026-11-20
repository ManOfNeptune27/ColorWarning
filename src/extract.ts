import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { ColorUse } from "./color-use.js";
import { extractCss } from "./extract-css.js";
import { extractTailwindTheme } from "./extract-tailwind.js";
import { extractTokens } from "./extract-tokens.js";

export type { CheckedUse, ColorUse, SourceToken, UncheckedUse, UseKind } from "./color-use.js";
export type { UncheckedReason } from "./resolve-color.js";
export { extractCss } from "./extract-css.js";
export { extractTailwindTheme } from "./extract-tailwind.js";
export { extractTokens } from "./extract-tokens.js";

/** Read a CSS file, a JSON token file, or a static Tailwind config. */
export function extractFile(filename: string): ColorUse[] {
  return extractSource(filename, readFileSync(filename, "utf8"));
}

export function extractSource(filename: string, source: string): ColorUse[] {
  const name = basename(filename).toLowerCase();
  if (name.startsWith("tailwind.config.")) return extractTailwindTheme(source);
  if (name.endsWith(".json")) return extractTokens(source);
  if (name.endsWith(".css")) return extractCss(source);
  throw new Error(`unsupported file: ${filename}`);
}
