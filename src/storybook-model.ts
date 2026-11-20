import type { Srgb } from "./color.js";
import type { CheckedUse } from "./color-use.js";
import { extractCss } from "./extract-css.js";
import { ignoredLines } from "./ignore.js";
import { simulate, type Deficiency } from "./simulate.js";

export type PanelCard = {
  kind: "text-background" | "status";
  label: string;
  deficiency: Deficiency;
  detail: string;
  originalFirst: string;
  originalSecond: string;
  simulatedFirst: string;
  simulatedSecond: string;
};

/** Cards for `cvd-contrast` and `cvd-collision`. Passing and ordinary contrast pairs stay out. */
export function panelCards(css: string): PanelCard[] {
  const skip = ignoredLines(css);
  const cards: PanelCard[] = [];
  for (const use of extractCss(css)) {
    if (use.status !== "checked" || skip.has(use.line)) continue;
    if (use.verdict !== "cvd-contrast" && use.verdict !== "cvd-collision") continue;
    if (use.deficiency === null) continue;
    const deficiency = use.deficiency;
    cards.push({
      kind: use.kind,
      label: label(use),
      deficiency,
      detail: detail(use, deficiency),
      originalFirst: paintHex(use.firstPaint),
      originalSecond: paintHex(use.secondPaint),
      simulatedFirst: paintHex(simulate(use.firstPaint, deficiency)),
      simulatedSecond: paintHex(simulate(use.secondPaint, deficiency)),
    });
  }
  return cards;
}

/** Turn a `parameters.colorwarning` value into the panel body. */
export function panelResult(parameter: unknown): { html: string; count: number } {
  const css = cssFromParameter(parameter);
  if (css === null) {
    return { html: renderMessage("Pass this story's CSS in parameters.colorwarning."), count: 0 };
  }
  try {
    const cards = panelCards(css);
    if (cards.length === 0) return { html: renderMessage("No color-vision findings."), count: 0 };
    return { html: renderPanel(cards), count: cards.length };
  } catch {
    return { html: renderMessage("This CSS could not be read."), count: 0 };
  }
}

export function cssFromParameter(parameter: unknown): string | null {
  if (typeof parameter === "string") return parameter;
  if (parameter !== null && typeof parameter === "object" && "css" in parameter) {
    const css = parameter.css;
    if (typeof css === "string") return css;
  }
  return null;
}

export function renderPanel(cards: readonly PanelCard[]): string {
  return `<div style="padding:12px">${cards.map((card) => renderCard(card)).join("")}</div>`;
}

export function paintHex(color: Srgb): string {
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function label(use: CheckedUse): string {
  if (use.selector !== null) return use.selector;
  return [use.firstName, use.secondName].filter((name): name is string => name !== null).join(" / ");
}

function detail(use: CheckedUse, deficiency: Deficiency): string {
  const first = labeled(use.first, use.firstName);
  const second = labeled(use.second, use.secondName);
  const normal = use.normal.toFixed(2);
  const simulated = (use.simulated ?? 0).toFixed(2);
  if (use.verdict === "cvd-collision") {
    return `${first} and ${second} collide under ${deficiency} (distance ${normal}, simulated ${simulated})`;
  }
  return `${first} on ${second} fails color-vision contrast under ${deficiency} (${normal}:1, simulated ${simulated}:1)`;
}

function labeled(color: string, name: string | null): string {
  return name === null ? color : `${color} (${name})`;
}

function renderCard(card: PanelCard): string {
  return [
    `<article style="margin:0 0 16px">`,
    `<h3 style="margin:0 0 8px;font:600 14px/1.3 sans-serif;color:#222">${escapeHtml(card.label)}</h3>`,
    `<div style="display:flex;gap:16px">`,
    figure("original", card.kind, card.originalFirst, card.originalSecond),
    figure(card.deficiency, card.kind, card.simulatedFirst, card.simulatedSecond),
    `</div>`,
    `<p style="margin:8px 0 0;color:#222;font:13px/1.4 sans-serif">${escapeHtml(card.detail)}</p>`,
    `</article>`,
  ].join("");
}

function figure(caption: string, kind: PanelCard["kind"], first: string, second: string): string {
  return `<figure style="margin:0">${swatch(kind, first, second)}<figcaption style="margin-top:4px;color:#444;font:12px sans-serif">${escapeHtml(caption)}</figcaption></figure>`;
}

function swatch(kind: PanelCard["kind"], first: string, second: string): string {
  const left = escapeHtml(first);
  const right = escapeHtml(second);
  if (kind === "status") {
    return `<div style="display:flex;width:160px;height:56px;border:1px solid #bdbdbd"><div style="flex:1;background:${left}"></div><div style="flex:1;background:${right}"></div></div>`;
  }
  return `<div style="width:160px;height:56px;border:1px solid #bdbdbd;background:${right};color:${left};font:700 22px/56px sans-serif;text-align:center">Aa</div>`;
}

function renderMessage(text: string): string {
  return `<p style="margin:12px;color:#222;font:13px/1.4 sans-serif">${escapeHtml(text)}</p>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function channel(value: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, value)) * 255);
  return byte.toString(16).padStart(2, "0");
}
