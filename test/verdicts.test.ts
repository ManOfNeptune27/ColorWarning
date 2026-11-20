import { describe, expect, test } from "vitest";
import { contrastRatio, cvdCollision, cvdContrast, oklabDistance, parseColor, simulate } from "../src/index.js";

function color(input: string) {
  const parsed = parseColor(input);
  if (parsed === null) throw new Error(`could not parse ${input}`);
  return parsed;
}

describe("color-vision verdicts", () => {
  test("warns when red text on black passes AA and fails under protanopia", () => {
    const text = color("#ff0000");
    const background = color("#000000");
    const finding = cvdContrast(text, background);

    expect(finding).toMatchObject({ kind: "cvd-contrast", deficiency: "protanopia" });
    expect(finding?.normal).toBeCloseTo(5.252, 3);
    expect(finding?.simulated).toBeLessThan(4.5);
    expect(contrastRatio(simulate(text, "protanopia"), simulate(background, "protanopia"))).toBeCloseTo(3.29, 2);
  });

  test("stays silent for black text on white", () => {
    expect(cvdContrast(color("#000000"), color("#ffffff"))).toBeNull();
    expect(cvdCollision(color("#000000"), color("#ffffff"))).toBeNull();
  });

  test("does not call an ordinary contrast failure a color-vision failure", () => {
    expect(cvdContrast(color("#777777"), color("#ffffff"))).toBeNull();
  });

  test("flags green and red status colors that collide under deuteranopia", () => {
    const success = color("#2e7d32");
    const error = color("#d32f2f");
    const finding = cvdCollision(success, error);
    const simulated = oklabDistance(simulate(success, "deuteranopia"), simulate(error, "deuteranopia"));

    expect(finding).toMatchObject({ kind: "cvd-collision", deficiency: "deuteranopia" });
    expect(finding?.normalDistance).toBeGreaterThan(0.2);
    expect(simulated).toBeLessThan(0.1);
    expect(finding?.simulatedDistance).toBeCloseTo(simulated, 5);
  });

  test("stays silent when the colors were already hard to tell apart", () => {
    expect(cvdCollision(color("#888888"), color("#808080"))).toBeNull();
  });

  test("does not score translucent colors", () => {
    expect(cvdContrast(color("rgb(255 0 0 / 0.5)"), color("#000"))).toBeNull();
    expect(cvdCollision(color("#2e7d32"), color("rgb(211 47 47 / 0.5)"))).toBeNull();
  });
});
