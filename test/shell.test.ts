import { describe, expect, test } from "vitest";
import { packageName } from "../src/index.js";

describe("package shell", () => {
  test("loads the package name", () => {
    expect(packageName).toBe("colorwarning");
  });
});
