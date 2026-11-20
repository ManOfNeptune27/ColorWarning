import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "vscode", "lib");
const files = [
  "editor-diagnostics.js",
  "baseline.js",
  "extract.js",
  "extract-css.js",
  "extract-tailwind.js",
  "extract-tokens.js",
  "ignore.js",
  "color-use.js",
  "color.js",
  "contrast.js",
  "simulate.js",
  "verdicts.js",
  "resolve-color.js",
  "named-colors.js",
];

mkdirSync(destination, { recursive: true });
for (const file of files) {
  copyFileSync(join(root, "dist", file), join(destination, file));
}
copyFileSync(join(root, "LICENSE"), join(root, "vscode", "LICENSE"));
