import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { formatFinding, runCli } from "../src/cli.js";
import type { CheckedUse } from "../src/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const theme = join(root, "test/fixtures/theme.css");

describe("colorwarning check", () => {
  test("prints the file, line, colors, both ratios, and the deficiency", () => {
    const use: CheckedUse = {
      status: "checked",
      kind: "text-background",
      line: 14,
      selector: ".red-on-black",
      firstName: null,
      secondName: null,
      first: "#ff0000",
      second: "#000000",
      firstPaint: { r: 1, g: 0, b: 0, alpha: 1 },
      secondPaint: { r: 0, g: 0, b: 0, alpha: 1 },
      verdict: "cvd-contrast",
      normal: 5.252,
      simulated: 3.285,
      deficiency: "protanopia",
    };
    expect(formatFinding("theme.css", use)).toBe(
      [
        "theme.css:14 .red-on-black",
        "  #ff0000 on #000000",
        "  cvd-contrast under protanopia",
        "  contrast 5.25:1, simulated 3.29:1",
      ].join("\n"),
    );
  });

  test("stays quiet when every pair passes", () => {
    const dir = mkdtempSync(join(tmpdir(), "colorwarning-"));
    const file = join(dir, "ok.css");
    writeFileSync(file, "a { color: #111111; background-color: #ffffff; }\n");
    const result = runCli(["check", file]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("no findings\n");
  });

  test("reports the fixture stylesheet", () => {
    const result = runCli(["check", theme]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("cvd-contrast under protanopia");
    expect(result.output).toContain("#ff0000 on #000000");
    expect(result.output).toContain("contrast 5.25:1, simulated ");
    expect(result.output).toContain("cvd-collision under deuteranopia");
    expect(result.output).toContain("unchecked (unresolved-variable)");
    expect(result.output).toContain("unchecked (gradient)");
    expect(result.output).not.toContain(".ok");
  });

  test("rejects a missing command", () => {
    const result = runCli([]);
    expect(result.exitCode).toBe(2);
    expect(result.errorOutput).toContain("usage: colorwarning check <file>...");
  });

  test("runs from the built command", () => {
    const result = spawnSync(process.execPath, ["dist/cli.js", "check", theme], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("cvd-contrast under protanopia");
    expect(result.stdout).toContain(":1");
  });
});
