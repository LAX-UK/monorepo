import { readFileSync } from "node:fs";
import bidiFactory, { type EmbeddingLevels } from "bidi-js";

/**
 * Fallback fonts for names the main Noto Sans does not cover: Arabic (Noto Sans Arabic), Hebrew
 * (Noto Sans Hebrew), and Chinese and Japanese (Noto Sans SC). SIL Open Font License; see
 * fonts/fallback/OFL-noto-fallbacks.txt.
 *
 * Only Noto Sans SC is bundled for CJK: Japanese kana come from its slices, and kanji are drawn
 * with Simplified Chinese glyph forms, which is acceptable for a name. Korean hangul is not
 * bundled: a character no font covers prints blank and is reported through `onMissingGlyph`.
 *
 * The files are the @fontsource WOFF slices of each family (about 40 KB each for CJK;
 * manifest.json lists the code points each holds). They are read from disk only when a string
 * actually needs one, so ordinary Latin invoices never pay for them. Regular weight only.
 */
type Slice = { file: string; ranges: [number, number][] };
type Manifest = { arabic: Slice[]; hebrew: Slice[]; cjk: Slice[] };

let manifest: Manifest | null = null;
const buffers = new Map<string, Buffer>();

function loadManifest(): Manifest {
  manifest ??= JSON.parse(
    readFileSync(new URL("../../fonts/fallback/manifest.json", import.meta.url), "utf8"),
  ) as Manifest;
  return manifest;
}

/** The bytes of one fallback font file, read once and then kept. */
export function fallbackFontBuffer(file: string): Buffer {
  let buffer = buffers.get(file);
  if (!buffer) {
    buffer = readFileSync(new URL(`../../fonts/fallback/${file}`, import.meta.url));
    buffers.set(file, buffer);
  }
  return buffer;
}

/** The code points each fallback family is used for; manifest.json says which slice holds each. */
export const FALLBACK_RANGES: Readonly<Record<keyof Manifest, readonly [number, number][]>> = {
  arabic: [
    [0x0600, 0x06ff],
    [0x0750, 0x077f],
    [0x08a0, 0x08ff],
    [0xfb50, 0xfdff],
    [0xfe70, 0xfeff],
  ],
  hebrew: [
    [0x0590, 0x05ff],
    [0xfb1d, 0xfb4f],
  ],
  cjk: [
    [0x2e80, 0x2fff],
    [0x3000, 0x30ff],
    [0x3400, 0x4dbf],
    [0x4e00, 0x9fff],
    [0xf900, 0xfaff],
    [0xff00, 0xffef],
    [0x20000, 0x2ffff],
  ],
};

function inRanges(cp: number, ranges: readonly (readonly [number, number])[]): boolean {
  return ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

function sliceFor(cp: number, slices: readonly Slice[]): string | null {
  return slices.find((slice) => inRanges(cp, slice.ranges))?.file ?? null;
}

/** The fallback file that draws `cp`, or `null` when it is the main font's (or nobody's). */
function fallbackFileFor(cp: number): string | null {
  if (cp < 0x0590) return null;
  const m = loadManifest();
  for (const family of ["arabic", "hebrew", "cjk"] as const) {
    if (inRanges(cp, FALLBACK_RANGES[family])) return sliceFor(cp, m[family]);
  }
  return null;
}

/** `true` when the text holds anything the main font cannot draw but a fallback can. */
export function needsFallback(text: string): boolean {
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp >= 0x0590 && fallbackFileFor(cp) !== null) return true;
  }
  return false;
}

const bidi = bidiFactory();
const SPACE = /^\s$/u;
/** Marks and joiners belong with the character before them, so a run is not split inside one. */
const CLINGS = /^[\p{M}‌‍]$/u;

/**
 * A stretch of text drawn by one font at one bidi embedding level. `text` is in logical
 * (reading) order; `rtl` is an odd level. Runs are returned in visual order, left to right.
 */
export type TextRun = { text: string; file: string | null; rtl: boolean; level: number };

type Analysis = { text: string; files: (string | null)[]; levels: EmbeddingLevels };

/**
 * The font of each UTF-16 code unit and the bidi levels of the text. Spaces always take the main
 * font; the paragraph direction is that of the first strong character (UAX #9 rules P2 and P3),
 * so "Ahmed أحمد Ltd" reads left to right and "شركة 123" right to left. That is the
 * standard's default, and it is what a name typed in either script expects.
 */
function analyse(text: string): Analysis {
  const files: (string | null)[] = [];
  let previous: string | null = null;
  for (const char of text) {
    let file: string | null;
    if (SPACE.test(char)) file = null;
    else if (CLINGS.test(char) && files.length > 0) file = previous;
    else file = fallbackFileFor(char.codePointAt(0) ?? 0);
    for (let unit = 0; unit < char.length; unit++) files.push(file);
    previous = file;
  }
  return { text, files, levels: bidi.getEmbeddingLevels(text, "auto") };
}

/** The runs of `text[start, end)` laid out as one line, in visual order (UAX #9 rule L2). */
function runsOf(analysis: Analysis, start: number, end: number): TextRun[] {
  if (end <= start) return [];
  const { text, files, levels } = analysis;
  const order = bidi.getReorderedIndices(text, levels, start, end - 1);
  const runs: TextRun[] = [];
  let current: { lo: number; hi: number; file: string | null; level: number } | null = null;
  const flush = () => {
    if (!current) return;
    const { lo, hi, file, level } = current;
    runs.push({ text: text.slice(lo, hi + 1), file, rtl: level % 2 === 1, level });
  };
  for (let position = start; position < end; position++) {
    const index = order[position] ?? position;
    const file = files[index] ?? null;
    const level = levels.levels[index] ?? 0;
    const follows =
      current !== null &&
      current.file === file &&
      current.level === level &&
      (level % 2 === 1 ? index === current.lo - 1 : index === current.hi + 1);
    if (follows && current) {
      current.lo = Math.min(current.lo, index);
      current.hi = Math.max(current.hi, index);
    } else {
      flush();
      current = { lo: index, hi: index, file, level };
    }
  }
  flush();
  return runs;
}

/**
 * Splits text into font runs and orders them for drawing left to right with the Unicode
 * Bidirectional Algorithm: "Ahmed أحمد محمد Ltd" gives "Ahmed ", "محمد", " ", "أحمد", " Ltd".
 */
export function visualRuns(text: string): TextRun[] {
  return runsOf(analyse(text), 0, text.length);
}

/** Scripts fontkit lays out right to left: it reverses their glyphs itself after shaping. */
const ENGINE_RTL =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}]/u;
const SCRIPTED = /[^\p{Script=Common}\p{Script=Inherited}\p{Script=Unknown}]/u;

/** Whether PDFKit's font engine (fontkit) will draw `text` reversed: it goes by the first script. */
function engineReverses(text: string): boolean {
  const first = SCRIPTED.exec(text)?.[0];
  return first !== undefined && ENGINE_RTL.test(first);
}

/**
 * The string to hand PDFKit for a run so its glyphs land in visual order. fontkit shapes Arabic
 * and Hebrew in logical order and reverses them itself, so those runs go as they are; a
 * right-to-left run in another script (spaces, punctuation between Arabic words) is reversed
 * here, with brackets mirrored; and a left-to-right run fontkit would reverse (Arabic-Indic
 * digits, which bidi keeps left to right) is reversed so the two cancel.
 */
export function drawingOrder(run: TextRun): string {
  if (run.rtl === engineReverses(run.text)) return run.text;
  return [...run.text]
    .reverse()
    .map((char) => (run.rtl ? (bidi.getMirroredCharacter(char) ?? char) : char))
    .join("");
}

const CJK_BREAKS = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯]$/u;
/** Characters a line may not start with, or end with, in CJK text. */
const NO_LINE_START = /^[\p{Pe}\p{Pf}\p{Po}ー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]$/u;
const NO_LINE_END = /^[\p{Ps}\p{Pi}]$/u;

/** Where a new line may start: after spaces, and between CJK characters. */
function breakOpportunities(text: string): number[] {
  const out: number[] = [];
  let index = 0;
  let previous = "";
  for (const char of text) {
    if (index > 0 && !SPACE.test(char) && !CLINGS.test(char)) {
      if (SPACE.test(previous)) out.push(index);
      else if (
        (CJK_BREAKS.test(char) || CJK_BREAKS.test(previous)) &&
        !NO_LINE_START.test(char) &&
        !NO_LINE_END.test(previous)
      ) {
        out.push(index);
      }
    }
    previous = char;
    index += char.length;
  }
  return out;
}

function skipSpaces(text: string, index: number): number {
  let i = index;
  while (i < text.length && SPACE.test(text[i] ?? "")) i++;
  return i;
}

function trimSpaces(text: string, start: number, end: number): number {
  let i = end;
  while (i > start && SPACE.test(text[i - 1] ?? "")) i--;
  return i;
}

/** The index after the character at `index` and any marks that cling to it. */
function nextCluster(text: string, index: number): number {
  let i = index + ((text.codePointAt(index) ?? 0) > 0xffff ? 2 : 1);
  while (i < text.length) {
    const char = String.fromCodePoint(text.codePointAt(i) ?? 0);
    if (!CLINGS.test(char)) break;
    i += char.length;
  }
  return i;
}

/**
 * Breaks text into lines in logical order (UAX #9 reorders each line afterwards): greedily at the
 * last opportunity that fits, or between characters when a single word is wider than the line.
 */
function lineRanges(text: string, fits: (start: number, end: number) => boolean) {
  const opportunities = breakOpportunities(text);
  const lines: [number, number][] = [];
  let start = skipSpaces(text, 0);
  while (start < text.length) {
    const end = trimSpaces(text, start, text.length);
    if (fits(start, end)) {
      lines.push([start, end]);
      break;
    }
    let next = -1;
    for (const at of opportunities) {
      if (at <= start) continue;
      if (!fits(start, trimSpaces(text, start, at))) break;
      next = at;
    }
    if (next === -1) {
      next = nextCluster(text, start);
      while (next < end && !SPACE.test(text[next] ?? "")) {
        const after = nextCluster(text, next);
        if (!fits(start, after)) break;
        next = after;
      }
    }
    lines.push([start, trimSpaces(text, start, next)]);
    start = skipSpaces(text, next);
  }
  return lines;
}

type FontEngine = { hasGlyphForCodePoint?: (cp: number) => boolean };
type PdfDoc = {
  registerFont(name: string, src: Buffer): unknown;
  font(name: string): PdfDoc;
  fontSize(size?: number): PdfDoc;
  widthOfString(text: string, options?: Record<string, unknown>): number;
  currentLineHeight(includeGap?: boolean): number;
  x: number;
  y: number;
  text(
    text: string,
    x?: number | Record<string, unknown>,
    y?: number | Record<string, unknown>,
    options?: Record<string, unknown>,
  ): unknown;
  _font: { ascender: number; font?: FontEngine };
  _fontSize: number;
  _fontFamilies: Record<string, unknown>;
};

const registered = new WeakMap<object, Set<string>>();

/**
 * PDFKit keeps one font per PostScript name, and every slice of a Noto family shares the same
 * name, so a second slice would silently reuse the first and print blanks. Before opening a new
 * slice, drop the by-name aliases of the slices already open (each stays under its own key, so
 * it is still written to the PDF).
 */
function openFallback(doc: PdfDoc, names: Set<string>, key: string, file: string): void {
  if (names.has(key)) return;
  const families = doc._fontFamilies;
  const ours = new Set([...names].map((name) => families[name]));
  for (const alias of Object.keys(families)) {
    if (!names.has(alias) && ours.has(families[alias])) delete families[alias];
  }
  doc.registerFont(key, fallbackFontBuffer(file));
  doc.font(key);
  names.add(key);
}

/**
 * Code points (from U+0590 up) that neither a fallback font nor the main font has a glyph for,
 * such as Korean hangul. The main font is asked when it is an embedded font; the PDF base fonts
 * cannot be asked, so nothing is reported for them.
 */
function missingGlyphs(doc: PdfDoc, text: string): number[] {
  const missing = new Set<number>();
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp < 0x0590 || /^[\s\p{Cf}]$/u.test(char) || fallbackFileFor(cp) !== null) continue;
    const engine = doc._font.font;
    if (typeof engine?.hasGlyphForCodePoint === "function" && !engine.hasGlyphForCodePoint(cp)) {
      missing.add(cp);
    }
  }
  return [...missing];
}

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

function warnMissingGlyphs(codePoints: readonly number[]): void {
  const shown = codePoints.slice(0, 8).map(hex).join(", ");
  const more = codePoints.length > 8 ? ` and ${codePoints.length - 8} more` : "";
  console.warn(`[pdf-fonts] no bundled font draws ${shown}${more}; they print blank`);
}

export type FallbackTextOptions = Record<string, unknown> & {
  width?: number;
  /** The smallest size a name is shrunk to, to keep it on one line, before it wraps (7pt). */
  minFontSize?: number;
  /**
   * Called with the code points no bundled font can draw (they print blank). Defaults to a
   * `console.warn` naming the code points (never the text, which is personal data).
   */
  onMissingGlyph?: (codePoints: readonly number[]) => void;
};

/**
 * Draws `text` like `doc.text(text, x, y, { width })`, switching to a fallback font for any
 * Arabic, Hebrew, Chinese or Japanese it holds. Text without them goes straight to `doc.text` in
 * `baseFont`, and no fallback file is read.
 *
 * Other text is drawn run by run (PDFKit cannot switch fonts inside a paragraph): runs are put in
 * visual order by the Unicode Bidirectional Algorithm and drawn on one alphabetic baseline, the
 * one `baseFont` would use, so scripts with taller fonts do not sit lower. Lines start at `x`
 * whatever the direction (the field is left-aligned). With a `width`, a name that does not fit
 * is first shrunk, down to `minFontSize`; past that it wraps at the original size, at spaces or
 * between CJK characters, each line reordered on its own. `doc.y` ends below the last line.
 */
export function textWithFallback(
  pdf: object,
  baseFont: string,
  text: string,
  x: number,
  y: number,
  options: FallbackTextOptions = {},
): void {
  const { onMissingGlyph = warnMissingGlyphs, minFontSize = 7, ...textOptions } = options;
  const doc = pdf as PdfDoc;
  doc.font(baseFont);
  const missing = missingGlyphs(doc, text);
  if (missing.length > 0) onMissingGlyph(missing);
  if (!needsFallback(text)) {
    doc.text(text, x, y, textOptions);
    return;
  }

  const names = registered.get(doc) ?? new Set<string>();
  registered.set(doc, names);
  const analysis = analyse(text);
  for (const file of new Set(analysis.files)) {
    if (file) openFallback(doc, names, `Fallback-${file}`, file);
  }
  const fontOf = (run: TextRun) => (run.file ? `Fallback-${run.file}` : baseFont);
  const measure = (start: number, end: number) =>
    runsOf(analysis, start, end).reduce(
      (sum, run) => sum + doc.font(fontOf(run)).widthOfString(drawingOrder(run)),
      0,
    );

  const original = doc._fontSize;
  const { width } = textOptions;
  const whole: [number, number] = [skipSpaces(text, 0), trimSpaces(text, 0, text.length)];
  let size = original;
  let lines = [whole];
  if (width !== undefined && measure(...whole) > width) {
    while (size > minFontSize && measure(...whole) > width) {
      size = Math.max(minFontSize, size - 0.5);
      doc.fontSize(size);
    }
    if (measure(...whole) > width) {
      size = original;
      doc.fontSize(size);
      lines = lineRanges(text, (start, end) => measure(start, end) <= width);
    }
  }

  doc.font(baseFont).fontSize(size);
  const lineHeight = doc.currentLineHeight(true);
  const ascent = (doc._font.ascender / 1000) * size;
  for (const [index, [start, end]] of lines.entries()) {
    const baseline = y + index * lineHeight + ascent;
    let cursor = x;
    for (const run of runsOf(analysis, start, end)) {
      const glyphs = drawingOrder(run);
      doc.font(fontOf(run));
      doc.text(glyphs, cursor, baseline, { lineBreak: false, baseline: "alphabetic" });
      cursor += doc.widthOfString(glyphs);
    }
  }
  doc.font(baseFont).fontSize(original);
  doc.x = x;
  doc.y = y + lines.length * lineHeight;
}
