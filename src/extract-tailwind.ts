import { textOnBackground, usesFromTokens, type ColorUse, type SourceToken } from "./color-use.js";
import { resolvePaint } from "./resolve-color.js";

type JsString = { type: "string"; value: string; line: number };
type JsUnreadable = { type: "unreadable"; raw: string; line: number };
type JsObject = { type: "object"; fields: Array<{ key: string; value: JsNode }>; line: number };
type JsNode = JsString | JsUnreadable | JsObject;

/** Read `theme.colors` and `theme.extend.colors` from a static Tailwind config. */
export function extractTailwindTheme(source: string): ColorUse[] {
  const theme = findTheme(source);
  if (theme === null) return [];

  const base = objectField(theme, "colors");
  const extend = objectField(theme, "extend");
  const extended = extend?.type === "object" ? objectField(extend, "colors") : null;
  const merged = new Map<string, SourceToken>();
  const pairs: ColorUse[] = [];
  if (base !== null) flattenColors(base, merged, pairs);
  if (extended !== null) flattenColors(extended, merged, pairs);
  return [...pairs, ...usesFromTokens([...merged.values()])];
}

function findTheme(source: string): JsObject | null {
  const marker = /(?:^|[^\w-])theme\s*:/g;
  let match: RegExpExecArray | null = marker.exec(source);
  while (match !== null) {
    let index = match.index + match[0].length;
    index = skipWhitespace(source, index);
    if (source[index] === "{") {
      const parsed = parseValue(source, index);
      if (parsed.node.type === "object") return parsed.node;
    }
    match = marker.exec(source);
  }
  return null;
}

function flattenColors(node: JsNode, into: Map<string, SourceToken>, pairs: ColorUse[]): void {
  if (node.type !== "object") return;
  for (const field of node.fields) {
    if (field.value.type === "string" || field.value.type === "unreadable") {
      into.set(field.key, { name: field.key, line: field.value.line, value: rawValue(field.value) });
      continue;
    }
    const fallback = fieldBy(field.value, "DEFAULT") ?? fieldBy(field.value, "default");
    const foreground = fieldBy(field.value, "foreground");
    if (fallback?.value.type === "string" && foreground?.value.type === "string") {
      const background = resolvePaint(fallback.value.value);
      const text = resolvePaint(foreground.value.value);
      if (background.ok && text.ok) {
        pairs.push(
          textOnBackground({
            line: foreground.value.line,
            selector: null,
            firstName: `${field.key}.foreground`,
            secondName: field.key,
            first: foreground.value.value,
            second: fallback.value.value,
            text: text.color,
            background: background.color,
          }),
        );
      }
      continue;
    }
    if (fallback?.value.type === "string") {
      into.set(field.key, { name: field.key, line: fallback.value.line, value: fallback.value.value });
      continue;
    }
    const onlyShades = field.value.fields.every((entry) => /^\d+$/.test(entry.key));
    if (!onlyShades) flattenColors(field.value, into, pairs);
  }
}

function rawValue(node: JsString | JsUnreadable): string {
  return node.type === "string" ? node.value : node.raw;
}

function objectField(node: JsObject, key: string): JsNode | null {
  return node.fields.find((field) => field.key === key)?.value ?? null;
}

function fieldBy(node: JsObject, key: string): { key: string; value: JsNode } | null {
  return node.fields.find((field) => field.key === key) ?? null;
}

function parseValue(source: string, index: number): { node: JsNode; index: number } {
  const start = skipWhitespace(source, index);
  const char = source[start];
  if (char === "{") return parseObject(source, start);
  if (char === '"' || char === "'") return parseString(source, start, char);
  return parseUnreadable(source, start);
}

function parseObject(source: string, index: number): { node: JsObject; index: number } {
  const line = lineAt(source, index);
  let cursor = index + 1;
  const fields: JsObject["fields"] = [];
  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    if (source[cursor] === "}") return { node: { type: "object", fields, line }, index: cursor + 1 };
    if (source[cursor] === ",") {
      cursor += 1;
      continue;
    }
    const key = parseKey(source, cursor);
    cursor = skipWhitespace(source, key.index);
    if (source[cursor] !== ":") return { node: { type: "object", fields, line }, index: cursor };
    const value = parseValue(source, cursor + 1);
    fields.push({ key: key.key, value: value.node });
    cursor = value.index;
  }
  return { node: { type: "object", fields, line }, index: cursor };
}

function parseKey(source: string, index: number): { key: string; index: number } {
  const char = source[index];
  if (char === '"' || char === "'") {
    const parsed = parseString(source, index, char);
    return parsed.node.type === "string"
      ? { key: parsed.node.value, index: parsed.index }
      : { key: "", index: parsed.index };
  }
  let cursor = index;
  while (cursor < source.length && /[\w$-]/.test(source[cursor] ?? "")) cursor += 1;
  return { key: source.slice(index, cursor), index: cursor };
}

function parseString(source: string, index: number, quote: string): { node: JsString | JsUnreadable; index: number } {
  const line = lineAt(source, index);
  let cursor = index + 1;
  let value = "";
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      value += source[cursor + 1] ?? "";
      cursor += 2;
      continue;
    }
    if (char === quote) return { node: { type: "string", value, line }, index: cursor + 1 };
    value += char ?? "";
    cursor += 1;
  }
  return { node: { type: "unreadable", raw: value, line }, index: cursor };
}

function parseUnreadable(source: string, index: number): { node: JsUnreadable; index: number } {
  const line = lineAt(source, index);
  let cursor = index;
  let depth = 0;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") {
      if (depth === 0) break;
      depth -= 1;
    } else if (char === "," && depth === 0) break;
    cursor += 1;
  }
  return { node: { type: "unreadable", raw: source.slice(index, cursor).trim(), line }, index: cursor };
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (cursor < source.length) {
    const char = source[cursor];
    const next = source[cursor + 1];
    if (char === "/" && next === "/") {
      while (cursor < source.length && source[cursor] !== "\n") cursor += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      cursor += 2;
      while (cursor < source.length && !(source[cursor] === "*" && source[cursor + 1] === "/")) cursor += 1;
      cursor += 2;
      continue;
    }
    if (char !== undefined && /\s/.test(char)) {
      cursor += 1;
      continue;
    }
    break;
  }
  return cursor;
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}
