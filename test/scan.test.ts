import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";
import { renderScan } from "../src/scan.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("public scan", () => {
  test("publishes the Bootstrap collision and exits 0", () => {
    const result = runCli(["scan"]);
    expect(result.exitCode).toBe(0);
    expect(result.errorOutput).toBe("");
    expect(result.output).toContain("Bootstrap 5.3.8");
    expect(result.output).toContain("deuteranopia");
    expect(result.output).toContain("#198754 and #dc3545");
  });

  test("rejects extra arguments", () => {
    const result = runCli(["scan", "x"]);
    expect(result.exitCode).toBe(2);
    expect(result.errorOutput).toContain("colorwarning scan");
  });

  test("matches the committed report", () => {
    expect(renderScan()).toBe(readFileSync(join(root, "SCAN.md"), "utf8"));
  });
});
