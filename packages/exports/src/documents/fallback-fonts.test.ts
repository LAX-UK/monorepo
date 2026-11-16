import { readFileSync, readdirSync } from "node:fs";
import PDFDocument from "pdfkit";
import { describe, expect, it, vi } from "vitest";
import { type BidInvoiceDocument, renderBidInvoicePdf } from "./bid-invoice.pdf.js";
import {
  FALLBACK_RANGES,
  type FallbackTextOptions,
  drawingOrder,
  needsFallback,
  textWithFallback,
  visualRuns,
} from "./fallback-fonts.js";
import { documentFonts } from "./fonts.js";

const SAMPLES = {
  arabic: "مرحبا بالعالم أحمد",
  hebrew: "שלום עולם דוד",
  chinese: "王小明 北京",
  japanese: "佐藤 ひろし",
} as const;

const invoice = (billedTo: string): BidInvoiceDocument => ({
  number: "LAXB-1",
  raisedAt: new Date("2026-10-30T10:00:00Z"),
  dueAt: new Date("2026-11-13T23:59:59Z"),
  billedTo,
  lot: { title: "Coastal Notation", lotNumber: 1, saleTitle: null },
  lines: [{ label: "Hammer price", ratePercent: null, amountPence: 100 }],
  totalPence: 100,
  status: "awaiting_payment",
  refundedPence: 0,
});

describe("needsFallback", () => {
  it("is false for Latin, Latin Extended, Greek and Cyrillic names", () => {
    for (const name of ["Northbank Gallery", "Zoë Müller", "Πέτρος", "Иван Петров", ""]) {
      expect(needsFallback(name), name).toBe(false);
    }
  });

  it("is true for Arabic, Hebrew, Chinese and Japanese names", () => {
    for (const [script, name] of Object.entries(SAMPLES)) {
      expect(needsFallback(name), script).toBe(true);
    }
  });
});

const texts = (text: string) => visualRuns(text).map((run) => run.text);

describe("visualRuns (Unicode Bidirectional Algorithm)", () => {
  it("keeps an Arabic word inside a Latin name in place, with the spaces around it", () => {
    const runs = visualRuns("Ahmed أحمد Ltd");
    expect(runs.map((run) => run.text)).toEqual(["Ahmed ", "أحمد", " Ltd"]);
    expect(runs.map((run) => run.rtl)).toEqual([false, true, false]);
    expect(runs[0]?.file).toBeNull();
    expect(runs[1]?.file).toMatch(/arabic/);
    expect(runs[2]?.file).toBeNull();
  });

  it("puts the words of a right-to-left phrase inside a Latin name right to left", () => {
    expect(texts("Ahmed أحمد محمد Ltd")).toEqual(["Ahmed ", "محمد", " ", "أحمد", " Ltd"]);
  });

  it("reads a name that starts in Arabic right to left, with digits left of the word", () => {
    const runs = visualRuns("شركة 123");
    expect(runs.map((run) => run.text)).toEqual(["123", " ", "شركة"]);
    expect(runs.map((run) => run.rtl)).toEqual([false, true, true]);
  });

  it("reads a name that starts in Hebrew right to left (first strong character)", () => {
    expect(texts("שלום Ltd")).toEqual(["Ltd", " ", "שלום"]);
  });

  it("orders a pure Arabic name right to left, word by word", () => {
    const runs = visualRuns("مرحبا بالعالم أحمد");
    expect(runs.map((run) => run.text)).toEqual(["أحمد", " ", "بالعالم", " ", "مرحبا"]);
    expect(runs.every((run) => run.rtl)).toBe(true);
  });

  it("leaves a CJK name in reading order, each character in a slice that holds it", () => {
    const runs = visualRuns(SAMPLES.chinese);
    expect(runs.map((run) => run.text).join("")).toBe(SAMPLES.chinese);
    expect(runs.some((run) => run.rtl)).toBe(false);
    const files = new Set(runs.filter((run) => run.text !== " ").map((run) => run.file));
    expect(files.has(null)).toBe(false);
    expect(files.size).toBeGreaterThan(1);
  });

  it("hands Arabic to the font engine in logical order and reverses what it would not", () => {
    // fontkit shapes Arabic and reverses it itself, so the run goes as typed.
    const [digits, close, word] = visualRuns("شركة (الأمل) ١٢٣");
    expect(word && drawingOrder(word)).toBe(word?.text);
    // Arabic-Indic digits stay left to right; fontkit would reverse them, so they go reversed.
    expect(digits && drawingOrder(digits)).toBe("٣٢١");
    // A bracket in a right-to-left run is reversed here and mirrored.
    expect(close?.text).toBe(") ");
    expect(close && drawingOrder(close)).toBe(" (");
  });
});

describe("fallback font files", () => {
  const dir = new URL("../../fonts/fallback/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")) as Record<
    keyof typeof FALLBACK_RANGES,
    { file: string; ranges: [number, number][] }[]
  >;
  const entries = Object.values(manifest).flat();

  it("ships exactly the files the manifest lists", () => {
    const onDisk = readdirSync(dir).filter((file) => file.endsWith(".woff"));
    expect(new Set(onDisk)).toEqual(new Set(entries.map((entry) => entry.file)));
  });

  it("lists only slices that some code point is drawn from", () => {
    // A code point is drawn from the first slice that holds it, and only within its family's ranges.
    for (const [family, slices] of Object.entries(manifest)) {
      const ranges = FALLBACK_RANGES[family as keyof typeof FALLBACK_RANGES];
      const claimed = new Set<number>();
      const unused: string[] = [];
      for (const slice of slices) {
        let owns = false;
        for (const [lo, hi] of slice.ranges) {
          for (let cp = lo; cp <= hi; cp++) {
            if (claimed.has(cp) || !ranges.some(([a, b]) => cp >= a && cp <= b)) continue;
            claimed.add(cp);
            owns = true;
          }
        }
        if (!owns) unused.push(slice.file);
      }
      expect(unused, family).toEqual([]);
    }
  });

  it("carries each family's copyright notice in the licence", () => {
    const licence = readFileSync(new URL("OFL-noto-fallbacks.txt", dir), "utf8");
    expect(licence).toContain(
      "Copyright 2022 The Noto Project Authors (https://github.com/notofonts/arabic)",
    );
    expect(licence).toContain(
      "Copyright 2024 The Noto Project Authors (https://github.com/notofonts/hebrew)",
    );
    expect(licence).toContain(
      "(c) 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'.",
    );
    expect(licence).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});

type Drawn = { text: string; font: string; x: number; width: number; pdfX: number; pdfY: number };

/**
 * Draws `text` at (190, 100) in a fresh uncompressed document and returns each `doc.text` call
 * with the font it used, and the text position PDFKit wrote to the content stream for it.
 */
async function draw(text: string, options: FallbackTextOptions = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.registerFont("Body", documentFonts().regular);
  doc.font("Body").fontSize(10);
  const internals = doc as unknown as { _font: { name: string } };
  const calls: Omit<Drawn, "pdfX" | "pdfY">[] = [];
  const original = doc.text.bind(doc);
  vi.spyOn(doc, "text").mockImplementation(((value: string, x: number, ...rest: never[]) => {
    calls.push({ text: value, font: internals._font.name, x, width: doc.widthOfString(value) });
    return original(value, x, ...rest);
  }) as never);
  textWithFallback(doc, "Body", text, 190, 100, { width: 355, ...options });
  const docY = doc.y;
  const lineHeight = doc.currentLineHeight(true);
  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));
  const pdf = Buffer.concat(chunks).toString("latin1");
  const positions = [...pdf.matchAll(/BT\n1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)].map((m) => ({
    pdfX: Number(m[1]),
    pdfY: Number(m[2]),
  }));
  expect(positions).toHaveLength(calls.length);
  const drawn: Drawn[] = calls.map((call, i) => ({ ...call, ...positions[i] }) as Drawn);
  return { drawn, docY, lineHeight };
}

describe("textWithFallback layout", () => {
  it("draws a mixed name left to right on one alphabetic baseline, without gaps or overlaps", async () => {
    const { drawn } = await draw("Ahmed أحمد Ltd");
    expect(drawn.map((run) => run.text)).toEqual(["Ahmed ", "أحمد", " Ltd"]);
    expect(drawn.map((run) => run.font)).toEqual([
      "NotoSans-Regular",
      "NotoSansArabic-Regular",
      "NotoSans-Regular",
    ]);
    expect(new Set(drawn.map((run) => run.pdfY)).size).toBe(1);
    for (let i = 1; i < drawn.length; i++) {
      const before = drawn[i - 1] as Drawn;
      expect((drawn[i] as Drawn).pdfX).toBeCloseTo(before.pdfX + before.width, 1);
    }
  });

  it("puts the baseline where plain Latin text at the same y has it", async () => {
    const latin = await draw("Ahmed Ltd");
    const mixed = await draw("Ahmed أحمد محمد Ltd");
    expect(latin.drawn).toHaveLength(1);
    for (const run of mixed.drawn) expect(run.pdfY).toBe(latin.drawn[0]?.pdfY);
    expect(mixed.drawn.map((run) => run.text)).toEqual(["Ahmed ", "محمد", " ", "أحمد", " Ltd"]);
    const xs = mixed.drawn.map((run) => run.pdfX);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("draws digits left of an Arabic word that starts the name, with the space between", async () => {
    const { drawn } = await draw("شركة 123");
    expect(drawn.map((run) => run.text)).toEqual(["123", " ", "شركة"]);
    expect(new Set(drawn.map((run) => run.pdfY)).size).toBe(1);
  });

  it("wraps a long CJK name inside the width instead of overflowing it", async () => {
    const name =
      "张伟明北京国际艺术品拍卖有限公司上海分公司深圳办事处广州联络处杭州代表处南京联络办公室成都西南区域总部";
    const { drawn, docY, lineHeight } = await draw(name);
    for (const run of drawn) expect(run.x + run.width).toBeLessThanOrEqual(190 + 355 + 0.01);
    const baselines = [...new Set(drawn.map((run) => run.pdfY))];
    expect(baselines.length).toBeGreaterThan(1);
    expect(drawn.map((run) => run.text).join("")).toBe(name);
    expect(docY).toBeCloseTo(100 + baselines.length * lineHeight, 5);
  });

  it("wraps a long mixed name at spaces, keeping the bidi order on each line", async () => {
    const name =
      "Northbank Gallery الشركة العربية للفنون الجميلة والتحف النادرة والمزادات الدولية المحدودة Holdings International Ltd and Partners of the Royal Northbank Fine Art Trust";
    const { drawn, docY } = await draw(name);
    for (const run of drawn) expect(run.x + run.width).toBeLessThanOrEqual(190 + 355 + 0.01);
    const lines = [...new Set(drawn.map((run) => run.pdfY))];
    expect(lines.length).toBeGreaterThan(1);
    const first = drawn.filter((run) => run.pdfY === lines[0]);
    expect(first[0]?.text).toBe("Northbank Gallery ");
    // The first Arabic word is the rightmost Arabic word of its line.
    const arabic = first.filter((run) => run.font === "NotoSansArabic-Regular");
    expect(arabic.at(-1)?.text).toBe("الشركة");
    expect(docY).toBeGreaterThan(100 + lines.length * 10);
  });

  it("shrinks a name a little to keep it on one line, but not below the minimum size", async () => {
    const name = "Northbank Gallery الشركة العربية للفنون الجميلة والتحف النادرة Ltd";
    const { drawn } = await draw(name, { width: 300 });
    expect(new Set(drawn.map((run) => run.pdfY)).size).toBe(1);
    expect(drawn.at(-1)?.x).toBeDefined();
    const last = drawn.at(-1) as Drawn;
    expect(last.x + last.width).toBeLessThanOrEqual(190 + 300 + 0.01);
  });

  it("reports characters no bundled font draws, such as Korean hangul, by code point", async () => {
    const onMissingGlyph = vi.fn();
    await draw("김민수 Kim", { onMissingGlyph });
    expect(onMissingGlyph).toHaveBeenCalledWith([0xae40, 0xbbfc, 0xc218]);
    onMissingGlyph.mockClear();
    await draw("Ahmed أحمد 王小明 Zoë", { onMissingGlyph });
    expect(onMissingGlyph).not.toHaveBeenCalled();
  });

  it("warns by default, naming code points and not the name", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await draw("김민수");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("U+AE40");
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("김");
    warn.mockRestore();
  });
});

describe("invoice PDF with non-Latin buyer names", () => {
  it("embeds a matching fallback font for each script", async () => {
    const expected = {
      arabic: "NotoSansArabic",
      hebrew: "NotoSansHebrew",
      chinese: "NotoSansSC",
      japanese: "NotoSansSC",
    } as const;
    for (const [script, name] of Object.entries(SAMPLES)) {
      const pdf = (await renderBidInvoicePdf(invoice(name))).toString("latin1");
      expect(pdf, script).toContain(expected[script as keyof typeof expected]);
    }
  });

  it("embeds every slice a name needs, not just the first", async () => {
    const pdf = (await renderBidInvoicePdf(invoice(SAMPLES.chinese))).toString("latin1");
    expect(pdf.match(/NotoSansSC-Regular/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("embeds no fallback font for a Latin name", async () => {
    const pdf = (await renderBidInvoicePdf(invoice("Northbank Gallery"))).toString("latin1");
    expect(pdf).not.toMatch(/NotoSans(Arabic|Hebrew|SC)/);
  });
});
