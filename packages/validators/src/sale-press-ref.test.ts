import { describe, expect, it } from "vitest";
import { updateSaleSchema } from "./sale.js";

function parsePress(items: unknown[]) {
  return updateSaleSchema.safeParse({ pressCoverage: items });
}

describe("salePressRefSchema — URL scheme validation", () => {
  it("accepts https URLs", () => {
    const result = parsePress([
      { url: "https://dailymail.co.uk/article/123", headline: "H", outletName: "DM" },
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts http URLs", () => {
    const result = parsePress([
      { url: "http://example.com/article", headline: "H", outletName: "O" },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects javascript: URLs", () => {
    const result = parsePress([{ url: "javascript:alert(1)", headline: "H", outletName: "O" }]);
    expect(result.success).toBe(false);
  });

  it("rejects data: URLs", () => {
    const result = parsePress([
      { url: "data:text/html,<script>alert(1)</script>", headline: "H", outletName: "O" },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects ftp: URLs", () => {
    const result = parsePress([
      { url: "ftp://files.example.com/article", headline: "H", outletName: "O" },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("salePressRefSchema — publishedAt validation", () => {
  it("accepts a valid real date", () => {
    const result = parsePress([
      {
        url: "https://example.com/a",
        headline: "H",
        outletName: "O",
        publishedAt: "2026-06-14",
      },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects an impossible calendar date", () => {
    const result = parsePress([
      {
        url: "https://example.com/a",
        headline: "H",
        outletName: "O",
        publishedAt: "2026-02-31",
      },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid format", () => {
    const result = parsePress([
      {
        url: "https://example.com/a",
        headline: "H",
        outletName: "O",
        publishedAt: "June 14 2026",
      },
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts absent publishedAt", () => {
    const result = parsePress([{ url: "https://example.com/a", headline: "H", outletName: "O" }]);
    expect(result.success).toBe(true);
  });
});

describe("salePressRefSchema — max items", () => {
  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      url: `https://example.com/article-${i}`,
      headline: `Headline ${i}`,
      outletName: "Outlet",
    }));
    const result = parsePress(items);
    expect(result.success).toBe(false);
  });

  it("accepts exactly 50 items", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      url: `https://example.com/article-${i}`,
      headline: `Headline ${i}`,
      outletName: "Outlet",
    }));
    const result = parsePress(items);
    expect(result.success).toBe(true);
  });
});
