import { describe, expect, it } from "vitest";
import {
  attachmentContentDisposition,
  clientLabel,
  formatDealName,
  formatDocumentFileName,
  formatDocumentName,
  londonYearMonth,
} from "./naming.js";

const at = new Date("2026-02-14T10:00:00Z");

describe("clientLabel", () => {
  it("uses the organisation, else the surname", () => {
    expect(clientLabel({ organisation: "Mears & Co", personName: "Ann Mears" })).toBe("Mears & Co");
    expect(clientLabel({ personName: "Ann  Marie Mears" })).toBe("Mears");
    expect(clientLabel({ personName: "Zoë O’Brien-Léger" })).toBe("O’Brien-Léger");
  });

  it("never returns an email address", () => {
    expect(clientLabel({ personName: "ann@example.com" })).toBeNull();
    expect(clientLabel({ organisation: "a@b.co", personName: null })).toBeNull();
    expect(clientLabel({ personName: "  " })).toBeNull();
  });
});

describe("londonYearMonth", () => {
  it("uses the London month at a boundary", () => {
    expect(londonYearMonth(new Date("2026-02-28T23:30:00Z"))).toBe("2026-02");
    // 23:30 UTC on 31 March is 00:30 BST on 1 April.
    expect(londonYearMonth(new Date("2026-03-31T23:30:00Z"))).toBe("2026-04");
    expect(londonYearMonth(new Date("2026-12-31T23:59:00Z"))).toBe("2026-12");
  });
});

describe("formatDealName", () => {
  it("builds the full name from a stock code", () => {
    expect(
      formatDealName({
        client: "Mears",
        stockCode: "LAX-ORI-MP-GAC-26-0037",
        dealType: "Acquisition",
        at,
      }),
    ).toBe("Mears — MP — LAX-ORI-MP-GAC-26-0037 — Acquisition — 2026-02");
  });

  it("falls back to the reference and drops the artist when there is no stock code", () => {
    expect(
      formatDealName({ client: "Mears", reference: "abc-123", dealType: "Print Order", at }),
    ).toBe("Mears — abc-123 — Print Order — 2026-02");
  });

  it("drops the artist for a stock code that is not in the LAX shape", () => {
    expect(formatDealName({ stockCode: "OLD-1", dealType: "Acquisition", at })).toBe(
      "OLD-1 — Acquisition — 2026-02",
    );
  });

  it("leaves out missing parts and keeps the type and month", () => {
    expect(formatDealName({ dealType: "Auction Consignment", at })).toBe(
      "Auction Consignment — 2026-02",
    );
  });

  it("names a multi-line order after the first line with +N", () => {
    expect(
      formatDealName({
        client: "Mears",
        stockCode: "LAX-PRI-MP-GAC-26-0005",
        additionalWorks: 2,
        dealType: "Print Order",
        at,
      }),
    ).toBe("Mears — MP — LAX-PRI-MP-GAC-26-0005 +2 — Print Order — 2026-02");
  });

  it("turns em dashes inside a part into hyphens and collapses whitespace", () => {
    expect(formatDealName({ client: "Smith — Jones\n Ltd", dealType: "Acquisition", at })).toBe(
      "Smith - Jones Ltd — Acquisition — 2026-02",
    );
  });

  it("keeps accents and stays within the CRM limit", () => {
    expect(formatDealName({ client: "Léger", dealType: "Acquisition", at })).toContain("Léger");
    expect(formatDealName({ client: "x".repeat(400), dealType: "Acquisition", at })).toHaveLength(
      255,
    );
  });
});

describe("document names", () => {
  it("builds the document name and file name", () => {
    const input = {
      docType: "Paid Invoice",
      client: "Mears",
      reference: "LAX-S-10482",
      at,
    } as const;
    expect(formatDocumentName(input)).toBe("Paid Invoice — Mears — LAX-S-10482 — 2026-02-14");
    expect(formatDocumentFileName(input)).toBe(
      "Paid Invoice — Mears — LAX-S-10482 — 2026-02-14.pdf",
    );
  });

  it("leaves out an unknown client", () => {
    expect(formatDocumentName({ docType: "Invoice", reference: "LAX-S-1", at })).toBe(
      "Invoice — LAX-S-1 — 2026-02-14",
    );
  });

  it("replaces unsafe characters", () => {
    expect(
      formatDocumentFileName({ docType: "Invoice", client: "A/B:C*D", reference: "X\\Y", at }),
    ).toBe("Invoice — A-B-C-D — X-Y — 2026-02-14.pdf");
  });

  it("uses the London date", () => {
    expect(formatDocumentName({ docType: "Invoice", at: new Date("2026-03-31T23:30:00Z") })).toBe(
      "Invoice — 2026-04-01",
    );
  });
});

describe("attachmentContentDisposition", () => {
  it("gives an ASCII fallback and an RFC 5987 name", () => {
    expect(attachmentContentDisposition("Paid Invoice — Léger — LAX-S-1 — 2026-02-14.pdf")).toBe(
      `attachment; filename="Paid Invoice - Leger - LAX-S-1 - 2026-02-14.pdf"; filename*=UTF-8''Paid%20Invoice%20%E2%80%94%20L%C3%A9ger%20%E2%80%94%20LAX-S-1%20%E2%80%94%202026-02-14.pdf`,
    );
  });

  it("cannot be broken out of by quotes or semicolons", () => {
    expect(attachmentContentDisposition('a"b;c.pdf')).toBe(
      `attachment; filename="a-b_c.pdf"; filename*=UTF-8''a-b%3Bc.pdf`,
    );
  });
});
