import path from "node:path";
import { existsSync } from "node:fs";
import { BASELINE_FILENAME, entryFromUse, fileKey, loadBaseline, takeBaseline } from "./baseline.js";
import type { CheckedUse } from "./color-use.js";
import { extractSource } from "./extract.js";
import { ignoredLines } from "./ignore.js";

export type EditorDiagnostic = {
  line: number;
  message: string;
  /** Source text to highlight. Empty when the line has no matching color. */
  word: string;
};

/** CSS, JSON token files, and Tailwind configs. Skips installed and built files. */
export function editorWatches(filename: string): boolean {
  const parts = filename.split(/[\\/]/);
  if (parts.includes("node_modules") || parts.includes("dist")) return false;
  const base = path.basename(filename).toLowerCase();
  return base.endsWith(".css") || base.endsWith(".json") || base.startsWith("tailwind.config.");
}

/** Nearest folder that contains `colorwarning-baseline.json`, walking up from the file. */
export function findBaselineDirectory(filename: string): string | null {
  let directory = path.dirname(path.resolve(filename));
  const root = path.parse(directory).root;
  while (true) {
    if (existsSync(path.join(directory, BASELINE_FILENAME))) return directory;
    if (directory === root) return null;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

/**
 * Color-vision warnings for one file.
 * A bad baseline does not hide warnings. Ordinary contrast failures stay out.
 */
export function editorDiagnostics(
  filename: string,
  source: string,
  baselineDirectory: string | null,
): EditorDiagnostic[] {
  if (!editorWatches(filename)) return [];
  let uses;
  try {
    uses = extractSource(filename, source);
  } catch {
    return [];
  }

  const skip = ignoredLines(source);
  let baseline = null;
  if (baselineDirectory !== null) {
    try {
      baseline = loadBaseline(baselineDirectory);
    } catch {
      baseline = null;
    }
  }
  const key = fileKey(filename, baselineDirectory ?? path.dirname(path.resolve(filename)));
  const diagnostics: EditorDiagnostic[] = [];
  for (const use of uses) {
    if (use.status !== "checked" || skip.has(use.line)) continue;
    if (use.verdict !== "cvd-contrast" && use.verdict !== "cvd-collision") continue;
    if (takeBaseline(baseline, entryFromUse(key, use))) continue;
    diagnostics.push({
      line: use.line,
      message: message(use),
      word: use.kind === "status" ? use.second : use.first,
    });
  }
  return diagnostics;
}

function message(use: CheckedUse): string {
  const deficiency = use.deficiency ?? "color-vision deficiency";
  const first = use.firstName === null ? use.first : `${use.first} (${use.firstName})`;
  const second = use.secondName === null ? use.second : `${use.second} (${use.secondName})`;
  const normal = use.normal.toFixed(2);
  const simulated = (use.simulated ?? 0).toFixed(2);
  if (use.verdict === "cvd-collision") {
    return `${first} and ${second} collide under ${deficiency} (distance ${normal}, simulated ${simulated})`;
  }
  return `${first} on ${second} fails color-vision contrast under ${deficiency} (${normal}:1, simulated ${simulated}:1)`;
}
