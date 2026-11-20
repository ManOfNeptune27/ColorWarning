import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ColorUse, UseKind } from "./color-use.js";

export const BASELINE_FILENAME = "colorwarning-baseline.json";

export type BaselineEntry = {
  file: string;
  kind: UseKind;
  selector: string | null;
  firstName: string | null;
  secondName: string | null;
  first: string | null;
  second: string | null;
  verdict: string | null;
  reason: string | null;
};

type BaselineFile = {
  version: 1;
  findings: BaselineEntry[];
};

export function baselinePath(cwd: string): string {
  return path.join(cwd, BASELINE_FILENAME);
}

export function fileKey(filename: string, cwd: string): string {
  const relative = path.relative(cwd, path.resolve(cwd, filename));
  const portable = (relative.startsWith("..") ? filename : relative).split(path.sep).join("/");
  return portable;
}

export function entryFromUse(file: string, use: ColorUse): BaselineEntry {
  return {
    file,
    kind: use.kind,
    selector: use.selector,
    firstName: use.firstName,
    secondName: use.secondName,
    first: use.first,
    second: use.second,
    verdict: use.status === "checked" ? use.verdict : null,
    reason: use.status === "unchecked" ? use.reason : null,
  };
}

/** A missing file means there is no baseline. An unreadable file throws. */
export function loadBaseline(cwd: string): Map<string, number> | null {
  const filename = baselinePath(cwd);
  if (!existsSync(filename)) return null;
  const parsed: unknown = JSON.parse(readFileSync(filename, "utf8"));
  if (!isBaseline(parsed)) throw new Error(`${BASELINE_FILENAME} is not a version 1 baseline`);
  const counts = new Map<string, number>();
  for (const entry of parsed.findings) {
    const key = fingerprint(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function saveBaseline(cwd: string, entries: readonly BaselineEntry[]): void {
  const body: BaselineFile = { version: 1, findings: [...entries] };
  writeFileSync(baselinePath(cwd), `${JSON.stringify(body, null, 2)}\n`);
}

/** True when this entry is already in the baseline. Each saved copy covers one occurrence. */
export function takeBaseline(counts: Map<string, number> | null, entry: BaselineEntry): boolean {
  if (counts === null) return false;
  const key = fingerprint(entry);
  const left = counts.get(key) ?? 0;
  if (left <= 0) return false;
  counts.set(key, left - 1);
  return true;
}

function fingerprint(entry: BaselineEntry): string {
  return JSON.stringify([
    entry.file,
    entry.kind,
    entry.selector,
    entry.firstName,
    entry.secondName,
    entry.first,
    entry.second,
    entry.verdict,
    entry.reason,
  ]);
}

function isBaseline(value: unknown): value is BaselineFile {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record["version"] === 1 && Array.isArray(record["findings"]) && record["findings"].every(isEntry);
}

function isEntry(value: unknown): value is BaselineEntry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry["file"] === "string" &&
    (entry["kind"] === "text-background" || entry["kind"] === "status") &&
    nullableString(entry["selector"]) &&
    nullableString(entry["firstName"]) &&
    nullableString(entry["secondName"]) &&
    nullableString(entry["first"]) &&
    nullableString(entry["second"]) &&
    nullableString(entry["verdict"]) &&
    nullableString(entry["reason"])
  );
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}
