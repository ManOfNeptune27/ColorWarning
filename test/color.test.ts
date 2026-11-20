import { describe, expect, test } from "vitest";
import { parseColor } from "../src/index.js";

const red = { r: 1, g: 0, b: 0, alpha: 1 };

describe("parseColor", () => {
  test("parses hex shorthand and full hex", () => {
    expect(parseColor("#f00")).toEqual(red);
    expect(parseColor("#ff0000")).toEqual(red);
    expect(parseColor("#FF0000")).toEqual(red);
    expect(parseColor("  #f00  ")).toEqual(red);
  });

  test("parses hex alpha", () => {
    expect(parseColor("#f00f")).toEqual(red);
    expect(parseColor("#ff000080")?.alpha).toBeCloseTo(128 / 255, 10);
    expect(parseColor("#f008")?.alpha).toBeCloseTo(0x88 / 255, 10);
  });

  test("parses rgb and rgba forms", () => {
    expect(parseColor("rgb(255, 0, 0)")).toEqual(red);
    expect(parseColor("rgb(255 0 0)")).toEqual(red);
    expect(parseColor("rgb(100%, 0%, 0%)")).toEqual(red);
    expect(parseColor("RGB(255,0,0)")).toEqual(red);
    expect(parseColor("rgb(255 0 0 / 0.5)")).toEqual({ ...red, alpha: 0.5 });
    expect(parseColor("rgba(255, 0, 0, 50%)")).toEqual({ ...red, alpha: 0.5 });
  });

  test("parses hsl forms", () => {
    expect(parseColor("hsl(0, 100%, 50%)")).toEqual(red);
    expect(parseColor("hsl(0 100% 50%)")).toEqual(red);
    expect(parseColor("hsl(120 100% 50%)")).toEqual({ r: 0, g: 1, b: 0, alpha: 1 });
    expect(parseColor("hsl(240 100% 50%)")).toEqual({ r: 0, g: 0, b: 1, alpha: 1 });
    expect(parseColor("hsl(0.5turn 100% 50%)")).toEqual({ r: 0, g: 1, b: 1, alpha: 1 });
    expect(parseColor("hsla(0, 100%, 50%, 0.25)")).toEqual({ ...red, alpha: 0.25 });
  });

  test("parses named colors", () => {
    expect(parseColor("red")).toEqual(red);
    expect(parseColor("Rebeccapurple")).toEqual({
      r: 0x66 / 255,
      g: 0x33 / 255,
      b: 0x99 / 255,
      alpha: 1,
    });
    expect(parseColor("grey")).toEqual(parseColor("gray"));
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, alpha: 0 });
  });

  test("rejects values it cannot read", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("nope")).toBeNull();
    expect(parseColor("#gg0000")).toBeNull();
    expect(parseColor("#ff")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("rgb(100% 0 0)")).toBeNull();
    expect(parseColor("hsl(0, 1, 0.5)")).toBeNull();
  });
});
