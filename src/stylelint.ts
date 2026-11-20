import type { Declaration, Root } from "postcss";
import stylelint, { type PostcssResult, type Rule } from "stylelint";
import type { CheckedUse } from "./color-use.js";
import { extractCss } from "./extract-css.js";
import { ignoredLines } from "./ignore.js";

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

export const ruleName = "colorwarning/color-vision";

export const messages = ruleMessages(ruleName, {
  cvdContrast: (text: string, background: string, deficiency: string, normal: string, simulated: string) =>
    `${text} on ${background} fails color-vision contrast under ${deficiency} (${normal}:1, simulated ${simulated}:1)`,
  cvdCollision: (first: string, second: string, deficiency: string, normal: string, simulated: string) =>
    `${first} and ${second} collide under ${deficiency} (distance ${normal}, simulated ${simulated})`,
});

const meta = {
  url: "https://github.com/ManOfNeptune27/ColorWarning#stylelint",
};

/** Warn for `cvd-contrast` and `cvd-collision`. The check command is what fails a run. */
const ruleFunction = (primary: boolean) => {
  return (root: Root, result: PostcssResult) => {
    const validOptions = validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!validOptions) return;

    const source = root.source?.input.css ?? "";
    let uses;
    try {
      uses = extractCss(source);
    } catch {
      return;
    }
    const skip = ignoredLines(source);

    for (const use of uses) {
      if (use.status !== "checked" || skip.has(use.line)) continue;
      const message = findingMessage(use);
      if (message === null) continue;
      const word = use.kind === "status" ? use.second : use.first;
      const node = declarationOnLine(root, use.line, word) ?? root;
      report({
        result,
        ruleName,
        message,
        node,
        word: node.type === "decl" && node.toString().includes(word) ? word : undefined,
        severity: "warning",
      });
    }
  };
};

const rule: Rule<boolean> = Object.assign(ruleFunction, {
  ruleName,
  messages,
  meta,
});

export default createPlugin(ruleName, rule);

function findingMessage(use: CheckedUse): string | null {
  const deficiency = use.deficiency ?? "color-vision deficiency";
  const normal = use.normal.toFixed(2);
  const simulated = (use.simulated ?? 0).toFixed(2);
  const first = labeled(use.first, use.firstName);
  const second = labeled(use.second, use.secondName);
  if (use.verdict === "cvd-contrast") {
    return messages.cvdContrast(first, second, deficiency, normal, simulated);
  }
  if (use.verdict === "cvd-collision") {
    return messages.cvdCollision(first, second, deficiency, normal, simulated);
  }
  return null;
}

function labeled(color: string, name: string | null): string {
  return name === null ? color : `${color} (${name})`;
}

function declarationOnLine(root: Root, line: number, word: string): Declaration | undefined {
  let match: Declaration | undefined;
  root.walkDecls((decl) => {
    if (decl.source?.start?.line !== line) return;
    if (match === undefined) match = decl;
    if (word.length > 0 && decl.value.includes(word)) match = decl;
  });
  return match;
}
