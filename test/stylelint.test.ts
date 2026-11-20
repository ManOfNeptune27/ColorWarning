import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import stylelint from "stylelint";
import { describe, expect, test } from "vitest";
import plugin, { messages, ruleName } from "../src/stylelint.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const theme = join(root, "test/fixtures/theme.css");

function config(primary: unknown = true): stylelint.Config {
  return {
    plugins: [plugin],
    rules: { [ruleName]: primary as never },
  };
}

async function lintCode(code: string, primary: unknown = true) {
  const result = await stylelint.lint({ code, config: config(primary) });
  return { result, warnings: result.results.flatMap((item) => item.warnings) };
}

describe("colorwarning/color-vision", () => {
  test("warns on the fixture stylesheet and does not fail the run", async () => {
    const result = await stylelint.lint({ files: theme, config: config() });
    const warnings = result.results.flatMap((item) => item.warnings);

    expect(result.errored).toBe(false);
    expect(warnings).toHaveLength(2);
    expect(warnings.map((warning) => warning.severity)).toEqual(["warning", "warning"]);
    expect(warnings.map((warning) => warning.rule)).toEqual([ruleName, ruleName]);
    expect(warnings.map((warning) => warning.line)).toEqual([15, 5]);
    expect(warnings.map((warning) => warning.text).join("\n")).toContain(
      messages.cvdContrast("#ff0000", "#000000", "protanopia", "5.25", "3.29"),
    );
    expect(warnings.map((warning) => warning.text).join("\n")).toContain(
      "#2e7d32 (--success) and #d32f2f (--error) collide under deuteranopia",
    );
  });

  test("stays a warning when the config asks for an error", async () => {
    const { result, warnings } = await lintCode(".red { color: #ff0000; background-color: #000000; }\n", [
      true,
      { severity: "error" },
    ]);
    expect(result.errored).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe("warning");
  });

  test("stays quiet for a passing pair, an ordinary contrast failure, and an unknown variable", async () => {
    const { warnings } = await lintCode(
      [
        ".ok { color: #111111; background-color: #ffffff; }",
        ".faint { color: #777777; background-color: #ffffff; }",
        ".broken { color: var(--nope); background-color: white; }",
      ].join("\n"),
    );
    expect(warnings).toHaveLength(0);
  });

  test("honors colorwarning-ignore and a Stylelint disable comment", async () => {
    const ignored = await lintCode(".red { /* colorwarning-ignore */\n  color: #ff0000;\n  background-color: #000000;\n}\n");
    expect(ignored.warnings).toHaveLength(0);

    const disabled = await lintCode(
      "/* stylelint-disable colorwarning/color-vision */\n.red { color: #ff0000; background-color: #000000; }\n",
    );
    expect(disabled.warnings).toHaveLength(0);
  });

  test("rejects an option that is not true", async () => {
    const { result, warnings } = await lintCode(".red { color: #ff0000; background-color: #000000; }\n", "nope");
    expect(warnings).toHaveLength(0);
    expect(result.results[0]?.invalidOptionWarnings.length).toBeGreaterThan(0);
  });

  test("loads the built plugin", async () => {
    const result = await stylelint.lint({
      code: ".red { color: #ff0000; background-color: #000000; }\n",
      config: {
        plugins: [join(root, "dist/stylelint.js")],
        rules: { [ruleName]: true },
      },
    });
    const warnings = result.results.flatMap((item) => item.warnings);
    expect(result.errored).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.severity).toBe("warning");
    expect(warnings[0]?.text).toContain("protanopia");
  });

  test("warns for Bootstrap success and danger and stays quiet for Material", async () => {
    const bootstrap = await stylelint.lint({
      files: join(root, "scan/bootstrap.css"),
      config: config(),
    });
    const material = await stylelint.lint({
      files: join(root, "scan/material.css"),
      config: config(),
    });
    const bootstrapWarnings = bootstrap.results.flatMap((item) => item.warnings);
    const materialWarnings = material.results.flatMap((item) => item.warnings);

    expect(bootstrap.errored).toBe(false);
    expect(bootstrapWarnings).toHaveLength(1);
    expect(bootstrapWarnings[0]?.text).toContain("deuteranopia");
    expect(bootstrapWarnings[0]?.text).toContain("#198754 (--bs-success)");
    expect(bootstrapWarnings[0]?.text).toContain("#dc3545 (--bs-danger)");
    expect(materialWarnings).toHaveLength(0);
  });
});
