import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util";
import { NO_VALUATION_NOTE, buildWorkDetail, findWork } from "./portfolio-work-detail.vm";

const ORIGINS = ["https://cdn.lax.bid"];

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
      { kind: "invoice", available: true, href: "https://lax.bid/purchases#payment-history" },
      { kind: "provenance", available: false },
    ],
    actions: [
      { kind: "consign", href: "https://lax.bid/selling/new" },
      { kind: "contact", href: "mailto:art@lax.bid" },
    ],
  });

  it("keeps every cost line in its own currency and shipping apart from the cost basis", () => {
    const vm = buildWorkDetail(full, ORIGINS);
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
    const vm = buildWorkDetail(full, ORIGINS);
    expect(vm.documents.map((doc) => [doc.label, doc.href !== null, doc.note])).toEqual([
      ["Invoice", true, null],
      ["Certificate of authenticity", false, "Sent after payment clears."],
      ["Provenance", false, "We'll add it here when it's ready."],
    ]);
  });

  it("names the print and the certificate the product described", () => {
    const vm = buildWorkDetail(
      item({
        edition: "No. 7 of 24 · Hand-signed",
        documents: [
          {
            kind: "certificate",
            available: false,
            label: "Certificate of authenticity No. 7/24",
            expectedNote: "Your certificate comes with your print.",
          },
        ],
      }),
      ORIGINS,
    );
    expect(vm.edition).toBe("No. 7 of 24 · Hand-signed");
    expect(vm.documents).toEqual([
      {
        key: "certificate",
        label: "Certificate of authenticity No. 7/24",
        href: null,
        note: "Your certificate comes with your print.",
      },
    ]);
  });

  it("shows an issued certificate as a link under its number", () => {
    const vm = buildWorkDetail(
      item({
        documents: [
          {
            kind: "certificate",
            available: true,
            href: "https://shop.lax.art/account/documents",
            label: "Certificate of authenticity No. 7/24",
          },
        ],
      }),
      ORIGINS,
    );
    expect(vm.documents[0]).toMatchObject({
      label: "Certificate of authenticity No. 7/24",
      href: "https://shop.lax.art/account/documents",
      note: null,
    });
    expect(vm.edition).toBeNull();
  });

  it("drops actions whose link is not a safe web link", () => {
    expect(buildWorkDetail(full, ORIGINS).actions).toEqual([
      {
        key: "consign",
        label: "Consign this work",
        href: "https://lax.bid/selling/new",
      },
    ]);
  });

  it("says there is no valuation yet", () => {
    expect(buildWorkDetail(full, ORIGINS).valueNote).toBe(NO_VALUATION_NOTE);
    expect(NO_VALUATION_NOTE).toMatch(/^No valuation yet\./);
  });

  it("reads amounts as due while the invoice is unpaid", () => {
    expect(buildWorkDetail(item({ status: "awaiting_payment" }), ORIGINS).costsAreDue).toBe(true);
    expect(buildWorkDetail(full, ORIGINS).costsAreDue).toBe(false);
  });

  it("only shows an image on an allowed media origin", () => {
    expect(buildWorkDetail(full, ORIGINS).image).toBe("https://cdn.lax.bid/a.jpg");
    expect(buildWorkDetail(item({ image: "javascript:x" }), ORIGINS).image).toBeNull();
    expect(
      buildWorkDetail(item({ image: "https://evil.example/a.jpg" }), ORIGINS).image,
    ).toBeNull();
  });
});

describe("findWork", () => {
  it("matches on product and id together", () => {
    const items = [item({ id: "1" }), item({ id: "1", product: "shop" })];
    expect(findWork(items, "shop", "1")?.product).toBe("shop");
    expect(findWork(items, "art", "1")).toBeUndefined();
  });
});
