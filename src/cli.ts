#!/usr/bin/env node
import { extractFile, type ColorUse } from "./extract.js";
import { pathToFileURL } from "node:url";

export type CliResult = {
  exitCode: number;
  output: string;
  errorOutput: string;
};

/** Run `colorwarning check <file>...`. Findings fail the command. Unchecked colors do not. */
export function runCli(args: readonly string[]): CliResult {
  if (args[0] !== "check" || args.length < 2) {
    return {
      exitCode: 2,
      output: "",
      errorOutput: "usage: colorwarning check <file>...\n",
    };
  }

  const blocks: string[] = [];
  const errors: string[] = [];
  let findings = 0;
  let unchecked = 0;

  for (const filename of args.slice(1)) {
    let uses: ColorUse[];
    try {
      uses = extractFile(filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${filename}: ${message}`);
      continue;
    }
    for (const use of uses) {
      const block = formatFinding(filename, use);
      if (block === null) continue;
      blocks.push(block);
      if (use.status === "unchecked") unchecked += 1;
      else findings += 1;
    }
  }

  const summary =
    findings === 0 && unchecked === 0 && errors.length === 0
      ? "no findings"
      : `${count(findings, "finding")}, ${count(unchecked, "unchecked item")}`;
  const body = blocks.join("\n\n");
  const output = body.length > 0 ? `${body}\n\n${summary}\n` : `${summary}\n`;
  const exitCode = errors.length > 0 ? 2 : findings > 0 ? 1 : 0;
  return {
    exitCode,
    output,
    errorOutput: errors.length > 0 ? `${errors.join("\n")}\n` : "",
  };
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
