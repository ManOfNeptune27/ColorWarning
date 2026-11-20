import type { Srgb } from "./color.js";
import { contrastRatio, meetsAaNormalText } from "./contrast.js";
import type { Deficiency } from "./simulate.js";
import { oklabDistance } from "./simulate.js";
import { cvdCollision, cvdContrast } from "./verdicts.js";
import { compositeOver, resolvePaint, type UncheckedReason } from "./resolve-color.js";

export type { UncheckedReason } from "./resolve-color.js";

export type UseKind = "text-background" | "status";

export type CheckedUse = {
  status: "checked";
  kind: UseKind;
  line: number;
  selector: string | null;
  firstName: string | null;
  secondName: string | null;
  first: string;
  second: string;
  /** Opaque colors the verdict measured. `first` and `second` keep the source text. */
  firstPaint: Srgb;
  secondPaint: Srgb;
  verdict: "pass" | "contrast" | "cvd-contrast" | "cvd-collision";
  normal: number;
  simulated: number | null;
  deficiency: Deficiency | null;
};

export type UncheckedUse = {
  status: "unchecked";
  kind: UseKind;
  line: number;
  selector: string | null;
  firstName: string | null;
  secondName: string | null;
  first: string | null;
  second: string | null;
  reason: UncheckedReason;
};

export type ColorUse = CheckedUse | UncheckedUse;

export type SourceToken = {
  name: string;
  line: number;
  value: string;
};

const textNames = new Set(["text", "foreground", "fg", "ink", "content"]);
const backgroundNames = new Set(["background", "bg", "paper", "surface", "canvas", "page"]);
const statusNames = new Set(["success", "error", "warning", "danger", "info", "destructive"]);

type Role = "text" | "background" | "status";

/** Pair role-named colors. Names such as `color-text` and `--success` both count. */
export function usesFromTokens(
  tokens: readonly SourceToken[],
  variables: ReadonlyMap<string, string> = new Map(),
): ColorUse[] {
  const uses: ColorUse[] = [];
  const text: Array<{ token: SourceToken; color: Srgb }> = [];
  const background: Array<{ token: SourceToken; color: Srgb }> = [];
  const status: Array<{ token: SourceToken; color: Srgb }> = [];
  let sawBackground = false;

  for (const token of tokens) {
    const role = classify(token.name);
    if (role === null) continue;
    if (role === "background") sawBackground = true;
    const resolved = resolvePaint(token.value, variables);
    if (!resolved.ok) {
      uses.push(unchecked(role === "status" ? "status" : "text-background", token, resolved.reason));
      continue;
    }
    if (role === "status" && resolved.color.alpha !== 1) {
      uses.push(unchecked("status", token, "unreadable"));
      continue;
    }
    const bucket = role === "text" ? text : role === "background" ? background : status;
    bucket.push({ token, color: resolved.color });
  }

  if (text.length > 0 && background.length === 0 && !sawBackground) {
    for (const entry of text) {
      uses.push(unchecked("text-background", entry.token, "missing-background"));
    }
  }

  for (const foreground of text) {
    for (const back of background) {
      uses.push(
        textOnBackground({
          line: foreground.token.line,
          selector: null,
          firstName: foreground.token.name,
          secondName: back.token.name,
          first: foreground.token.value,
          second: back.token.value,
          text: foreground.color,
          background: back.color,
        }),
      );
    }
  }

  for (let i = 0; i < status.length; i++) {
    for (let j = i + 1; j < status.length; j++) {
      const left = status[i];
      const right = status[j];
      if (left === undefined || right === undefined) continue;
      uses.push(statusPair(left.token, left.color, right.token, right.color));
    }
  }

  return uses;
}

export function textOnBackground(input: {
  line: number;
  selector: string | null;
  firstName: string | null;
  secondName: string | null;
  first: string;
  second: string;
  text: Srgb;
  background: Srgb;
}): ColorUse {
  const painted = compositeOver(input.text, input.background);
  if (painted === null || input.background.alpha !== 1) {
    return {
      status: "unchecked",
      kind: "text-background",
      line: input.line,
      selector: input.selector,
      firstName: input.firstName,
      secondName: input.secondName,
      first: input.first,
      second: input.second,
      reason: "unreadable",
    };
  }

  const normal = contrastRatio(painted, input.background);
  if (normal === null) {
    return {
      status: "unchecked",
      kind: "text-background",
      line: input.line,
      selector: input.selector,
      firstName: input.firstName,
      secondName: input.secondName,
      first: input.first,
      second: input.second,
      reason: "unreadable",
    };
  }

  const base = {
    status: "checked" as const,
    kind: "text-background" as const,
    line: input.line,
    selector: input.selector,
    firstName: input.firstName,
    secondName: input.secondName,
    first: input.first,
    second: input.second,
    firstPaint: painted,
    secondPaint: input.background,
  };

  if (!meetsAaNormalText(normal)) {
    return { ...base, verdict: "contrast", normal, simulated: null, deficiency: null };
  }
  const finding = cvdContrast(painted, input.background);
  if (finding !== null) {
    return {
      ...base,
      verdict: "cvd-contrast",
      normal: finding.normal,
      simulated: finding.simulated,
      deficiency: finding.deficiency,
    };
  }
  return { ...base, verdict: "pass", normal, simulated: null, deficiency: null };
}

function statusPair(left: SourceToken, leftColor: Srgb, right: SourceToken, rightColor: Srgb): CheckedUse {
  const finding = cvdCollision(leftColor, rightColor);
  return {
    status: "checked",
    kind: "status",
    line: right.line,
    selector: null,
    firstName: left.name,
    secondName: right.name,
    first: left.value,
    second: right.value,
    firstPaint: leftColor,
    secondPaint: rightColor,
    verdict: finding === null ? "pass" : "cvd-collision",
    normal: finding?.normalDistance ?? oklabDistance(leftColor, rightColor),
    simulated: finding?.simulatedDistance ?? null,
    deficiency: finding?.deficiency ?? null,
  };
}

function unchecked(kind: UseKind, token: SourceToken, reason: UncheckedReason): UncheckedUse {
  return {
    status: "unchecked",
    kind,
    line: token.line,
    selector: null,
    firstName: token.name,
    secondName: null,
    first: token.value,
    second: null,
    reason,
  };
}

function classify(name: string): Role | null {
  const stripped = name.replace(/^--/, "").toLowerCase();
  const parts = stripped
    .split("-")
    .filter((part) => part !== "color" && part !== "colors" && part !== "colour" && part !== "colours");
  const base = parts.at(-1) ?? stripped;
  if (textNames.has(base)) return "text";
  if (backgroundNames.has(base)) return "background";
  if (statusNames.has(base)) return "status";
  return null;
}
