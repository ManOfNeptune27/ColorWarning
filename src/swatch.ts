import { deflateSync } from "node:zlib";
import type { Srgb } from "./color.js";
import { simulate, type Deficiency } from "./simulate.js";
import type { UseKind } from "./color-use.js";

export const SWATCH_FILENAME = "colorwarning-swatch.png";

/** Geometry of `colorwarning-swatch.png`. Tests sample these pixels. */
export const swatchMetrics = {
  width: 480,
  cardHeight: 148,
  panel: { x: 16, y: 38, width: 216, height: 72 },
  panelGap: 16,
  sampleScale: 4,
} as const;

export type SwatchPair = {
  kind: UseKind;
  label: string;
  deficiency: Deficiency;
  first: Srgb;
  second: Srgb;
};

const page: Rgb = [243, 243, 243];
const ink: Rgb = [34, 34, 34];
const border: Rgb = [189, 189, 189];

type Rgb = [number, number, number];

const { width: WIDTH, cardHeight: CARD_HEIGHT, panel: PANEL, panelGap: PANEL_GAP, sampleScale: SAMPLE_SCALE } =
  swatchMetrics;

/**
 * Draw each pair twice: the original colors, then the same colors under the failing deficiency.
 * Text sits on its background. Status colors sit side by side.
 */
export function renderSwatch(pairs: readonly SwatchPair[]): Buffer {
  if (pairs.length === 0) throw new Error("a swatch needs at least one pair");
  const canvas = new Canvas(WIDTH, pairs.length * CARD_HEIGHT, page);
  pairs.forEach((pair, index) => drawCard(canvas, pair, index * CARD_HEIGHT));
  return canvas.png();
}

function drawCard(canvas: Canvas, pair: SwatchPair, top: number): void {
  const panelY = top + PANEL.y;
  drawText(canvas, pair.label, PANEL.x, top + 16, ink, 2, WIDTH - PANEL.x);
  drawPanel(canvas, pair.kind, pair.first, pair.second, PANEL.x, panelY);
  const rightX = PANEL.x + PANEL.width + PANEL_GAP;
  drawPanel(
    canvas,
    pair.kind,
    simulate(pair.first, pair.deficiency),
    simulate(pair.second, pair.deficiency),
    rightX,
    panelY,
  );
  const captionY = panelY + PANEL.height + 8;
  centerText(canvas, "original", PANEL.x, captionY);
  centerText(canvas, pair.deficiency, rightX, captionY);
}

function drawPanel(canvas: Canvas, kind: UseKind, first: Srgb, second: Srgb, x: number, y: number): void {
  canvas.fillRect(x, y, PANEL.width, PANEL.height, border);
  if (kind === "status") {
    const mid = Math.floor(PANEL.width / 2);
    canvas.fillRect(x + 1, y + 1, mid - 2, PANEL.height - 2, rgb(first));
    canvas.fillRect(x + mid + 1, y + 1, PANEL.width - mid - 2, PANEL.height - 2, rgb(second));
    return;
  }
  canvas.fillRect(x + 1, y + 1, PANEL.width - 2, PANEL.height - 2, rgb(second));
  const origin = sampleOrigin(x, y);
  drawText(canvas, "Aa", origin.x, origin.y, rgb(first), SAMPLE_SCALE, x + PANEL.width);
}

/** Top-left of the "Aa" sample inside a text panel. */
export function sampleOrigin(panelX: number, panelY: number): { x: number; y: number } {
  const sampleWidth = 2 * 6 * SAMPLE_SCALE;
  const sampleHeight = 7 * SAMPLE_SCALE;
  return {
    x: panelX + Math.floor((PANEL.width - sampleWidth) / 2),
    y: panelY + Math.floor((PANEL.height - sampleHeight) / 2),
  };
}

function centerText(canvas: Canvas, text: string, panelX: number, y: number): void {
  const textWidth = text.length * 12;
  const x = panelX + Math.floor((PANEL.width - textWidth) / 2);
  drawText(canvas, text, x, y, ink, 2, panelX + PANEL.width);
}

function drawText(canvas: Canvas, text: string, x: number, y: number, color: Rgb, scale: number, limit: number): void {
  let cursor = x;
  for (const char of text) {
    if (cursor + 5 * scale > limit) return;
    const rows = glyphs[char];
    if (rows !== undefined) {
      for (let row = 0; row < 7; row++) {
        const bits = rows[row] ?? 0;
        for (let col = 0; col < 5; col++) {
          if ((bits & (1 << (4 - col))) === 0) continue;
          canvas.fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cursor += 6 * scale;
  }
}

class Canvas {
  private readonly pixels: Uint8Array;

  constructor(
    private readonly width: number,
    private readonly height: number,
    background: Rgb,
  ) {
    this.pixels = new Uint8Array(width * height * 3);
    this.fillRect(0, 0, width, height, background);
  }

  fillRect(x: number, y: number, w: number, h: number, color: Rgb): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.width, x + w);
    const y1 = Math.min(this.height, y + h);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const index = (py * this.width + px) * 3;
        this.pixels[index] = color[0];
        this.pixels[index + 1] = color[1];
        this.pixels[index + 2] = color[2];
      }
    }
  }

  png(): Buffer {
    return encodePng(this.width, this.height, this.pixels);
  }
}

function rgb(color: Srgb): Rgb {
  return [byte(color.r), byte(color.g), byte(color.b)];
}

function byte(channel: number): number {
  return Math.round(Math.min(1, Math.max(0, channel)) * 255);
}

function encodePng(width: number, height: number, pixels: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const dest = y * (stride + 1);
    raw[dest] = 0;
    for (let i = 0; i < stride; i++) raw[dest + 1 + i] = pixels[y * stride + i] ?? 0;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const value of data) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) {
      const mask = (crc & 1) === 1 ? 0xedb88320 : 0;
      crc = (crc >>> 1) ^ mask;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 5×7 glyphs. Each row is five bits, and the high bit is the left pixel. */
const glyphs: Record<string, readonly number[]> = parseGlyphs(`
sp 00000 00000 00000 00000 00000 00000 00000
. 00000 00000 00000 00000 00000 01100 01100
: 00000 01100 01100 00000 01100 01100 00000
# 01010 01010 11111 01010 11111 01010 01010
- 00000 00000 00000 11111 00000 00000 00000
/ 00001 00010 00010 00100 01000 01000 10000
_ 00000 00000 00000 00000 00000 00000 11111
0 01110 10001 10011 10101 11001 10001 01110
1 00100 01100 00100 00100 00100 00100 01110
2 01110 10001 00001 00010 00100 01000 11111
3 11111 00010 00100 00010 00001 10001 01110
4 00010 00110 01010 10010 11111 00010 00010
5 11111 10000 11110 00001 00001 10001 01110
6 00110 01000 10000 11110 10001 10001 01110
7 11111 00001 00010 00100 01000 01000 01000
8 01110 10001 10001 01110 10001 10001 01110
9 01110 10001 10001 01111 00001 00010 01100
A 01110 10001 10001 11111 10001 10001 10001
B 11110 10001 10001 11110 10001 10001 11110
C 01110 10001 10000 10000 10000 10001 01110
D 11110 10001 10001 10001 10001 10001 11110
E 11111 10000 10000 11110 10000 10000 11111
F 11111 10000 10000 11110 10000 10000 10000
G 01110 10001 10000 10111 10001 10001 01111
H 10001 10001 10001 11111 10001 10001 10001
I 01110 00100 00100 00100 00100 00100 01110
J 00111 00010 00010 00010 00010 10010 01100
K 10001 10010 10100 11000 10100 10010 10001
L 10000 10000 10000 10000 10000 10000 11111
M 10001 11011 10101 10101 10001 10001 10001
N 10001 11001 10101 10011 10001 10001 10001
O 01110 10001 10001 10001 10001 10001 01110
P 11110 10001 10001 11110 10000 10000 10000
Q 01110 10001 10001 10001 10101 10010 01101
R 11110 10001 10001 11110 10100 10010 10001
S 01111 10000 10000 01110 00001 00001 11110
T 11111 00100 00100 00100 00100 00100 00100
U 10001 10001 10001 10001 10001 10001 01110
V 10001 10001 10001 10001 10001 01010 00100
W 10001 10001 10001 10101 10101 10101 01010
X 10001 10001 01010 00100 01010 10001 10001
Y 10001 10001 01010 00100 00100 00100 00100
Z 11111 00001 00010 00100 01000 10000 11111
a 00000 00000 01110 00001 01111 10001 01111
b 10000 10000 11110 10001 10001 10001 11110
c 00000 00000 01110 10000 10000 10001 01110
d 00001 00001 01111 10001 10001 10001 01111
e 00000 00000 01110 10001 11111 10000 01110
f 00110 01001 01000 11100 01000 01000 01000
g 00000 01111 10001 10001 01111 00001 01110
h 10000 10000 11110 10001 10001 10001 10001
i 00100 00000 01100 00100 00100 00100 01110
j 00010 00000 00010 00010 00010 10010 01100
k 10000 10000 10010 10100 11000 10100 10010
l 01100 00100 00100 00100 00100 00100 01110
m 00000 00000 11010 10101 10101 10001 10001
n 00000 00000 11110 10001 10001 10001 10001
o 00000 00000 01110 10001 10001 10001 01110
p 00000 11110 10001 10001 11110 10000 10000
q 00000 01111 10001 10001 01111 00001 00001
r 00000 00000 10110 11000 10000 10000 10000
s 00000 00000 01111 10000 01110 00001 11110
t 01000 01000 11100 01000 01000 01001 00110
u 00000 00000 10001 10001 10001 10011 01101
v 00000 00000 10001 10001 10001 01010 00100
w 00000 00000 10001 10001 10101 10101 01010
x 00000 00000 10001 01010 00100 01010 10001
y 00000 10001 10001 10001 01111 00001 01110
z 00000 00000 11111 00010 00100 01000 11111
`);

function parseGlyphs(atlas: string): Record<string, readonly number[]> {
  const parsed: Record<string, number[]> = {};
  for (const line of atlas.trim().split("\n")) {
    const parts = line.trim().split(/\s+/);
    const name = parts[0];
    const rows = parts.slice(1);
    if (name === undefined || rows.length !== 7) continue;
    parsed[name === "sp" ? " " : name] = rows.map((row) => Number.parseInt(row, 2));
  }
  return parsed;
}
