import { describe, expect, test } from "vitest";
import { contrastRatio, meetsAaNormalText, parseColor, relativeLuminance } from "../src/index.js";

function ratio(foreground: string, background: string): number | null {
  const a = parseColor(foreground);
  const b = parseColor(background);
  if (a === null || b === null) throw new Error(`could not parse ${foreground} or ${background}`);
  return contrastRatio(a, b);
}

describe("contrast", () => {
  test("measures black and white as 21 to 1", () => {
    expect(ratio("#000000", "#ffffff")).toBe(21);
    expect(ratio("white", "black")).toBe(21);
    expect(relativeLuminance(parseColor("#000000")!)).toBe(0);
    expect(relativeLuminance(parseColor("#ffffff")!)).toBe(1);
  });

  test("measures identical colors as 1 to 1", () => {
    expect(ratio("#ff0000", "hsl(0 100% 50%)")).toBe(1);
  });

  test("measures pure red on black above the published ratio", () => {
    expect(ratio("#ff0000", "#000000")).toBeCloseTo(5.252, 3);
  });

  test("applies the AA 4.5 to 1 line for normal text", () => {
    const passing = ratio("#767676", "#ffffff");
    const failing = ratio("#777777", "#ffffff");
    expect(passing).not.toBeNull();
    expect(failing).not.toBeNull();
    expect(meetsAaNormalText(passing!)).toBe(true);
    expect(meetsAaNormalText(failing!)).toBe(false);
    expect(meetsAaNormalText(4.5)).toBe(true);
    expect(meetsAaNormalText(4.49)).toBe(false);
  });

  test("does not score a translucent color", () => {
    expect(ratio("rgb(255 0 0 / 0.5)", "#ffffff")).toBeNull();
    expect(ratio("#fff", "transparent")).toBeNull();
  });
});
