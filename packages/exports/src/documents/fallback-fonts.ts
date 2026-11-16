import { readFileSync } from "node:fs";

/**
 * Fallback fonts for names the main Noto Sans does not cover: Arabic, Hebrew, and Chinese and
 * Japanese kana (Noto Sans SC and JP, SIL Open Font License; see fonts/fallback/OFL-noto-fallbacks.txt).
 * Korean hangul is not bundled.
 *
 * Files are the Google Fonts slices (about 40 KB each for CJK), read from disk only when a
 * string actually needs one, so ordinary Latin invoices never pay for them. Regular weight only.
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

const ARABIC: [number, number][] = [
  [0x0600, 0x06ff],
  [0x0750, 0x077f],
  [0x08a0, 0x08ff],
  [0xfb50, 0xfdff],
  [0xfe70, 0xfeff],
];
const HEBREW: [number, number][] = [
  [0x0590, 0x05ff],
  [0xfb1d, 0xfb4f],
];
const CJK: [number, number][] = [
  [0x2e80, 0x2fff],
  [0x3000, 0x30ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xf900, 0xfaff],
  [0xff00, 0xffef],
  [0x20000, 0x2ffff],
];

function inRanges(cp: number, ranges: readonly [number, number][]): boolean {
  return ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/** A stretch of text and the fallback font file that draws it (`null`: the main font). */
export type TextRun = { text: string; file: string | null; rtl: boolean };

function sliceFor(cp: number, slices: readonly Slice[]): string | null {
  return slices.find((slice) => inRanges(cp, slice.ranges))?.file ?? null;
}

function classify(cp: number): { file: string | null; rtl: boolean } {
  if (cp < 0x0590) return { file: null, rtl: false };
  const m = loadManifest();
  if (inRanges(cp, ARABIC)) return { file: sliceFor(cp, m.arabic), rtl: true };
  if (inRanges(cp, HEBREW)) return { file: sliceFor(cp, m.hebrew), rtl: true };
  if (inRanges(cp, CJK)) return { file: sliceFor(cp, m.cjk), rtl: false };
  return { file: null, rtl: false };
}

/** `true` when the text holds anything the main font cannot draw but a fallback can. */
export function needsFallback(text: string): boolean {
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp >= 0x0590 && classify(cp).file !== null) return true;
  }
  return false;
}

/**
 * Splits text into runs by the font that draws each. Spaces, digits and punctuation take the
 * main font but the direction of the run before them. Right-to-left runs are returned in logical
 * order; the caller draws them reversed (see {@link visualOrder}).
 */
export function splitRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    const last = runs[runs.length - 1];
    const neutral = /^[\s\p{P}\p{N}]$/u.test(char);
    // Spaces and digits are drawn by the main font (fallback slices lack them) but keep the
    // direction of the run they sit in.
    const kind = neutral && last ? { file: null, rtl: last.rtl } : classify(cp);
    if (last && kind.file === last.file && kind.rtl === last.rtl) last.text += char;
    else runs.push({ text: char, file: kind.file, rtl: kind.rtl });
  }
  return runs;
}

/**
 * The runs in the order they should be drawn left to right on the page: a right-to-left name
 * is drawn with its runs reversed, and each run's own characters reversed after shaping is
 * handled by the font engine.
 */
export function visualOrder(runs: readonly TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  let group: TextRun[] = [];
  const flush = () => {
    out.push(...group.reverse());
    group = [];
  };
  for (const run of runs) {
    if (run.rtl) group.push(run);
    else {
      flush();
      out.push(run);
    }
  }
  flush();
  return out;
}

type TextOptions = Record<string, unknown> & { width?: number };
type PdfDoc = {
  registerFont(name: string, src: Buffer): unknown;
  font(name: string): PdfDoc;
  fontSize(size?: number): PdfDoc;
  widthOfString(text: string, options?: TextOptions): number;
  currentLineHeight(includeGap?: boolean): number;
  y: number;
  text(
    text: string,
    x?: number | TextOptions,
    y?: number | TextOptions,
    options?: TextOptions,
  ): unknown;
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
 * Draws `text` like `doc.text(text, x, y, { width })`, switching to a fallback font for any
 * Arabic, Hebrew, Chinese or Japanese kana it holds. Text without them goes straight to
 * `doc.text` in `baseFont`, and no fallback file is read. Mixed text is drawn run by run on one
 * line (PDFKit cannot switch fonts inside a wrapped paragraph), shrunk if needed to fit `width`.
 */
export function textWithFallback(
  pdf: object,
  baseFont: string,
  text: string,
  x: number,
  y: number,
  options: TextOptions = {},
): void {
  const doc = pdf as PdfDoc;
  if (!needsFallback(text)) {
    doc.font(baseFont).text(text, x, y, options);
    return;
  }
  const names = registered.get(doc) ?? new Set<string>();
  registered.set(doc, names);
  const runs = visualOrder(splitRuns(text)).map((run) => {
    let font = baseFont;
    if (run.file) {
      font = `Fallback-${run.file}`;
      openFallback(doc, names, font, run.file);
    }
    return { text: run.text, font };
  });
  const original = doc._fontSize;
  const measure = () =>
    runs.reduce((sum, run) => sum + doc.font(run.font).widthOfString(run.text), 0);
  let size = original;
  while (options.width !== undefined && size > 6 && measure() > options.width) {
    size -= 0.5;
    doc.fontSize(size);
  }
  let cursor = x;
  for (const run of runs) {
    doc.font(run.font);
    doc.text(run.text, cursor, y, { lineBreak: false });
    cursor += doc.widthOfString(run.text);
  }
  doc.y = y + doc.font(baseFont).currentLineHeight(true);
  doc.fontSize(original).font(baseFont);
}
