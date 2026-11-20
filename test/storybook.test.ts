import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { cssFromParameter, panelCards, panelResult, renderPanel, type PanelCard } from "../src/storybook-model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const theme = readFileSync(join(root, "test/fixtures/theme.css"), "utf8");

describe("Storybook panel", () => {
  test("shows the fixture findings as original and simulated swatches", () => {
    const cards = panelCards(theme);
    expect(cards.map((card) => card.deficiency)).toEqual(["protanopia", "deuteranopia"]);
    expect(cards[0]).toMatchObject({
      kind: "text-background",
      label: ".red-on-black",
      originalFirst: "#ff0000",
      originalSecond: "#000000",
    });
    expect(cards[0]?.simulatedFirst).not.toBe("#ff0000");
    expect(cards[0]?.simulatedSecond).toBe("#000000");
    expect(cards[1]).toMatchObject({
      kind: "status",
      label: "--success / --error",
      deficiency: "deuteranopia",
    });

    const result = panelResult(theme);
    expect(result.count).toBe(2);
    expect(result.html).toContain(">Aa<");
    expect(result.html).toContain("original");
    expect(result.html).toContain("protanopia");
    expect(result.html).toContain("deuteranopia");
    expect(result.html).toContain("background:#000000");
    expect(result.html).toContain("color:#ff0000");
    expect(result.html).not.toContain("#777777");
    expect(result.html).not.toContain("unresolved-variable");
  });

  test("stays quiet for a passing pair, an ordinary contrast failure, and an ignored pair", () => {
    expect(panelCards(".ok { color: #111111; background-color: #ffffff; }")).toEqual([]);
    expect(panelCards(".faint { color: #777777; background-color: #ffffff; }")).toEqual([]);
    expect(panelCards(".broken { color: var(--nope); background-color: white; }")).toEqual([]);
    const ignored = panelResult(".red { /* colorwarning-ignore */\n  color: #ff0000;\n  background-color: #000000;\n}\n");
    expect(ignored.count).toBe(0);
    expect(ignored.html).toContain("No color-vision findings.");
  });

  test("reads a string or a css field and explains a missing or broken parameter", () => {
    expect(cssFromParameter(".a {}")).toBe(".a {}");
    expect(cssFromParameter({ css: ".a {}" })).toBe(".a {}");
    expect(cssFromParameter({ disable: true })).toBeNull();
    expect(panelResult(undefined).html).toContain("parameters.colorwarning");
    expect(panelResult("{").html).toContain("could not be read");
  });

  test("escapes text that comes from the stylesheet", () => {
    const card: PanelCard = {
      kind: "text-background",
      label: `<img src=x onerror=alert(1)>`,
      deficiency: "protanopia",
      detail: `<script>alert(1)</script>`,
      originalFirst: "#ff0000",
      originalSecond: "#000000",
      simulatedFirst: "#00ff00",
      simulatedSecond: "#000000",
    };
    const html = renderPanel([card]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });

  test("warns once for Bootstrap and stays quiet for Material", () => {
    const bootstrap = panelCards(readFileSync(join(root, "scan/bootstrap.css"), "utf8"));
    const material = panelResult(readFileSync(join(root, "scan/material.css"), "utf8"));
    expect(bootstrap).toHaveLength(1);
    expect(bootstrap[0]?.deficiency).toBe("deuteranopia");
    expect(bootstrap[0]?.detail).toContain("#198754 (--bs-success)");
    expect(bootstrap[0]?.detail).toContain("#dc3545 (--bs-danger)");
    expect(material.count).toBe(0);
    expect(material.html).toContain("No color-vision findings.");
  });

  test("points Storybook at the manager and the preview", () => {
    const preset = pathToFileURL(join(root, "storybook/preset.js")).href;
    const script = [
      `import { managerEntries, previewAnnotations } from ${JSON.stringify(preset)};`,
      `import { existsSync } from "node:fs";`,
      `import { fileURLToPath } from "node:url";`,
      `const manager = managerEntries(["keep"]);`,
      `const preview = previewAnnotations(["keep"]);`,
      `if (manager[0] !== "keep" || preview[0] !== "keep") process.exit(2);`,
      `if (!String(manager[1]).endsWith("manager.js") || !existsSync(fileURLToPath(manager[1]))) process.exit(3);`,
      `if (!String(preview[1]).endsWith("preview.js") || !existsSync(fileURLToPath(preview[1]))) process.exit(4);`,
    ].join("");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
    expect(result.status).toBe(0);
  });
});
