import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";

const redOnBlack = ".bad { color: #ff0000; background-color: #000000; }\n";
const faint = ".faint { color: #777777; background-color: #ffffff; }\n";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "colorwarning-"));
}

describe("ignore and baseline", () => {
  test("ignores a finding marked on the same line", () => {
    const cwd = workspace();
    const file = join(cwd, "theme.css");
    writeFileSync(file, `.bad { color: #ff0000; background-color: #000000; } /* colorwarning-ignore */\n`);
    const result = runCli(["check", "theme.css"], { cwd });
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("no new findings, 1 ignored\n");
  });

  test("ignores a finding marked on the previous line", () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), `/* colorwarning-ignore */\n${redOnBlack}`);
    const result = runCli(["check", "theme.css"], { cwd });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("1 ignored");
    expect(result.output).not.toContain("protanopia");
  });

  test("writes a baseline and then reports only a new finding", () => {
    const cwd = workspace();
    const file = join(cwd, "theme.css");
    writeFileSync(file, redOnBlack);
    const written = runCli(["baseline", "theme.css"], { cwd });
    expect(written.exitCode).toBe(0);
    expect(written.output).toBe("wrote colorwarning-baseline.json (1 entry)\n");

    const quiet = runCli(["check", "theme.css"], { cwd });
    expect(quiet.exitCode).toBe(0);
    expect(quiet.output).toBe("no new findings, 1 baselined\n");

    writeFileSync(file, `\n${redOnBlack}${faint}`);
    const next = runCli(["check", "theme.css"], { cwd });
    expect(next.exitCode).toBe(1);
    expect(next.output).toContain(".faint");
    expect(next.output).toContain("contrast ");
    expect(next.output).not.toContain("protanopia");
    expect(next.output).toContain("1 baselined");
  });

  test("rejects a baseline that is not version 1", () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    writeFileSync(join(cwd, "colorwarning-baseline.json"), "{ \"version\": 2, \"findings\": [] }\n");
    const result = runCli(["check", "theme.css"], { cwd });
    expect(result.exitCode).toBe(2);
    expect(result.errorOutput).toContain("version 1");
  });

  test("stores the pair without the line number", () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    runCli(["baseline", "theme.css"], { cwd });
    const saved = readFileSync(join(cwd, "colorwarning-baseline.json"), "utf8");
    expect(saved).toContain("\"file\": \"theme.css\"");
    expect(saved).toContain("\"verdict\": \"cvd-contrast\"");
    expect(saved).not.toContain("\"line\"");
  });
});
