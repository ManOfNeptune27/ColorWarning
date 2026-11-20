import { usesFromTokens, type ColorUse, type SourceToken } from "./color-use.js";

/** Read a JSON token file. String leaves and `{ "value": "..." }` leaves both count. */
export function extractTokens(source: string): ColorUse[] {
  const parsed: unknown = JSON.parse(source);
  const tokens: SourceToken[] = [];
  walk(parsed, [], source, tokens);
  return usesFromTokens(tokens);
}

function walk(node: unknown, path: string[], source: string, tokens: SourceToken[]): void {
  if (typeof node === "string") {
    const name = path.join("-");
    if (name.length === 0) return;
    tokens.push({ name, line: lineOf(source, path.at(-1) ?? name, node), value: node });
    return;
  }
  if (node === null || typeof node !== "object" || Array.isArray(node)) return;

  const record = node as Record<string, unknown>;
  if (typeof record["value"] === "string" && path.length > 0) {
    const name = path.join("-");
    const value = record["value"];
    tokens.push({ name, line: lineOf(source, path.at(-1) ?? name, value), value });
    return;
  }

  for (const [key, child] of Object.entries(record)) {
    walk(child, [...path, key], source, tokens);
  }
}

function lineOf(source: string, key: string, value: string): number {
  const keyIndex = source.indexOf(`"${key}"`);
  const from = keyIndex === -1 ? 0 : keyIndex;
  const valueIndex = source.indexOf(value, from);
  const index = valueIndex === -1 ? from : valueIndex;
  return source.slice(0, index).split("\n").length;
}
