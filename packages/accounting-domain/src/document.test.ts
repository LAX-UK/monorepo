import { describe, expect, it } from "vitest";
import {
  DOCUMENT_KINDS,
  LEGAL_ENTITY_NAMES,
  PRODUCTS,
  buildBill,
  buildContact,
  buildCreditNote,
  buildInvoice,
  buildPayment,
  laxReference,
  legalEntityFor,
} from "./document.js";
import { type Line, buildLine } from "./money.js";

const lines = (): Line[] => {
  const l = buildLine({
    description: "Print",
    quantity: 1,
    unitNetPence: 10_000,
    treatment: "standard",
  });
  if (!l.ok) throw new Error("fixture");
  return [l.value];
};
const common = { product: "shop" as const, reference: "LAX-INV-1" };

describe("laxReference", () => {
  it("is deterministic per kind and source id", () => {
    expect(laxReference("invoice", "ord_123")).toEqual({ ok: true, value: "LAX-INV-ord_123" });
    expect(laxReference("invoice", "ord_123")).toEqual(laxReference("invoice", "ord_123"));
  });
  it("differs by kind, so an invoice and its credit note never collide", () => {
    const refs = DOCUMENT_KINDS.map((k) => laxReference(k, "42"));
    const values = refs.map((r) => (r.ok ? r.value : ""));
    expect(new Set(values).size).toBe(DOCUMENT_KINDS.length);
    expect(values).toContain("LAX-PAY-42");
    expect(values).toContain("LAX-CN-42");
    expect(values).toContain("LAX-BILL-42");
    expect(values).toContain("LAX-CON-42");
  });
  it.each(["", " ", "a b", "x/y", "-lead", "é", "a".repeat(65)])("refuses %j", (id) => {
    expect(laxReference("invoice", id).ok).toBe(false);
  });
});

describe("legal entity", () => {
  it("Bid is London Auction Xchange; Shop and lax.art are London Art Exchange", () => {
    expect(LEGAL_ENTITY_NAMES[legalEntityFor("bid")]).toBe("London Auction Xchange LTD");
    expect(LEGAL_ENTITY_NAMES[legalEntityFor("shop")]).toBe("London Art Exchange Ltd");
    expect(LEGAL_ENTITY_NAMES[legalEntityFor("lax_art")]).toBe("London Art Exchange Ltd");
    expect(PRODUCTS).toHaveLength(3);
  });
});

describe("builders", () => {
  it("builds an invoice in GBP with totals and the product's entity", () => {
    const r = buildInvoice({
      ...common,
      contactReference: "LAX-CON-1",
      issuedOn: "2026-01-01",
      dueOn: "2026-01-15",
      lines: lines(),
    });
    expect(r).toMatchObject({
      ok: true,
      value: {
        currency: "GBP",
        entity: "london_art_exchange",
        totals: { netPence: 10_000, vatPence: 2_000, grossPence: 12_000 },
      },
    });
  });
  it("refuses an invoice with no lines, bad dates, or due before issue", () => {
    const base = { ...common, contactReference: "c", issuedOn: "2026-01-02", dueOn: "2026-01-15" };
    expect(buildInvoice({ ...base, lines: [] })).toMatchObject({ refusal: { code: "no_lines" } });
    expect(buildInvoice({ ...base, issuedOn: "2 Jan", lines: lines() })).toMatchObject({
      refusal: { code: "bad_date" },
    });
    expect(buildInvoice({ ...base, dueOn: "2026-01-01", lines: lines() })).toMatchObject({
      refusal: { code: "bad_date" },
    });
  });
  it("builds a credit note and a bill; refuses empty ones", () => {
    expect(
      buildCreditNote({
        ...common,
        contactReference: "c",
        invoiceReference: "i",
        issuedOn: "2026-01-02",
        lines: lines(),
      }).ok,
    ).toBe(true);
    expect(
      buildCreditNote({
        ...common,
        contactReference: "c",
        invoiceReference: "i",
        issuedOn: "2026-01-02",
        lines: [],
      }).ok,
    ).toBe(false);
    expect(
      buildCreditNote({
        ...common,
        contactReference: "c",
        invoiceReference: "i",
        issuedOn: "bad",
        lines: lines(),
      }).ok,
    ).toBe(false);
    expect(
      buildBill({
        ...common,
        product: "bid",
        contactReference: "c",
        issuedOn: "2026-01-02",
        dueOn: "2026-02-01",
        lines: lines(),
      }),
    ).toMatchObject({
      ok: true,
      value: { entity: "london_auction_xchange" },
    });
    expect(
      buildBill({
        ...common,
        contactReference: "c",
        issuedOn: "2026-01-02",
        dueOn: "2026-02-01",
        lines: [],
      }).ok,
    ).toBe(false);
    expect(
      buildBill({
        ...common,
        contactReference: "c",
        issuedOn: "2026-03-02",
        dueOn: "2026-02-01",
        lines: lines(),
      }).ok,
    ).toBe(false);
    expect(
      buildBill({
        ...common,
        contactReference: "c",
        issuedOn: "x",
        dueOn: "2026-02-01",
        lines: lines(),
      }).ok,
    ).toBe(false);
  });
  it("builds a contact and refuses a blank name", () => {
    expect(buildContact({ ...common, name: "  Ada  " })).toMatchObject({
      ok: true,
      value: { name: "Ada", email: null },
    });
    expect(buildContact({ ...common, name: " " })).toMatchObject({ refusal: { code: "bad_name" } });
  });
  describe("payment", () => {
    const p = { ...common, contactReference: "c", receivedOn: "2026-01-03" };
    it("allocates to several invoices and reports the remainder", () => {
      const r = buildPayment({
        ...p,
        amountPence: 10_000,
        allocations: [
          { invoiceReference: "B", amountPence: 3_000 },
          { invoiceReference: "A", amountPence: 6_000 },
        ],
      });
      expect(r).toMatchObject({ ok: true, value: { unallocatedPence: 1_000 } });
      if (r.ok) expect(r.value.allocations.map((a) => a.invoiceReference)).toEqual(["A", "B"]);
    });
    it("never over-allocates", () => {
      expect(
        buildPayment({
          ...p,
          amountPence: 100,
          allocations: [{ invoiceReference: "A", amountPence: 101 }],
        }),
      ).toMatchObject({ refusal: { code: "over_allocated" } });
    });
    it("refuses bad amounts, bad allocations, duplicates and bad dates", () => {
      expect(buildPayment({ ...p, amountPence: 0, allocations: [] }).ok).toBe(false);
      expect(buildPayment({ ...p, amountPence: 1.5, allocations: [] }).ok).toBe(false);
      expect(
        buildPayment({
          ...p,
          amountPence: 10,
          allocations: [{ invoiceReference: "A", amountPence: 0 }],
        }),
      ).toMatchObject({ refusal: { code: "bad_allocation" } });
      expect(
        buildPayment({
          ...p,
          amountPence: 10,
          allocations: [
            { invoiceReference: "A", amountPence: 1 },
            { invoiceReference: "A", amountPence: 1 },
          ],
        }),
      ).toMatchObject({ refusal: { code: "bad_allocation" } });
      expect(buildPayment({ ...p, receivedOn: "x", amountPence: 10, allocations: [] }).ok).toBe(
        false,
      );
    });
  });
});
