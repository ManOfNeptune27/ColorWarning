#!/usr/bin/env node
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BASELINE_FILENAME, entryFromUse, fileKey, loadBaseline, saveBaseline, takeBaseline } from "./baseline.js";
import { extractSource, type ColorUse } from "./extract.js";
import { ignoredLines } from "./ignore.js";
import { renderSwatch, SWATCH_FILENAME, type SwatchPair } from "./swatch.js";

export type CliResult = {
  exitCode: number;
  output: string;
  errorOutput: string;
};

const usage =
  "usage: colorwarning check <file>...\n       colorwarning baseline <file>...\n       colorwarning swatch <file>...\n";

/** Run `colorwarning check`, `baseline`, or `swatch`. Findings fail the check. Unchecked colors do not. */
export function runCli(args: readonly string[], options?: { cwd?: string }): CliResult {
  const command = args[0];
  const filenames = args.slice(1);
  if ((command !== "check" && command !== "baseline" && command !== "swatch") || filenames.length === 0) {
    return { exitCode: 2, output: "", errorOutput: usage };
  }

  const cwd = options?.cwd ?? process.cwd();
  const collected = collect(filenames, cwd);
  if (collected.errors.length > 0 && (command === "baseline" || command === "swatch")) {
    return { exitCode: 2, output: "", errorOutput: `${collected.errors.join("\n")}\n` };
  }
  if (command === "swatch") return writeSwatch(cwd, collected);
  if (command === "baseline") {
    saveBaseline(cwd, collected.entries);
    return {
      exitCode: 0,
      output: `wrote ${BASELINE_FILENAME} (${collected.entries.length} ${collected.entries.length === 1 ? "entry" : "entries"})\n`,
      errorOutput: "",
    };
  }

  let baseline: Map<string, number> | null;
  try {
    baseline = loadBaseline(cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, output: "", errorOutput: `${message}\n` };
  }

  const blocks: string[] = [];
  let findings = 0;
  let unchecked = 0;
  let baselined = 0;
  for (const item of collected.items) {
    if (takeBaseline(baseline, item.entry)) {
      baselined += 1;
      continue;
    }
    blocks.push(item.block);
    if (item.use.status === "unchecked") unchecked += 1;
    else findings += 1;
  }

  const summary = summarize(findings, unchecked, baselined, collected.ignored, collected.errors.length);
  const body = blocks.join("\n\n");
  const output = body.length > 0 ? `${body}\n\n${summary}\n` : `${summary}\n`;
  const exitCode = collected.errors.length > 0 ? 2 : findings > 0 ? 1 : 0;
  return {
    exitCode,
    output,
    errorOutput: collected.errors.length > 0 ? `${collected.errors.join("\n")}\n` : "",
  };
}

type CollectedItem = { filename: string; block: string; use: ColorUse; entry: ReturnType<typeof entryFromUse> };

type Collected = {
  items: CollectedItem[];
  entries: ReturnType<typeof entryFromUse>[];
  errors: string[];
  ignored: number;
};

function writeSwatch(cwd: string, collected: Collected): CliResult {
  let baseline: Map<string, number> | null;
  try {
    baseline = loadBaseline(cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, output: "", errorOutput: `${message}\n` };
  }

  const pairs: SwatchPair[] = [];
  for (const item of collected.items) {
    if (takeBaseline(baseline, item.entry)) continue;
    const pair = swatchPair(item);
    if (pair !== null) pairs.push(pair);
  }

  const target = path.join(cwd, SWATCH_FILENAME);
  if (pairs.length === 0) {
    if (existsSync(target)) unlinkSync(target);
    return { exitCode: 0, output: "no swatch\n", errorOutput: "" };
  }
  writeFileSync(target, renderSwatch(pairs));
  const noun = pairs.length === 1 ? "pair" : "pairs";
  return { exitCode: 0, output: `wrote ${SWATCH_FILENAME} (${pairs.length} ${noun})\n`, errorOutput: "" };
}

function swatchPair(item: CollectedItem): SwatchPair | null {
  const use = item.use;
  if (use.status !== "checked") return null;
  if (use.deficiency === null) return null;
  if (use.verdict !== "cvd-contrast" && use.verdict !== "cvd-collision") return null;
  const place = label(use);
  return {
    kind: use.kind,
    label: `${item.filename}:${use.line}${place.length > 0 ? ` ${place}` : ""}`,
    deficiency: use.deficiency,
    first: use.firstPaint,
    second: use.secondPaint,
  };
}

function collect(filenames: readonly string[], cwd: string): Collected {
  const items: Collected["items"] = [];
  const entries: Collected["entries"] = [];
  const errors: string[] = [];
  let ignored = 0;

  for (const filename of filenames) {
    let uses: ColorUse[];
    let skip: Set<number>;
    try {
      const absolute = path.resolve(cwd, filename);
      const source = readFileSync(absolute, "utf8");
      uses = extractSource(absolute, source);
      skip = ignoredLines(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${filename}: ${message}`);
      continue;
    }

    const key = fileKey(filename, cwd);
    for (const use of uses) {
      const block = formatFinding(filename, use);
      if (block === null) continue;
      if (skip.has(use.line)) {
        ignored += 1;
        continue;
      }
      const entry = entryFromUse(key, use);
      entries.push(entry);
      items.push({ filename, block, use, entry });
    }
  }

  return { items, entries, errors, ignored };
}

function summarize(findings: number, unchecked: number, baselined: number, ignored: number, errors: number): string {
  const suppressed = [baselined > 0 ? `${baselined} baselined` : "", ignored > 0 ? `${ignored} ignored` : ""]
    .filter((part) => part.length > 0)
    .join(", ");
  if (findings === 0 && unchecked === 0 && errors === 0) {
    return suppressed.length > 0 ? `no new findings, ${suppressed}` : "no findings";
  }
  const summary = `${count(findings, "finding")}, ${count(unchecked, "unchecked item")}`;
  return suppressed.length > 0 ? `${summary}, ${suppressed}` : summary;
}

export function formatFinding(filename: string, use: ColorUse): string | null {
  if (use.status === "checked" && use.verdict === "pass") return null;

  const place = label(use);
  const lines = [`${filename}:${use.line}${place.length > 0 ? ` ${place}` : ""}`, `  ${colors(use)}`];
  if (use.status === "unchecked") {
    lines.push(`  unchecked (${use.reason})`);
    return lines.join("\n");
  }
  if (use.verdict === "cvd-collision") {
    lines.push(`  cvd-collision under ${use.deficiency ?? "color-vision deficiency"}`);
    lines.push(`  distance ${use.normal.toFixed(2)}, simulated ${(use.simulated ?? 0).toFixed(2)}`);
    return lines.join("\n");
  }
  if (use.verdict === "cvd-contrast") {
    lines.push(`  cvd-contrast under ${use.deficiency ?? "color-vision deficiency"}`);
    lines.push(`  contrast ${use.normal.toFixed(2)}:1, simulated ${(use.simulated ?? 0).toFixed(2)}:1`);
    return lines.join("\n");
  }
  lines.push(`  contrast ${use.normal.toFixed(2)}:1`);
  return lines.join("\n");
}

function label(use: ColorUse): string {
  if (use.selector !== null) return use.selector;
  return [use.firstName, use.secondName].filter((name): name is string => name !== null).join(" / ");
}

function colors(use: ColorUse): string {
  const first = use.first ?? "(missing)";
  if (use.second === null) return first;
  return `${first} ${use.kind === "status" ? "and" : "on"} ${use.second}`;
}

function count(amount: number, noun: string): string {
  if (noun === "unchecked item") return `${amount} unchecked`;
  return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const result = runCli(process.argv.slice(2));
  if (result.errorOutput.length > 0) process.stderr.write(result.errorOutput);
  process.stdout.write(result.output);
  process.exitCode = result.exitCode;
}
