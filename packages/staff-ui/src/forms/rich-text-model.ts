/**
 * The inline format of a paragraph: runs of text that are bold, italic, a link, or plain. It
 * matches the editorial block format that lax.art renders, so a paragraph edited here is saved
 * exactly as before. Pure functions, so every conversion is testable without a browser.
 */
export type RichTextMark = "bold" | "italic" | "link";

export type RichTextSpan = {
  text: string;
  marks?: RichTextMark[];
  href?: string;
};

const MARK_ORDER: readonly RichTextMark[] = ["bold", "italic", "link"];

function canonical(span: RichTextSpan): RichTextSpan {
  const href = span.href?.trim() ?? "";
  const requested = new Set(span.marks ?? []);
  if (href) requested.add("link");
  else requested.delete("link");
  const marks = MARK_ORDER.filter((mark) => requested.has(mark));
  return {
    text: span.text,
    ...(marks.length > 0 ? { marks } : {}),
    ...(href ? { href } : {}),
  };
}

function sameFormat(a: RichTextSpan, b: RichTextSpan): boolean {
  return (a.marks ?? []).join() === (b.marks ?? []).join() && (a.href ?? "") === (b.href ?? "");
}

/**
 * One canonical form for any run list: marks in a fixed order, a link only with an address,
 * neighbours with the same format merged, empty runs dropped, and never an empty list (an empty
 * paragraph is one empty run).
 */
export function normalizeSpans(spans: readonly RichTextSpan[]): RichTextSpan[] {
  const merged: RichTextSpan[] = [];
  for (const raw of spans) {
    if (raw.text === "") continue;
    const span = canonical(raw);
    const last = merged[merged.length - 1];
    if (last && sameFormat(last, span)) last.text += span.text;
    else merged.push(span);
  }
  return merged.length > 0 ? merged : [{ text: "" }];
}

/** The text without formatting, for counting and for checking whether a paragraph is blank. */
export function spansToPlainText(spans: readonly RichTextSpan[]): string {
  return spans.map((span) => span.text).join("");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

/** The markup the editing surface shows for these runs; line breaks become `<br>`. */
export function spansToHtml(spans: readonly RichTextSpan[]): string {
  const runs = normalizeSpans(spans);
  const html = runs
    .map((span) => {
      let node = escapeHtml(span.text).replace(/\n/g, "<br>");
      const marks = span.marks ?? [];
      if (marks.includes("bold")) node = `<strong>${node}</strong>`;
      if (marks.includes("italic")) node = `<em>${node}</em>`;
      if (marks.includes("link") && span.href) {
        node = `<a href="${escapeAttribute(span.href)}">${node}</a>`;
      }
      return node;
    })
    .join("");
  // A trailing line break needs one more to show as an empty line.
  return spansToPlainText(runs).endsWith("\n") ? `${html}<br>` : html;
}

type Format = { bold: boolean; italic: boolean; href: string };

const BLOCK_TAGS = new Set(["DIV", "P", "LI"]);

/**
 * Reads the editing surface back into runs. Browsers produce `b`, `strong`, `i`, `em` and `a`;
 * anything else (pasted markup, spans with styles) keeps its text and loses its styling, so only
 * the three marks the format can store ever get through. The browser's trailing placeholder
 * `<br>` is not text.
 */
export function htmlToSpans(root: Node): RichTextSpan[] {
  const runs: RichTextSpan[] = [];
  const push = (text: string, format: Format) => {
    if (text === "") return;
    runs.push({
      text,
      marks: [
        ...(format.bold ? (["bold"] as const) : []),
        ...(format.italic ? (["italic"] as const) : []),
        ...(format.href ? (["link"] as const) : []),
      ],
      ...(format.href ? { href: format.href } : {}),
    });
  };

  const walk = (node: Node, format: Format) => {
    if (node.nodeType === 3) {
      push(node.textContent ?? "", format);
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const tag = element.tagName;
    if (tag === "BR") {
      push("\n", format);
      return;
    }
    const next: Format = { ...format };
    if (tag === "B" || tag === "STRONG") next.bold = true;
    if (tag === "I" || tag === "EM") next.italic = true;
    if (tag === "A") next.href = element.getAttribute("href") ?? "";
    // A block a browser inserted (Enter in some engines, pasted markup) starts a new line.
    const last = runs[runs.length - 1];
    if (BLOCK_TAGS.has(tag) && last && !last.text.endsWith("\n")) push("\n", format);
    for (const child of Array.from(element.childNodes)) walk(child, next);
  };

  walk(root, { bold: false, italic: false, href: "" });
  const end = runs[runs.length - 1];
  if (end?.text.endsWith("\n")) end.text = end.text.slice(0, -1);
  return normalizeSpans(runs);
}
