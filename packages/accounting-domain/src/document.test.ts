import { describe, expect, it } from "vitest";
import { isValidIsoDate } from "./dates.js";
import {
  type CreditNote,
  DOCUMENT_KINDS,
  type Invoice,
  LEGAL_ENTITY_NAMES,
  PRODUCTS,
  buildBill,
  buildContact,
  buildCreditNoteFor,
  buildInvoice,
  buildPayment,
  expectedTotals,
  laxReference,
  legalEntityFor,
  parseLaxReference,
} from "./document.js";
import { type LineInput, lineAmounts, lineGrossPence } from "./money.js";
import { forAll, int, pick } from "./testing/generate.js";

const lineInput = (over: Partial<LineInput> = {}): LineInput => ({
  description: "Print",
  quantity: 1,
  unitNetPence: 10_000,
  treatment: "standard",
  role: "goods",
  ...over,
});
const lines = (): LineInput[] => [lineInput()];
const common = { product: "shop" as const, sourceId: "1" };
const contact = "LAX-SHOP-CON-9";

function ref(
  product: (typeof PRODUCTS)[number],
  kind: (typeof DOCUMENT_KINDS)[number],
  id: string,
) {
  const r = laxReference(product, kind, id);
  if (!r.ok) throw new Error("fixture");
  return r.value;
}

describe("laxReference", () => {
  it("carries product, kind and source id", () => {
    expect(laxReference("shop", "invoice", "ord_123")).toEqual({
      ok: true,
      value: "LAX-SHOP-INV-ord_123",
    });
    expect(laxReference("lax_art", "invoice", "123")).toEqual({
      ok: true,
      value: "LAX-ART-INV-123",
    });
    expect(laxReference("bid", "bill", "123")).toEqual({ ok: true, value: "LAX-BID-BILL-123" });
  });
  it("Shop order 123 and lax.art order 123 never share a reference", () => {
    for (const kind of DOCUMENT_KINDS) {
      expect(ref("shop", kind, "123")).not.toBe(ref("lax_art", kind, "123"));
      expect(ref("bid", kind, "123")).not.toBe(ref("shop", kind, "123"));
    }
  });
  it("property: injective over (product, kind, sourceId), and parse inverts it", () => {
    const seen = new Map<string, string>();
    forAll(2000, (rng) => {
      const product = pick(rng, PRODUCTS);
      const kind = pick(rng, DOCUMENT_KINDS);
      const alphabet = [..."ab01_-"];
      const sourceId = Array.from({ length: int(rng, 1, 4) }, () => pick(rng, alphabet)).join("");
      const r = laxReference(product, kind, sourceId);
      if (!r.ok) {
        expect(/^[_-]/.test(sourceId)).toBe(true);
        return;
      }
      const triple = `${product}|${kind}|${sourceId}`;
      const earlier = seen.get(r.value);
      if (earlier !== undefined) expect(earlier).toBe(triple);
      seen.set(r.value, triple);
      expect(parseLaxReference(r.value)).toEqual({ ok: true, value: { product, kind, sourceId } });
    });
  });
  it("is deterministic", () => {
    expect(laxReference("bid", "invoice", "a")).toEqual(laxReference("bid", "invoice", "a"));
  });
  it.each(["", " ", "a b", "x/y", "-lead", "é", "a".repeat(65), "ABC", "aBc"])(
    "refuses %j",
    (id) => {
      expect(laxReference("shop", "invoice", id).ok).toBe(false);
    },
  );
  it("the longest reference stays short enough for a provider field", () => {
    expect(ref("lax_art", "bill", "a".repeat(64)).length).toBeLessThanOrEqual(80);
  });
  it.each(["", "LAX-INV-1", "LAX-XXX-INV-1", "LAX-SHOP-XXX-1", "LAX-SHOP-INV-", "shop-inv-1"])(
    "parseLaxReference refuses %j",
    (text) => {
      expect(parseLaxReference(text)).toMatchObject({ refusal: { code: "bad_reference" } });
    },
  );
});

describe("calendar dates", () => {
  it("accepts real dates, leap days only in leap years", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2000-02-29")).toBe(true);
    expect(isValidIsoDate("2026-12-31")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2100-02-29")).toBe(false);
  });
  it.each([
    "2026-02-30",
    "2026-13-45",
    "2026-00-10",
    "2026-04-31",
    "2026-01-00",
    "26-01-01",
    "2026-1-1",
    "",
    "x",
  ])("refuses %j", (d) => {
    expect(isValidIsoDate(d)).toBe(false);
  });
  it("property: valid iff the month has that day", () => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    forAll(500, (rng) => {
      const m = int(rng, 1, 12);
      const d = int(rng, 1, 33);
      const text = `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      expect(isValidIsoDate(text)).toBe(d <= (days[m - 1] as number));
    });
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

const inv = {
  ...common,
  contactReference: contact,
  issuedOn: "2026-01-01",
  dueOn: "2026-01-15",
};

describe("builders", () => {
  it("builds an invoice in GBP with a derived reference, totals and the product's entity", () => {
    const r = buildInvoice({ ...inv, lines: lines() });
    expect(r).toMatchObject({
      ok: true,
      value: {
        reference: "LAX-SHOP-INV-1",
        currency: "GBP",
        entity: "london_art_exchange",
        totals: { netPence: 10_000, vatPence: 2_000, grossPence: 12_000 },
      },
    });
  });
  it("cannot be handed a forged line: negative net, VAT on margin scheme, bad quantity", () => {
    const bad = [
      lineInput({ unitNetPence: -500, treatment: "margin_scheme" }),
      lineInput({ quantity: 0 }),
      lineInput({ unitNetPence: 1.5 }),
      lineInput({ description: " " }),
    ];
    for (const l of bad) {
      expect(buildInvoice({ ...inv, lines: [l] })).toMatchObject({ refusal: { code: "bad_line" } });
    }
    // VAT is always computed here, so margin scheme can never carry any
    const r = buildInvoice({ ...inv, lines: [lineInput({ treatment: "margin_scheme" })] });
    expect(r).toMatchObject({ ok: true, value: { totals: { vatPence: 0, grossPence: 10_000 } } });
  });
  it("refuses a reference of the wrong kind, product or shape, and a blank contact", () => {
    for (const contactReference of ["LAX-PAY-1", "LAX-SHOP-PAY-1", "LAX-BID-CON-9", "", "x"]) {
      expect(buildInvoice({ ...inv, contactReference, lines: lines() })).toMatchObject({
        refusal: { code: "bad_reference" },
      });
      expect(buildBill({ ...inv, contactReference, lines: lines() })).toMatchObject({
        refusal: { code: "bad_reference" },
      });
    }
  });
  it("refuses a bad source id", () => {
    expect(buildInvoice({ ...inv, sourceId: "A B", lines: lines() })).toMatchObject({
      refusal: { code: "bad_source_id" },
    });
  });
  it("refuses no lines, too many lines, a zero total, bad dates and due before issue", () => {
    expect(buildInvoice({ ...inv, lines: [] })).toMatchObject({ refusal: { code: "no_lines" } });
    expect(
      buildInvoice({ ...inv, lines: Array.from({ length: 1001 }, () => lineInput()) }),
    ).toMatchObject({
      refusal: { code: "too_many_lines" },
    });
    expect(buildInvoice({ ...inv, lines: [lineInput({ unitNetPence: 0 })] })).toMatchObject({
      refusal: { code: "zero_total" },
    });
    expect(buildBill({ ...inv, lines: [lineInput({ unitNetPence: 0 })] })).toMatchObject({
      refusal: { code: "zero_total" },
    });
    for (const issuedOn of ["2 Jan", "2026-02-30"]) {
      expect(buildInvoice({ ...inv, issuedOn, lines: lines() })).toMatchObject({
        refusal: { code: "bad_date" },
      });
    }
    expect(buildInvoice({ ...inv, dueOn: "2026-13-45", lines: lines() })).toMatchObject({
      refusal: { code: "bad_date" },
    });
    expect(buildInvoice({ ...inv, dueOn: "2025-12-31", lines: lines() })).toMatchObject({
      refusal: { code: "bad_date" },
    });
  });
  it("accepts a zero-priced line next to priced ones (free delivery)", () => {
    const r = buildInvoice({
      ...inv,
      lines: [lineInput(), lineInput({ role: "delivery", unitNetPence: 0 })],
    });
    expect(r.ok).toBe(true);
  });
  it("builds a bill for Bid under London Auction Xchange", () => {
    expect(
      buildBill({ ...inv, product: "bid", contactReference: "LAX-BID-CON-9", lines: lines() }),
    ).toMatchObject({
      ok: true,
      value: { entity: "london_auction_xchange", reference: "LAX-BID-BILL-1" },
    });
  });
  it("builds a contact and refuses a blank name", () => {
    expect(buildContact({ ...common, name: "  Ada  " })).toMatchObject({
      ok: true,
      value: { name: "Ada", email: null, reference: "LAX-SHOP-CON-1" },
    });
    expect(buildContact({ ...common, name: " " })).toMatchObject({ refusal: { code: "bad_name" } });
  });
  it("expectedTotals: priced documents, a payment's amount, nothing for a contact", () => {
    const i = buildInvoice({ ...inv, lines: lines() });
    if (!i.ok) throw new Error("fixture");
    expect(expectedTotals(i.value)).toEqual(i.value.totals);
    const p = buildPayment({
      ...common,
      contactReference: contact,
      receivedOn: "2026-01-03",
      amountPence: 700,
      allocations: [],
    });
    if (!p.ok) throw new Error("fixture");
    expect(expectedTotals(p.value)).toEqual({ netPence: 700, vatPence: 0, grossPence: 700 });
    const c = buildContact({ ...common, name: "A" });
    if (!c.ok) throw new Error("fixture");
    expect(expectedTotals(c.value)).toEqual({ netPence: 0, vatPence: 0, grossPence: 0 });
  });

  describe("payment", () => {
    const p = { ...common, contactReference: contact, receivedOn: "2026-01-03" };
    const A = "LAX-SHOP-INV-a";
    const B = "LAX-SHOP-INV-b";
    it("allocates to several invoices and reports the remainder", () => {
      const r = buildPayment({
        ...p,
        amountPence: 10_000,
        allocations: [
          { invoiceReference: B, amountPence: 3_000 },
          { invoiceReference: A, amountPence: 6_000 },
        ],
      });
      expect(r).toMatchObject({ ok: true, value: { unallocatedPence: 1_000 } });
      if (r.ok) expect(r.value.allocations.map((a) => a.invoiceReference)).toEqual([A, B]);
    });
    it("never over-allocates", () => {
      expect(
        buildPayment({
          ...p,
          amountPence: 100,
          allocations: [{ invoiceReference: A, amountPence: 101 }],
        }),
      ).toMatchObject({ refusal: { code: "over_allocated" } });
    });
    it("refuses allocations to something that is not an invoice of this product", () => {
      for (const invoiceReference of ["A", "LAX-SHOP-CN-a", "LAX-ART-INV-a"]) {
        expect(
          buildPayment({
            ...p,
            amountPence: 10,
            allocations: [{ invoiceReference, amountPence: 1 }],
          }),
        ).toMatchObject({ refusal: { code: "bad_reference" } });
      }
      expect(
        buildPayment({ ...p, contactReference: "c", amountPence: 10, allocations: [] }),
      ).toMatchObject({ refusal: { code: "bad_reference" } });
    });
    it("refuses bad amounts, bad allocations, duplicates and bad dates", () => {
      expect(buildPayment({ ...p, amountPence: 0, allocations: [] }).ok).toBe(false);
      expect(buildPayment({ ...p, amountPence: 1.5, allocations: [] }).ok).toBe(false);
      expect(
        buildPayment({
          ...p,
          amountPence: 10,
          allocations: [{ invoiceReference: A, amountPence: 0 }],
        }),
      ).toMatchObject({ refusal: { code: "bad_allocation" } });
      expect(
        buildPayment({
          ...p,
          amountPence: 10,
          allocations: [
            { invoiceReference: A, amountPence: 1 },
            { invoiceReference: A, amountPence: 1 },
          ],
        }),
      ).toMatchObject({ refusal: { code: "bad_allocation" } });
      expect(
        buildPayment({ ...p, receivedOn: "2026-02-30", amountPence: 10, allocations: [] }).ok,
      ).toBe(false);
    });
    it("sorts allocations by code unit, not locale", () => {
      const r = buildPayment({
        ...p,
        amountPence: 10,
        allocations: ["LAX-SHOP-INV-b", "LAX-SHOP-INV-a_b", "LAX-SHOP-INV-a-b"].map(
          (invoiceReference) => ({
            invoiceReference,
            amountPence: 1,
          }),
        ),
      });
      if (!r.ok) throw new Error("fixture");
      expect(r.value.allocations.map((a) => a.invoiceReference)).toEqual([
        "LAX-SHOP-INV-a-b",
        "LAX-SHOP-INV-a_b",
        "LAX-SHOP-INV-b",
      ]);
    });
  });
});

describe("contact email", () => {
  it("accepts a plain address and refuses text that is not one", () => {
    expect(buildContact({ ...common, name: "Ada", email: "ada@example.com" }).ok).toBe(true);
    for (const email of ["not-an-email", "a@b", "a b@c.com", "@x.com", "a@.com"]) {
      expect(buildContact({ ...common, name: "Ada", email })).toMatchObject({
        refusal: { code: "bad_email" },
      });
    }
  });
});

describe("credit notes are bounded by the original invoice", () => {
  const inv0 = () => ({ ...inv });
  const original = (): Invoice => {
    const r = buildInvoice({
      ...inv,
      lines: [
        lineInput({ description: "Print", unitNetPence: 10_000 }), // gross 12_000 standard
        lineInput({ description: "Antique", unitNetPence: 5_000, treatment: "margin_scheme" }), // 5_000
        lineInput({ description: "Post", role: "delivery", unitNetPence: 1_000 }), // gross 1_200
      ],
    });
    if (!r.ok) throw new Error("fixture");
    return r.value;
  };
  const buckets = {
    paidGoodsPence: 17_000,
    paidDeliveryPence: 1_200,
    refundedGoodsPence: 0,
    refundedDeliveryPence: 0,
  };
  const args = {
    sourceId: "cn1",
    issuedOn: "2026-02-01",
    buckets,
    priorCredits: [] as CreditNote[],
  };

  it("credits the whole invoice line by line, keeping each VAT treatment", () => {
    const r = buildCreditNoteFor(original(), {
      ...args,
      request: { goodsPence: 17_000, deliveryPence: 1_200 },
    });
    expect(r).toMatchObject({
      ok: true,
      value: {
        reference: "LAX-SHOP-CN-cn1",
        invoiceReference: "LAX-SHOP-INV-1",
        contactReference: contact,
        totals: { netPence: 16_000, vatPence: 2_200, grossPence: 18_200 },
      },
    });
    if (!r.ok) return;
    expect(r.value.lines.map((l) => l.treatment)).toEqual([
      "standard",
      "margin_scheme",
      "standard",
    ]);
    expect(r.value.lines.map((l) => l.role)).toEqual(["goods", "goods", "delivery"]);
  });
  it("credits a margin-scheme part with no VAT", () => {
    const r = buildCreditNoteFor(original(), {
      ...args,
      request: { goodsPence: 12_000 + 2_000, deliveryPence: 0 },
    });
    expect(r).toMatchObject({ ok: true, value: { totals: { grossPence: 14_000 } } });
    if (r.ok)
      expect(r.value.lines.at(-1)).toMatchObject({ treatment: "margin_scheme", vatPence: 0 });
  });
  it("refuses more than the invoice's goods or delivery", () => {
    const i = original();
    const big = { ...buckets, paidGoodsPence: 99_999, paidDeliveryPence: 99_999 };
    expect(
      buildCreditNoteFor(i, {
        ...args,
        buckets: big,
        request: { goodsPence: 17_001, deliveryPence: 0 },
      }),
    ).toMatchObject({ refusal: { code: "exceeds_invoice" } });
    expect(
      buildCreditNoteFor(i, {
        ...args,
        buckets: big,
        request: { goodsPence: 0, deliveryPence: 1_201 },
      }),
    ).toMatchObject({ refusal: { code: "exceeds_invoice" } });
  });
  it("refuses more than was paid, even when the invoice has room", () => {
    expect(
      buildCreditNoteFor(original(), {
        ...args,
        buckets: { ...buckets, paidGoodsPence: 100 },
        request: { goodsPence: 101, deliveryPence: 0 },
      }),
    ).toMatchObject({ refusal: { code: "refund_refused" } });
  });
  it("refuses a zero credit note", () => {
    expect(
      buildCreditNoteFor(original(), { ...args, request: { goodsPence: 0, deliveryPence: 0 } }),
    ).toMatchObject({ refusal: { code: "refund_refused" } });
  });
  it("counts earlier credit notes against the invoice", () => {
    const i = original();
    const first = buildCreditNoteFor(i, {
      ...args,
      request: { goodsPence: 12_000, deliveryPence: 0 },
    });
    if (!first.ok) throw new Error("fixture");
    const again = {
      ...args,
      sourceId: "cn2",
      priorCredits: [first.value],
      buckets: { ...buckets, refundedGoodsPence: 12_000 },
    };
    expect(
      buildCreditNoteFor(i, { ...again, request: { goodsPence: 5_000, deliveryPence: 0 } }).ok,
    ).toBe(true);
    expect(
      buildCreditNoteFor(i, { ...again, request: { goodsPence: 5_001, deliveryPence: 0 } }),
    ).toMatchObject({ refusal: { code: "refund_refused" } });
    // paid buckets allow it but the invoice does not
    expect(
      buildCreditNoteFor(i, {
        ...again,
        buckets: { ...buckets, paidGoodsPence: 99_999, refundedGoodsPence: 0 },
        request: { goodsPence: 5_001, deliveryPence: 0 },
      }),
    ).toMatchObject({ refusal: { code: "exceeds_invoice" } });
  });
  it("refuses when a prior credit note is left out, so its VAT cannot be credited twice", () => {
    const i = original();
    const first = buildCreditNoteFor(i, {
      ...args,
      request: { goodsPence: 12_000, deliveryPence: 0 },
    });
    if (!first.ok) throw new Error("fixture");
    const next = {
      ...args,
      sourceId: "cn2",
      buckets: { ...buckets, refundedGoodsPence: 12_000 },
      request: { goodsPence: 5_000, deliveryPence: 0 },
    };
    expect(buildCreditNoteFor(i, { ...next, priorCredits: [] })).toMatchObject({
      refusal: { code: "bad_invoice" },
    });
    expect(buildCreditNoteFor(i, { ...next, priorCredits: [first.value] }).ok).toBe(true);
  });
  it("refuses a prior credit note from another invoice, bad dates and a date before the invoice", () => {
    const i = original();
    const other = buildInvoice({ ...inv, sourceId: "2", lines: lines() });
    if (!other.ok) throw new Error("fixture");
    const cn = buildCreditNoteFor(other.value, {
      ...args,
      request: { goodsPence: 100, deliveryPence: 0 },
    });
    if (!cn.ok) throw new Error("fixture");
    const request = { goodsPence: 100, deliveryPence: 0 };
    expect(buildCreditNoteFor(i, { ...args, request, priorCredits: [cn.value] })).toMatchObject({
      refusal: { code: "bad_reference" },
    });
    expect(buildCreditNoteFor(i, { ...args, request, issuedOn: "2026-02-30" })).toMatchObject({
      refusal: { code: "bad_date" },
    });
    expect(buildCreditNoteFor(i, { ...args, request, issuedOn: "2025-12-31" })).toMatchObject({
      refusal: { code: "bad_date" },
    });
    expect(buildCreditNoteFor(i, { ...args, request, sourceId: "A B" })).toMatchObject({
      refusal: { code: "bad_source_id" },
    });
  });
  it("accepts every partial gross amount, including ones with no whole-penny net", () => {
    // At 20% no net gives a gross of 3 (net 2 -> 2, net 3 -> 4); inclusive VAT handles it.
    for (const gross of [3, 4, 9, 1_003]) {
      expect(
        buildCreditNoteFor(original(), {
          ...args,
          request: { goodsPence: 0, deliveryPence: gross },
        }),
      ).toMatchObject({ ok: true, value: { totals: { grossPence: gross } } });
    }
  });
  it("property: every gross up to the remaining creditable gross is accepted, over many lines", () => {
    forAll(40, (rng) => {
      const unit = int(rng, 1, 400_000);
      const qty = int(rng, 1, 4);
      const inv = buildInvoice({
        ...inv0(),
        lines: [lineInput({ unitNetPence: unit, quantity: qty })],
      });
      if (!inv.ok) throw new Error("fixture");
      const total = inv.value.totals.grossPence;
      const probes = [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        total - 1,
        total,
        ...Array.from({ length: 60 }, () => int(rng, 1, total)),
      ];
      for (const g of probes) {
        if (g < 1 || g > total) continue;
        const r = buildCreditNoteFor(inv.value, {
          ...args,
          buckets: { ...buckets, paidGoodsPence: total, paidDeliveryPence: 0 },
          request: { goodsPence: g, deliveryPence: 0 },
        });
        expect(r.ok, `gross ${g} of line ${unit}x${qty}`).toBe(true);
        if (!r.ok) return;
        const line = r.value.lines[0];
        expect(r.value.totals.grossPence).toBe(g);
        const exact = (g * inv.value.totals.vatPence) / total;
        expect(Math.abs((line?.vatPence ?? 0) - exact)).toBeLessThanOrEqual(0.5);
      }
    });
  });
  it("exhaustively accepts every gross from 1 to the line gross for small lines", () => {
    for (const unit of [1, 5, 7, 100, 833, 1_001]) {
      const inv = buildInvoice({ ...inv0(), lines: [lineInput({ unitNetPence: unit })] });
      if (!inv.ok) throw new Error("fixture");
      const total = inv.value.totals.grossPence;
      for (let g = 1; g <= total; g++) {
        const r = buildCreditNoteFor(inv.value, {
          ...args,
          buckets: { ...buckets, paidGoodsPence: total, paidDeliveryPence: 0 },
          request: { goodsPence: g, deliveryPence: 0 },
        });
        expect(r.ok && r.value.totals.grossPence, `unit ${unit} gross ${g}`).toBe(g);
      }
    }
  });
  it("a forged invoice (lines rewritten by spread) is refused", () => {
    const i = original();
    const forged = {
      ...i,
      lines: i.lines.map((l) => ({ ...l, unitNetPence: 10_000_000, vatPence: 0 })),
    };
    expect(
      buildCreditNoteFor(forged, { ...args, request: { goodsPence: 5_000_000, deliveryPence: 0 } }),
    ).toMatchObject({ ok: false, refusal: { code: "bad_invoice" } });
    const retotalled = { ...i, totals: { ...i.totals, grossPence: 1 } };
    expect(
      buildCreditNoteFor(retotalled, { ...args, request: { goodsPence: 1, deliveryPence: 0 } }),
    ).toMatchObject({ refusal: { code: "bad_invoice" } });
    const wrongRef = { ...i, reference: "LAX-SHOP-PAY-1" };
    expect(
      buildCreditNoteFor(wrongRef, { ...args, request: { goodsPence: 1, deliveryPence: 0 } }),
    ).toMatchObject({ refusal: { code: "bad_invoice" } });
    const wrongEntity = { ...i, entity: "london_auction_xchange" as const };
    expect(
      buildCreditNoteFor(wrongEntity, { ...args, request: { goodsPence: 1, deliveryPence: 0 } }),
    ).toMatchObject({ refusal: { code: "bad_invoice" } });
  });
  it("property: any accepted credit equals the request exactly and stays within the invoice", () => {
    const i = original();
    forAll(300, (rng) => {
      const goodsPence = int(rng, 0, 18_000);
      const deliveryPence = int(rng, 0, 1_500);
      const r = buildCreditNoteFor(i, {
        ...args,
        buckets: { ...buckets, paidGoodsPence: 20_000, paidDeliveryPence: 2_000 },
        request: { goodsPence, deliveryPence },
      });
      if (!r.ok) return;
      const sum = (role: string) =>
        r.value.lines
          .filter((l) => l.role === role)
          .reduce((n, l) => n + l.quantity * l.unitNetPence + l.vatPence, 0);
      expect(sum("goods")).toBe(goodsPence);
      expect(sum("delivery")).toBe(deliveryPence);
      expect(r.value.totals.grossPence).toBeLessThanOrEqual(i.totals.grossPence);
    });
  });
});

describe("partial credits on one line (F1, F2, F4)", () => {
  const invoiceOf = (unit: number, quantity = 1): Invoice => {
    const r = buildInvoice({
      ...common,
      contactReference: contact,
      issuedOn: "2026-01-01",
      dueOn: "2026-01-31",
      lines: [lineInput({ unitNetPence: unit, quantity })],
    });
    if (!r.ok) throw new Error("fixture");
    return r.value;
  };
  const credit = (invoice: Invoice, prior: CreditNote[], gross: number, id: string) => {
    const total = invoice.totals.grossPence;
    return buildCreditNoteFor(invoice, {
      sourceId: id,
      issuedOn: "2026-02-01",
      buckets: {
        paidGoodsPence: total,
        paidDeliveryPence: 0,
        refundedGoodsPence: prior.reduce((n, c) => n + c.totals.grossPence, 0),
        refundedDeliveryPence: 0,
      },
      request: { goodsPence: gross, deliveryPence: 0 },
      priorCredits: prior,
    });
  };
  const run = (invoice: Invoice, grosses: readonly number[]): CreditNote[] => {
    const notes: CreditNote[] = [];
    grosses.forEach((g, i) => {
      const r = credit(invoice, notes, g, `cn${i}`);
      if (!r.ok) throw new Error(`credit ${g}: ${r.refusal.message}`);
      notes.push(r.value);
    });
    return notes;
  };
  const sums = (notes: readonly CreditNote[]) => ({
    vat: notes.reduce((n, c) => n + c.totals.vatPence, 0),
    net: notes.reduce((n, c) => n + c.totals.netPence, 0),
    gross: notes.reduce((n, c) => n + c.totals.grossPence, 0),
  });

  it("the review's splits of a 1,200p line never credit more than 200p VAT", () => {
    for (const split of [
      [3, 1197],
      [501, 699],
      [9, 1191],
      [1, 1199],
    ]) {
      const notes = run(invoiceOf(1000), split);
      expect(sums(notes)).toEqual({ vat: 200, net: 1000, gross: 1200 });
    }
  });
  it("four hundred 3p credits credit exactly the invoice's VAT, not 400p", () => {
    const notes = run(
      invoiceOf(1000),
      Array.from({ length: 400 }, () => 3),
    );
    expect(sums(notes)).toEqual({ vat: 200, net: 1000, gross: 1200 });
  });
  it("property: any sequence of partial credits stays within, then exactly meets, the line", () => {
    forAll(150, (rng) => {
      const inv = invoiceOf(int(rng, 1, 5000), int(rng, 1, 3));
      const total = inv.totals.grossPence;
      const notes: CreditNote[] = [];
      let left = total;
      let steps = 0;
      while (left > 0 && steps++ < 40) {
        const g = rng() < 0.2 ? left : int(rng, 1, Math.min(left, pick(rng, [3, 20, 500, left])));
        const r = credit(inv, notes, g, `cn${steps}`);
        if (!r.ok) throw new Error(r.refusal.message);
        notes.push(r.value);
        left -= g;
        const s = sums(notes);
        expect(s.vat).toBeLessThanOrEqual(inv.totals.vatPence);
        expect(s.gross).toBe(total - left);
        expect(s.net + s.vat).toBe(s.gross);
        for (const c of notes)
          for (const l of c.lines) expect(l.vatPence).toBeLessThanOrEqual(lineGrossPence(l));
      }
      if (left > 0) {
        const r = credit(inv, notes, left, "last");
        if (!r.ok) throw new Error(r.refusal.message);
        notes.push(r.value);
      }
      expect(sums(notes)).toEqual({
        vat: inv.totals.vatPence,
        net: inv.totals.netPence,
        gross: inv.totals.grossPence,
      });
      expect(credit(inv, notes, 1, "over")).toMatchObject({ ok: false });
    });
  });
  it("declares tax-inclusive amounts on the note and on every credit line", () => {
    const inv = invoiceOf(1000);
    const [cn] = run(inv, [3]);
    expect(cn?.amountsAre).toBe("tax_inclusive");
    for (const l of cn?.lines ?? []) expect(l.basis).toBe("tax_inclusive");
    for (const l of inv.lines) expect(l.basis).toBe("tax_exclusive");
  });
  it("reading each credit line under its declared basis reproduces the totals for every gross", () => {
    const inv = invoiceOf(1000);
    for (let g = 1; g <= 1200; g++) {
      const r = credit(inv, [], g, "x");
      if (!r.ok) throw new Error(`gross ${g}`);
      const read = r.value.lines.map(lineAmounts);
      expect(read.every((a) => a.basis === "tax_inclusive")).toBe(true);
      expect(read.reduce((n, a) => n + a.grossPence, 0)).toBe(g);
      expect(read.reduce((n, a) => n + a.vatPence, 0)).toBe(r.value.totals.vatPence);
    }
  });
  it("refuses a prior credit note that was emptied, inflated or rewritten (F4)", () => {
    const inv = invoiceOf(1000);
    const [first] = run(inv, [1200]);
    if (!first) throw new Error("fixture");
    const emptied = { ...first, lines: [], totals: { netPence: 0, vatPence: 0, grossPence: 0 } };
    const line0 = first.lines[0];
    if (!line0) throw new Error("fixture");
    const rewritten = { ...first, lines: [{ ...line0, vatPence: 1, unitNetPence: 1199 }] };
    const doubled = { ...first, lines: [...first.lines, ...first.lines], totals: first.totals };
    for (const bad of [emptied, rewritten, doubled]) {
      // The buckets say 2,400p was paid and nothing refunded, so only the prior check can refuse.
      const next = buildCreditNoteFor(inv, {
        sourceId: "next",
        issuedOn: "2026-02-01",
        buckets: {
          paidGoodsPence: 2400,
          paidDeliveryPence: 0,
          refundedGoodsPence: 0,
          refundedDeliveryPence: 0,
        },
        request: { goodsPence: 1200, deliveryPence: 0 },
        priorCredits: [bad as CreditNote],
      });
      expect(next).toMatchObject({
        ok: false,
        refusal: { code: "bad_invoice" },
      });
    }
  });
});
