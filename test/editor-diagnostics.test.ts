import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";
import {
  editorDiagnostics,
  editorWatches,
  findBaselineDirectory,
} from "../src/editor-diagnostics.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const redOnBlack = ".bad { color: #ff0000; background-color: #000000; }\n";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "colorwarning-"));
}

describe("editor diagnostics", () => {
  test("warns for the fixture color-vision pairs", () => {
    const filename = join(root, "test/fixtures/theme.css");
    const diagnostics = editorDiagnostics(filename, readFileSync(filename, "utf8"), null);
    expect(diagnostics.map((item) => item.line)).toEqual([15, 5]);
    expect(diagnostics[0]?.message).toContain("#ff0000 on #000000 fails color-vision contrast under protanopia");
    expect(diagnostics[0]?.word).toBe("#ff0000");
    expect(diagnostics[1]?.message).toContain("#2e7d32 (--success) and #d32f2f (--error) collide under deuteranopia");
    expect(diagnostics[1]?.word).toBe("#d32f2f");
    expect(diagnostics.map((item) => item.message).join("\n")).not.toContain("#777777");
  });

  test("stays quiet for a passing pair, an ordinary failure, an unknown variable, and an ignore comment", () => {
    const cwd = workspace();
    const file = join(cwd, "theme.css");
    const source = [
      ".ok { color: #111111; background-color: #ffffff; }",
      ".faint { color: #777777; background-color: #ffffff; }",
      ".broken { color: var(--nope); background-color: white; }",
      "/* colorwarning-ignore */",
      redOnBlack,
    ].join("\n");
    writeFileSync(file, source);
    expect(editorDiagnostics(file, source, null)).toEqual([]);
  });

  test("stays quiet for a baselined pair and still warns when the baseline is unreadable", () => {
    const cwd = workspace();
    const file = join(cwd, "theme.css");
    writeFileSync(file, redOnBlack);
    expect(runCli(["baseline", "theme.css"], { cwd }).exitCode).toBe(0);
    expect(editorDiagnostics(file, readFileSync(file, "utf8"), cwd)).toEqual([]);

    writeFileSync(join(cwd, "colorwarning-baseline.json"), "{ \"version\": 2 }\n");
    const diagnostics = editorDiagnostics(file, redOnBlack, cwd);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain("protanopia");
  });

  test("finds a baseline above the file and reads a token file", () => {
    const cwd = workspace();
    const nested = join(cwd, "src");
    writeFileSync(join(cwd, "colorwarning-baseline.json"), "{ \"version\": 1, \"findings\": [] }\n");
    expect(findBaselineDirectory(join(nested, "theme.css"))).toBe(cwd);
    expect(findBaselineDirectory(join(cwd, "missing.css"))).toBe(cwd);

    const tokens = join(root, "test/fixtures/tokens.json");
    const diagnostics = editorDiagnostics(tokens, readFileSync(tokens, "utf8"), null);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain("deuteranopia");
  });

  test("skips installed files, built files, and files this check does not read", () => {
    expect(editorWatches("src/theme.css")).toBe(true);
    expect(editorWatches("tokens.json")).toBe(true);
    expect(editorWatches("tailwind.config.ts")).toBe(true);
    expect(editorWatches("node_modules/pkg/theme.css")).toBe(false);
    expect(editorWatches("dist/theme.css")).toBe(false);
    expect(editorWatches("styles.scss")).toBe(false);
    expect(findBaselineDirectory(join(workspace(), "theme.css"))).toBeNull();
    expect(editorDiagnostics(join(workspace(), "notes.md"), redOnBlack, null)).toEqual([]);
  });

  test("the Marketplace package points at ConnerBrunner and the packed checker", () => {
    const manifest = JSON.parse(readFileSync(join(root, "vscode/package.json"), "utf8"));
    const extension = readFileSync(join(root, "vscode/extension.js"), "utf8");
    expect(manifest.publisher).toBe("ConnerBrunner");
    expect(manifest.version).toBe("0.0.1");
    expect(extension).toContain("./lib/editor-diagnostics.js");
    expect(existsSync(join(root, "vscode/lib/editor-diagnostics.js"))).toBe(true);
    expect(existsSync(join(root, "vscode/README.md"))).toBe(true);
    expect(existsSync(join(root, "vscode/LICENSE"))).toBe(true);
  });
});
