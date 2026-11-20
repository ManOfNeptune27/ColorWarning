import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";
import { sampleOrigin, swatchMetrics } from "../src/swatch.js";

const redOnBlack = ".bad { color: #ff0000; background-color: #000000; }\n";

function workspace(): string {
  return mkdtempSync(join(tmpdir(), "colorwarning-"));
}

describe("colorwarning swatch", () => {
  test("draws the original pair and the simulated pair", () => {
    const cwd = workspace();
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    const result = runCli(["swatch", "theme.css"], { cwd });
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("wrote colorwarning-swatch.png (1 pair)\n");

    const image = readPng(readFileSync(join(cwd, "colorwarning-swatch.png")));
    expect(image.width).toBe(swatchMetrics.width);
    expect(image.height).toBe(swatchMetrics.cardHeight);

    const origin = sampleOrigin(swatchMetrics.panel.x, swatchMetrics.panel.y);
    const text = at(image, origin.x + swatchMetrics.sampleScale, origin.y);
    const background = at(image, swatchMetrics.panel.x + 1, swatchMetrics.panel.y + 1);
    expect(text).toEqual([255, 0, 0]);
    expect(background).toEqual([0, 0, 0]);

    const rightX = swatchMetrics.panel.x + swatchMetrics.panel.width + swatchMetrics.panelGap;
    const simulated = sampleOrigin(rightX, swatchMetrics.panel.y);
    const simulatedText = at(image, simulated.x + swatchMetrics.sampleScale, simulated.y);
    const simulatedBackground = at(image, rightX + 1, swatchMetrics.panel.y + 1);
    expect(simulatedText).not.toEqual([255, 0, 0]);
    expect(simulatedBackground).toEqual([0, 0, 0]);
  });

  test("draws a variable pair from the colors that were measured", () => {
    const cwd = workspace();
    writeFileSync(
      join(cwd, "theme.css"),
      ":root { --hot: #ff0000; --paper: #000000; }\n.bad { color: var(--hot); background-color: var(--paper); }\n",
    );
    const result = runCli(["swatch", "theme.css"], { cwd });
    expect(result.output).toBe("wrote colorwarning-swatch.png (1 pair)\n");
    const image = readPng(readFileSync(join(cwd, "colorwarning-swatch.png")));
    const origin = sampleOrigin(swatchMetrics.panel.x, swatchMetrics.panel.y);
    expect(at(image, origin.x + swatchMetrics.sampleScale, origin.y)).toEqual([255, 0, 0]);
  });

  test("draws status colors side by side and leaves an ordinary contrast failure out", () => {
    const cwd = workspace();
    writeFileSync(
      join(cwd, "theme.css"),
      [
        ":root { --success: #2e7d32; --error: #d32f2f; }",
        ".faint { color: #777777; background-color: #ffffff; }",
        "",
      ].join("\n"),
    );
    const result = runCli(["swatch", "theme.css"], { cwd });
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("wrote colorwarning-swatch.png (1 pair)\n");

    const image = readPng(readFileSync(join(cwd, "colorwarning-swatch.png")));
    expect(image.height).toBe(swatchMetrics.cardHeight);
    const y = swatchMetrics.panel.y + 4;
    const mid = Math.floor(swatchMetrics.panel.width / 2);
    expect(at(image, swatchMetrics.panel.x + 4, y)).toEqual([0x2e, 0x7d, 0x32]);
    expect(at(image, swatchMetrics.panel.x + mid + 4, y)).toEqual([0xd3, 0x2f, 0x2f]);

    const rightX = swatchMetrics.panel.x + swatchMetrics.panel.width + swatchMetrics.panelGap;
    expect(at(image, rightX + 4, y)).not.toEqual([0x2e, 0x7d, 0x32]);
    expect(at(image, rightX + mid + 4, y)).not.toEqual([0xd3, 0x2f, 0x2f]);
  });

  test("stays quiet for a baselined or ignored pair and removes a stale picture", () => {
    const cwd = workspace();
    const png = join(cwd, "colorwarning-swatch.png");
    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    expect(runCli(["swatch", "theme.css"], { cwd }).exitCode).toBe(0);
    expect(existsSync(png)).toBe(true);

    expect(runCli(["baseline", "theme.css"], { cwd }).exitCode).toBe(0);
    const quiet = runCli(["swatch", "theme.css"], { cwd });
    expect(quiet.exitCode).toBe(0);
    expect(quiet.output).toBe("no swatch\n");
    expect(existsSync(png)).toBe(false);

    writeFileSync(join(cwd, "theme.css"), `.bad { color: #ff0000; background-color: #000000; } /* colorwarning-ignore */\n`);
    expect(runCli(["swatch", "theme.css"], { cwd }).output).toBe("no swatch\n");
  });

  test("does not write a picture when a file or the baseline cannot be read", () => {
    const cwd = workspace();
    const missing = runCli(["swatch", "missing.css"], { cwd });
    expect(missing.exitCode).toBe(2);
    expect(existsSync(join(cwd, "colorwarning-swatch.png"))).toBe(false);

    writeFileSync(join(cwd, "theme.css"), redOnBlack);
    writeFileSync(join(cwd, "colorwarning-baseline.json"), "{ \"version\": 2, \"findings\": [] }\n");
    const bad = runCli(["swatch", "theme.css"], { cwd });
    expect(bad.exitCode).toBe(2);
    expect(bad.errorOutput).toContain("version 1");
    expect(existsSync(join(cwd, "colorwarning-swatch.png"))).toBe(false);
  });
});

function readPng(png: Buffer): { width: number; height: number; pixels: Uint8Array } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, 8).equals(signature)) throw new Error("not a png");
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    if (raw[y * (stride + 1)] !== 0) throw new Error("unexpected png filter");
    pixels.set(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), y * stride);
  }
  return { width, height, pixels };
}

function at(image: { width: number; pixels: Uint8Array }, x: number, y: number): number[] {
  const index = (y * image.width + x) * 3;
  return [image.pixels[index] ?? -1, image.pixels[index + 1] ?? -1, image.pixels[index + 2] ?? -1];
}
