import { describe, expect, it } from "vitest";
import { type BidInvoiceDocument, renderBidInvoicePdf } from "./bid-invoice.pdf.js";
import { needsFallback, splitRuns, visualOrder } from "./fallback-fonts.js";

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

describe("splitRuns and visualOrder", () => {
  it("keeps Latin in the main font and the other script in its own run", () => {
    const runs = splitRuns("Ahmed أحمد Ltd");
    expect(runs.map((run) => run.text)).toEqual(
      ["Ahmed ", "أحمد", " ", "Ltd"].slice(0, runs.length),
    );
    expect(runs.some((run) => run.file?.includes("arabic"))).toBe(true);
    expect(runs[0]?.file).toBeNull();
  });

  it("draws right-to-left runs in reverse order", () => {
    const runs = visualOrder(splitRuns("שלום עולם"));
    expect(runs.filter((run) => run.rtl).length).toBeGreaterThan(0);
    expect(runs.map((run) => run.text).join("")).toContain("עולם");
  });

  it("puts each CJK character in a slice that holds it", () => {
    const files = new Set(splitRuns(SAMPLES.chinese).map((run) => run.file));
    expect(files.size).toBeGreaterThan(1);
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
