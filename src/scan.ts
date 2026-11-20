import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./cli.js";

type Library = {
  name: string;
  file: string;
  note: string;
  sources: readonly string[];
};

const libraries: readonly Library[] = [
  {
    name: "Bootstrap",
    file: "bootstrap.css",
    note: "The light theme custom properties in Bootstrap 5.3.8.",
    sources: ["https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.css"],
  },
  {
    name: "Material",
    file: "material.css",
    note: "Default theme custom properties from @material/theme 14.0.0, including error and on-error.",
    sources: ["https://cdn.jsdelivr.net/npm/@material/theme@14.0.0/dist/mdc.theme.css"],
  },
  {
    name: "Radix",
    file: "radix.css",
    note: "sRGB light scales for green, red, yellow, and blue from Radix Colors 3.0.0. These scales are named by hue and step, such as --green-9 and --red-9.",
    sources: [
      "https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/green.css",
      "https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/red.css",
      "https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/yellow.css",
      "https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/blue.css",
    ],
  },
  {
    name: "shadcn",
    file: "shadcn.css",
    note: "Default light theme tokens from shadcn/ui. The values use oklch().",
    sources: ["https://github.com/shadcn-ui/ui/blob/main/apps/v4/app/globals.css"],
  },
];

/** Directory of the committed library excerpts, next to both `src/` and `dist/`. */
export function scanDirectory(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "scan");
}

/** Markdown report of the four published themes. A finding here does not fail the command. */
export function renderScan(directory = scanDirectory()): string {
  const sections = libraries.map((library) => {
    const result = runCli(["check", library.file], { cwd: directory });
    const report = `${result.output}${result.errorOutput}`.trimEnd();
    return `## ${library.name}\n\n${library.note}\n\n${library.sources.join("\n")}\n\n${report}`;
  });
  const intro =
    "ColorWarning read the published colors of Bootstrap, Material, Radix, and shadcn. Passing pairs stay quiet.";
  return `# Public scan\n\n${intro}\n\n${sections.join("\n\n")}\n`;
}
