import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { extractCss, extractFile, extractSource, extractTokens } from "../src/index.js";
import type { ColorUse } from "../src/index.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function checked(uses: ColorUse[], verdict: string, selectorOrName: string): ColorUse | undefined {
  return uses.find((use) => {
    if (use.status !== "checked" || use.verdict !== verdict) return false;
    return use.selector === selectorOrName || use.firstName === selectorOrName;
  });
}

describe("extract files", () => {
  test("reads a stylesheet", () => {
    const uses = extractFile(join(fixtures, "theme.css"));

    expect(checked(uses, "pass", ".ok")).toMatchObject({ first: "var(--ink)", second: "var(--paper)" });
    expect(checked(uses, "cvd-contrast", ".red-on-black")).toMatchObject({ deficiency: "protanopia" });
    expect(checked(uses, "pass", ".inherit")).toMatchObject({ second: "#ffffff" });
    expect(checked(uses, "cvd-collision", "--success")).toMatchObject({ secondName: "--error" });

    expect(uses).toContainEqual(expect.objectContaining({ selector: ".broken", reason: "unresolved-variable" }));
    expect(uses).toContainEqual(expect.objectContaining({ selector: ".fade", reason: "gradient" }));
    expect(uses).toContainEqual(expect.objectContaining({ selector: ".photo", reason: "image" }));
    expect(uses).toContainEqual(expect.objectContaining({ firstName: "--danger", reason: "unresolved-variable" }));
    expect(uses.find((use) => use.selector === ".broken")?.status).toBe("unchecked");
  });

  test("uses a custom property fallback and the page background", () => {
    const uses = extractCss(`
      .fallback { color: var(--missing, #ff0000); background-color: #000000; }
      .plain { color: currentColor; background-color: white; }
      .alone { color: #111111; }
    `);
    expect(checked(uses, "cvd-contrast", ".fallback")).toMatchObject({ deficiency: "protanopia" });
    expect(uses).toContainEqual(expect.objectContaining({ selector: ".plain", reason: "current-color" }));
    expect(uses).toContainEqual(expect.objectContaining({ selector: ".alone", reason: "missing-background" }));
  });

  test("pairs role names in a token-only stylesheet", () => {
    const uses = extractCss(`@theme {\n  --text: #111111;\n  --background: #ffffff;\n}\n`);
    expect(checked(uses, "pass", "--text")).toMatchObject({ secondName: "--background" });
  });

  test("reads a JSON token file", () => {
    const uses = extractFile(join(fixtures, "tokens.json"));
    expect(checked(uses, "pass", "color-text")).toMatchObject({ secondName: "color-background" });
    expect(checked(uses, "cvd-collision", "color-success")).toMatchObject({ secondName: "color-error" });
  });

  test("leaves a gradient token unchecked", () => {
    const uses = extractTokens(`{ "text": "#111111", "background": "linear-gradient(red, blue)" }`);
    expect(uses).toContainEqual(
      expect.objectContaining({ firstName: "background", reason: "gradient", status: "unchecked" }),
    );
  });

  test("reads a static Tailwind theme", () => {
    const uses = extractFile(join(fixtures, "tailwind.config.js"));
    expect(checked(uses, "pass", "ink")).toMatchObject({ secondName: "paper" });
    expect(checked(uses, "cvd-collision", "success")).toMatchObject({ secondName: "error" });
    expect(checked(uses, "pass", "primary.foreground")).toMatchObject({ secondName: "primary" });
    expect(uses).toContainEqual(expect.objectContaining({ firstName: "danger", reason: "unreadable", status: "unchecked" }));
  });

  test("rejects an unsupported filename", () => {
    expect(() => extractSource("styles.scss", "a { color: red; }")).toThrow(/unsupported file/);
  });

  test("marks an ordinary contrast failure as checked", () => {
    const css = readFileSync(join(fixtures, "theme.css"), "utf8");
    expect(css).toContain("--ink");
    const uses = extractCss(".faint { color: #777777; background-color: #ffffff; }");
    expect(checked(uses, "contrast", ".faint")).toBeDefined();
  });
});
