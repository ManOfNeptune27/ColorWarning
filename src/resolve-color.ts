import { parseColor, type Srgb } from "./color.js";

export type UncheckedReason =
  | "unresolved-variable"
  | "gradient"
  | "image"
  | "current-color"
  | "unreadable"
  | "missing-background";

export type ResolvedColor =
  | { ok: true; color: Srgb }
  | { ok: false; reason: UncheckedReason };

/** Resolve one CSS color value. `tokens` maps custom property names to their raw values. */
export function resolvePaint(
  value: string,
  tokens: ReadonlyMap<string, string> = new Map(),
  seen: Set<string> = new Set(),
): ResolvedColor {
  const trimmed = value.trim();
  if (/gradient\(/i.test(trimmed)) return { ok: false, reason: "gradient" };
  if (/url\(/i.test(trimmed)) return { ok: false, reason: "image" };
  if (/^currentcolor$/i.test(trimmed)) return { ok: false, reason: "current-color" };

  const variable = readVar(trimmed);
  if (variable !== null) {
    if (seen.has(variable.name)) return { ok: false, reason: "unresolved-variable" };
    seen.add(variable.name);
    const next = tokens.get(variable.name);
    if (next === undefined) {
      if (variable.fallback === null) return { ok: false, reason: "unresolved-variable" };
      return resolvePaint(variable.fallback, tokens, seen);
    }
    return resolvePaint(next, tokens, seen);
  }

  const color = parseColor(trimmed);
  if (color === null) return { ok: false, reason: "unreadable" };
  return { ok: true, color };
}

/** Paint a translucent foreground onto an opaque background. */
export function compositeOver(foreground: Srgb, background: Srgb): Srgb | null {
  if (background.alpha !== 1) return null;
  if (foreground.alpha === 1) return foreground;
  const alpha = foreground.alpha;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    alpha: 1,
  };
}

function readVar(value: string): { name: string; fallback: string | null } | null {
  if (!/^var\(/i.test(value)) return null;
  const open = value.indexOf("(");
  const close = matchParen(value, open);
  if (close === null || close !== value.length - 1) return null;
  const parts = splitTopComma(value.slice(open + 1, close));
  const name = parts[0];
  if (name === undefined || !/^--[A-Za-z0-9_-]+$/.test(name)) return null;
  if (parts.length === 1) return { name, fallback: null };
  if (parts.length === 2) return { name, fallback: parts[1] ?? null };
  return null;
}

function matchParen(value: string, open: number): number | null {
  let depth = 0;
  for (let i = open; i < value.length; i++) {
    const char = value[i];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return null;
}

function splitTopComma(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}
