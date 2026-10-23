import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util";
import { NO_VALUATION_NOTE, buildWorkDetail, findWork } from "./portfolio-work-detail.vm";

describe("buildWorkDetail", () => {
  const full = item({
    image: "https://cdn.lax.bid/a.jpg",
    paid: {
      lines: [
        { kind: "hammer", amount: 100_000, currency: "GBP" },
        { kind: "premium", amount: 25_000, currency: "GBP" },
        { kind: "shipping", amount: 4_000, currency: "GBP" },
        { kind: "price", amount: 90_000, currency: "EUR" },
      ],
    },
    documents: [
      { kind: "certificate", available: false, expectedNote: "Sent after payment clears." },
      { kind: "invoice", available: true, href: "https://lax.bid/dashboard/payments" },
      { kind: "provenance", available: false },
    ],
    actions: [
      { kind: "consign", href: "https://lax.bid/dashboard/submissions/new" },
      { kind: "contact", href: "mailto:art@lax.bid" },
    ],
  });

  it("keeps every cost line in its own currency and shipping apart from the cost basis", () => {
    const vm = buildWorkDetail(full);
    expect(vm.costLines.map((line) => [line.label, line.currency])).toEqual([
      ["Hammer price", "GBP"],
      ["Buyer's premium", "GBP"],
      ["Shipping", "GBP"],
      ["Price", "EUR"],
    ]);
    expect(vm.costBasis).toEqual([
      { currency: "EUR", amount: 90_000 },
      { currency: "GBP", amount: 125_000 },
    ]);
    expect(vm.shipping).toEqual([{ currency: "GBP", amount: 4_000 }]);
  });

  it("lists present documents first and gives each missing one a note", () => {
    const vm = buildWorkDetail(full);
    expect(vm.documents.map((doc) => [doc.label, doc.href !== null, doc.note])).toEqual([
      ["Invoice", true, null],
      ["Certificate of authenticity", false, "Sent after payment clears."],
      ["Provenance", false, "We'll add it here when it's ready."],
    ]);
  });

  it("drops actions whose link is not a safe web link", () => {
    expect(buildWorkDetail(full).actions).toEqual([
      {
        key: "consign",
        label: "Consign this work",
        href: "https://lax.bid/dashboard/submissions/new",
      },
    ]);
  });

  it("says there is no valuation yet", () => {
    expect(buildWorkDetail(full).valueNote).toBe(NO_VALUATION_NOTE);
    expect(NO_VALUATION_NOTE).toMatch(/^No valuation yet\./);
  });

  it("reads amounts as due while the invoice is unpaid", () => {
    expect(buildWorkDetail(item({ status: "awaiting_payment" })).costsAreDue).toBe(true);
    expect(buildWorkDetail(full).costsAreDue).toBe(false);
  });

  it("only shows an image on a safe link", () => {
    expect(buildWorkDetail(full).image).toBe("https://cdn.lax.bid/a.jpg");
    expect(buildWorkDetail(item({ image: "javascript:x" })).image).toBeNull();
  });
});

describe("findWork", () => {
  it("matches on product and id together", () => {
    const items = [item({ id: "1" }), item({ id: "1", product: "shop" })];
    expect(findWork(items, "shop", "1")?.product).toBe("shop");
    expect(findWork(items, "art", "1")).toBeUndefined();
  });
});
