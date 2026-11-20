import { namedColors } from "./named-colors.js";

/** sRGB color. Channels are gamma-encoded, from 0 to 1. */
export type Srgb = {
  r: number;
  g: number;
  b: number;
  alpha: number;
};

const numberPattern = "-?(?:\\d+\\.?\\d*|\\.\\d+)";

/**
 * Parse a CSS color into sRGB.
 * Accepts hex, rgb()/rgba(), hsl()/hsla(), and CSS named colors.
 * Returns null when the string is not one of those forms.
 */
export function parseColor(input: string): Srgb | null {
  const value = input.trim();
  if (value.length === 0) return null;
  if (value.startsWith("#")) return parseHex(value);
  const fn = /^(rgba?|hsla?)\((.*)\)$/i.exec(value);
  if (fn?.[1] && fn[2] !== undefined) {
    const kind = fn[1].toLowerCase();
    return kind.startsWith("rgb") ? parseRgb(fn[2]) : parseHsl(fn[2]);
  }
  return parseNamed(value);
}

function parseNamed(value: string): Srgb | null {
  const hex = namedColors[value.toLowerCase()];
  if (hex === undefined) return null;
  return channelsFromHex(hex);
}

function parseHex(value: string): Srgb | null {
  const hex = value.slice(1);
  if (!/^[0-9a-f]+$/i.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) {
    const expanded = hex
      .split("")
      .map((digit) => digit + digit)
      .join("");
    return channelsFromHex(expanded.padEnd(8, "ff"));
  }
  if (hex.length === 6 || hex.length === 8) {
    return channelsFromHex(hex.padEnd(8, "ff"));
  }
  return null;
}

function channelsFromHex(hex: string): Srgb | null {
  if (hex.length !== 8) return null;
  return {
    r: integerChannel(hex.slice(0, 2)),
    g: integerChannel(hex.slice(2, 4)),
    b: integerChannel(hex.slice(4, 6)),
    alpha: integerChannel(hex.slice(6, 8)),
  };
}

function integerChannel(hex: string): number {
  return Number.parseInt(hex, 16) / 255;
}

function parseRgb(body: string): Srgb | null {
  const args = splitArgs(body);
  if (args === null) return null;
  const parsed = args.parts.map(parseRgbChannel);
  if (parsed.some((channel) => channel === null)) return null;
  const channels = parsed as Array<{ kind: "number" | "percent"; value: number }>;
  const [first] = channels;
  if (first === undefined || channels.some((channel) => channel.kind !== first.kind)) return null;
  const alpha = parseAlpha(args.alpha);
  if (alpha === null) return null;
  const [r, g, b] = channels;
  if (r === undefined || g === undefined || b === undefined) return null;
  return { r: r.value, g: g.value, b: b.value, alpha };
}

function parseHsl(body: string): Srgb | null {
  const args = splitArgs(body);
  if (args === null) return null;
  const [hueToken, satToken, lightToken] = args.parts;
  if (hueToken === undefined || satToken === undefined || lightToken === undefined) return null;
  const hue = parseHue(hueToken);
  const saturation = parsePercent(satToken);
  const lightness = parsePercent(lightToken);
  const alpha = parseAlpha(args.alpha);
  if (hue === null || saturation === null || lightness === null || alpha === null) return null;
  const [r, g, b] = hslToSrgb(hue, saturation, lightness);
  return { r, g, b, alpha };
}

function splitArgs(body: string): { parts: string[]; alpha: string | null } | null {
  let main = body.trim();
  if (main.length === 0) return null;
  let alpha: string | null = null;
  const slash = main.indexOf("/");
  if (slash !== -1) {
    alpha = main.slice(slash + 1).trim();
    main = main.slice(0, slash).trim();
    if (alpha.length === 0 || main.length === 0) return null;
  }
  const parts = (main.includes(",") ? main.split(",") : main.split(/\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (alpha === null && parts.length === 4) {
    alpha = parts[3] ?? null;
    parts.pop();
  }
  if (parts.length !== 3) return null;
  return { parts, alpha };
}

function parseRgbChannel(token: string): { kind: "number" | "percent"; value: number } | null {
  const percent = new RegExp(`^(${numberPattern})%$`).exec(token);
  if (percent?.[1] !== undefined) {
    return { kind: "percent", value: clamp(Number(percent[1]), 0, 100) / 100 };
  }
  const number = new RegExp(`^(${numberPattern})$`).exec(token);
  if (number?.[1] === undefined) return null;
  return { kind: "number", value: clamp(Number(number[1]), 0, 255) / 255 };
}

function parsePercent(token: string): number | null {
  const percent = new RegExp(`^(${numberPattern})%$`).exec(token);
  if (percent?.[1] === undefined) return null;
  return clamp(Number(percent[1]), 0, 100) / 100;
}

function parseHue(token: string): number | null {
  const match = new RegExp(`^(${numberPattern})(deg|turn|rad|grad)?$`, "i").exec(token);
  if (match?.[1] === undefined) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "deg").toLowerCase();
  if (unit === "deg") return amount;
  if (unit === "turn") return amount * 360;
  if (unit === "rad") return (amount * 180) / Math.PI;
  return amount * 0.9;
}

function parseAlpha(token: string | null): number | null {
  if (token === null) return 1;
  const percent = new RegExp(`^(${numberPattern})%$`).exec(token);
  if (percent?.[1] !== undefined) return clamp(Number(percent[1]), 0, 100) / 100;
  const number = new RegExp(`^(${numberPattern})$`).exec(token);
  if (number?.[1] === undefined) return null;
  return clamp(Number(number[1]), 0, 1);
}

function hslToSrgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  const sector = Math.floor(h / 60);
  const rgb: [number, number, number] =
    sector === 0 ? [c, x, 0]
    : sector === 1 ? [x, c, 0]
    : sector === 2 ? [0, c, x]
    : sector === 3 ? [0, x, c]
    : sector === 4 ? [x, 0, c]
    : [c, 0, x];
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
