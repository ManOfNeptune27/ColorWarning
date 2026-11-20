import postcss, { type Declaration, type Root, type Rule } from "postcss";
import { usesFromTokens, textOnBackground, type ColorUse, type SourceToken } from "./color-use.js";
import { resolvePaint } from "./resolve-color.js";

type RawValue = { value: string; line: number };

/** Read text and background pairs from one stylesheet, including custom properties in that file. */
export function extractCss(source: string): ColorUse[] {
  const root = postcss.parse(source);
  const globals = new Map<string, RawValue>();

  root.walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    const parent = decl.parent;
    if (parent?.type === "rule" && isGlobalSelector(parent.selector)) {
      globals.set(decl.prop, { value: decl.value, line: lineOf(decl) });
    }
    if (parent?.type === "atrule" && parent.name.toLowerCase() === "theme") {
      globals.set(decl.prop, { value: decl.value, line: lineOf(decl) });
    }
  });

  const variables = new Map<string, string>();
  for (const [name, entry] of globals) variables.set(name, entry.value);

  const pageBackground = findPageBackground(root, variables);
  const uses: ColorUse[] = [];
  let sawColorRule = false;

  root.walkRules((rule) => {
    const colorDecl = directDecl(rule, "color");
    if (colorDecl === null) return;
    sawColorRule = true;
    const local = new Map(variables);
    for (const node of rule.nodes ?? []) {
      if (node.type === "decl" && node.prop.startsWith("--")) local.set(node.prop, node.value);
    }
    uses.push(useFromRule(rule, colorDecl, local, pageBackground));
  });

  const tokenUses = usesFromTokens(roleTokens(globals, sawColorRule), variables);
  return [...uses, ...tokenUses];
}

function useFromRule(
  rule: Rule,
  colorDecl: Declaration,
  variables: ReadonlyMap<string, string>,
  pageBackground: RawValue | null,
): ColorUse {
  const ownBackground = directDecl(rule, "background-color") ?? directDecl(rule, "background");
  const background = ownBackground === null ? pageBackground : { value: ownBackground.value, line: lineOf(ownBackground) };
  const line = lineOf(colorDecl);
  const text = resolvePaint(colorDecl.value, variables);

  if (!text.ok) {
    return {
      status: "unchecked",
      kind: "text-background",
      line,
      selector: rule.selector,
      firstName: null,
      secondName: null,
      first: colorDecl.value,
      second: background?.value ?? null,
      reason: text.reason,
    };
  }
  if (background === null) {
    return {
      status: "unchecked",
      kind: "text-background",
      line,
      selector: rule.selector,
      firstName: null,
      secondName: null,
      first: colorDecl.value,
      second: null,
      reason: "missing-background",
    };
  }

  const paintedBackground = resolvePaint(background.value, variables);
  if (!paintedBackground.ok) {
    return {
      status: "unchecked",
      kind: "text-background",
      line,
      selector: rule.selector,
      firstName: null,
      secondName: null,
      first: colorDecl.value,
      second: background.value,
      reason: paintedBackground.reason,
    };
  }

  return textOnBackground({
    line,
    selector: rule.selector,
    firstName: null,
    secondName: null,
    first: colorDecl.value,
    second: background.value,
    text: text.color,
    background: paintedBackground.color,
  });
}

function roleTokens(globals: ReadonlyMap<string, RawValue>, sawColorRule: boolean): SourceToken[] {
  const tokens: SourceToken[] = [];
  for (const [name, entry] of globals) {
    const roleName = name.replace(/^--/, "").toLowerCase();
    const isStatus = /(?:^|-)(success|error|warning|danger|info|destructive)$/.test(roleName);
    const isTextPair = /(?:^|-)(text|foreground|fg|ink|content|background|bg|paper|surface|canvas|page)$/.test(roleName);
    if (!isStatus && (sawColorRule || !isTextPair)) continue;
    tokens.push({ name, line: entry.line, value: entry.value });
  }
  return tokens;
}

function findPageBackground(root: Root, variables: ReadonlyMap<string, string>): RawValue | null {
  let bestRank = 0;
  let best: RawValue | null = null;
  root.walkRules((rule) => {
    const rank = selectorRank(rule.selector);
    if (rank <= bestRank) return;
    const decl = directDecl(rule, "background-color") ?? directDecl(rule, "background");
    if (decl === null) return;
    const resolved = resolvePaint(decl.value, variables);
    if (!resolved.ok) return;
    bestRank = rank;
    best = { value: decl.value, line: lineOf(decl) };
  });
  return best;
}

function directDecl(rule: Rule, prop: string): Declaration | null {
  let found: Declaration | null = null;
  for (const node of rule.nodes ?? []) {
    if (node.type === "decl" && node.prop.toLowerCase() === prop) found = node;
  }
  return found;
}

function isGlobalSelector(selector: string): boolean {
  return selectorRank(selector) > 0;
}

function selectorRank(selector: string): number {
  const parts = selector.split(",").map((part) => part.trim().toLowerCase());
  if (parts.includes("body")) return 3;
  if (parts.includes("html")) return 2;
  if (parts.includes(":root")) return 1;
  return 0;
}

function lineOf(decl: Declaration): number {
  return decl.source?.start?.line ?? 1;
}
