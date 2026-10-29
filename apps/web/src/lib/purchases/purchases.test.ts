import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.schema";
import type { Lot, PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  canReportProblem,
  defaultPurchaseTab,
  parsePurchaseTab,
  purchaseState,
  purchaseStep,
  purchaseTab,
} from "./purchase-progress";
import { type PurchaseSources, buildPurchasesVm } from "./purchases.vm";

function fulfilment(overrides: Partial<LotFulfilmentSnapshot> = {}): LotFulfilmentSnapshot {
  return {
    id: "f1",
    lotId: "lot-11",
    status: "released",
    paymentId: "p1",
    fulfilmentMethod: null,
    shippingCarrier: null,
    trackingNumber: null,
    collectedBy: null,
    collectedAt: null,
    ...overrides,
  };
}

describe("purchaseState", () => {
  it("asks for payment until it is taken, and for documents when held", () => {
    expect(purchaseState({ paymentStatus: null, reviewReason: null, fulfilment: null })).toBe(
      "payment-due",
    );
    expect(purchaseState({ paymentStatus: "pending", reviewReason: null, fulfilment: null })).toBe(
      "payment-due",
    );
    expect(purchaseState({ paymentStatus: null, reviewReason: "aml_hold", fulfilment: null })).toBe(
      "in-review",
    );
    expect(
      purchaseState({ paymentStatus: "authorized", reviewReason: null, fulfilment: null }),
    ).toBe("payment-processing");
  });

  it("follows delivery once paid", () => {
    const paid = (f: LotFulfilmentSnapshot | null) =>
      purchaseState({ paymentStatus: "captured", reviewReason: null, fulfilment: f });
    expect(paid(null)).toBe("choose-delivery");
    expect(paid(fulfilment())).toBe("choose-delivery");
    expect(paid(fulfilment({ fulfilmentMethod: "shipping" }))).toBe("preparing");
    expect(paid(fulfilment({ status: "ready_for_collection" }))).toBe("ready-for-collection");
    expect(paid(fulfilment({ status: "in_transit" }))).toBe("in-transit");
    expect(paid(fulfilment({ status: "delivered", fulfilmentMethod: "shipping" }))).toBe(
      "delivered",
    );
    expect(paid(fulfilment({ collectedAt: "2026-07-02T10:00:00Z" }))).toBe("collected");
  });

  it("places each state on a step and in a view", () => {
    expect([purchaseStep("payment-due"), purchaseTab("payment-due")]).toEqual([
      "payment",
      "to-pay",
    ]);
    expect([purchaseStep("in-transit"), purchaseTab("in-transit")]).toEqual([
      "delivery",
      "in-progress",
    ]);
    expect([purchaseStep("collected"), purchaseTab("collected")]).toEqual([
      "delivered",
      "completed",
    ]);
    expect(purchaseTab("refunded")).toBe("completed");
  });

  it("opens Report a problem only after payment", () => {
    expect(canReportProblem("payment-due")).toBe(false);
    expect(canReportProblem("in-review")).toBe(false);
    expect(canReportProblem("choose-delivery")).toBe(true);
    expect(canReportProblem("delivered")).toBe(true);
  });

  it("opens the first view with something in it", () => {
    expect(defaultPurchaseTab({ "to-pay": 0, "in-progress": 2, completed: 1 })).toBe("in-progress");
    expect(defaultPurchaseTab({ "to-pay": 0, "in-progress": 0, completed: 0 })).toBe("to-pay");
    expect(parsePurchaseTab("completed")).toBe("completed");
    expect(parsePurchaseTab("all")).toBeNull();
  });
});

function row(id: string, lotNumber: number, payment: PortfolioRow["payment"]): PortfolioRow {
  return {
    lot: {
      id,
      saleId: "sale-2",
      lotNumber,
      title: `Work ${lotNumber}`,
      images: [],
      currentPrice: "6400",
      endTime: new Date("2026-10-24T18:00:00Z"),
      checkoutPricing: {
        hammerMajor: "6400",
        premiumMajor: "1600",
        totalMajor: "8000",
        policyId: "flat:lot",
        kind: "flat",
      },
      marketingDetails: {},
    } as unknown as Lot,
    payment,
  };
}

function sources(overrides: Partial<PurchaseSources> = {}): PurchaseSources {
  return {
    rows: [
      row("lot-5", 5, null),
      row("lot-11", 11, { id: "p11", status: "captured", manualReviewReason: null }),
      row("lot-7", 7, { id: "p7", status: "captured", manualReviewReason: null }),
    ],
    invoiceByLot: { "lot-11": "/invoices/11.pdf" },
    fulfilmentByLot: {
      "lot-7": fulfilment({
        lotId: "lot-7",
        status: "delivered",
        fulfilmentMethod: "shipping",
      }),
    },
    complianceGate: "clear",
    saleTitleById: { "sale-2": "Jewels and objects of vertu" },
    paymentRoleByLot: {},
    payerName: null,
    ...overrides,
  };
}

describe("buildPurchasesVm", () => {
  it("counts each view and opens To pay while something is due", () => {
    const vm = buildPurchasesVm(sources(), null);
    expect(vm.tab).toBe("to-pay");
    expect(vm.tabs.map((tab) => [tab.id, tab.count])).toEqual([
      ["to-pay", 1],
      ["in-progress", 1],
      ["completed", 1],
    ]);
    expect(vm.cards.map((card) => card.lotId)).toEqual(["lot-5"]);
  });

  it("pins one Pay now for what is due, by its deadline", () => {
    const vm = buildPurchasesVm(sources(), null);
    expect(vm.payNow).toEqual({
      title: "Pay for lot 5 by 31 October",
      description: "Work 5 · £8,000.00 including buyer's premium",
      href: "/purchases/checkout/lot-5",
    });
  });

  it("shows a due purchase with its deadline and breakdown, leaving Pay now to the banner", () => {
    const [card] = buildPurchasesVm(sources(), "to-pay").cards;
    expect(card).toMatchObject({
      statusLabel: "Payment due",
      statusNote: "Pay by 31 October",
      amountLabel: "Total due",
      amount: "£8,000.00",
      saleTitle: "Jewels and objects of vertu",
      breakdown: [
        { label: "Hammer", value: "£6,400.00" },
        { label: "Buyer's premium", value: "£1,600.00" },
      ],
      primaryAction: null,
      problemHref: null,
    });
    expect(card?.steps?.map((step) => [step.id, step.progress, step.date])).toEqual([
      ["won", "done", "24 Oct"],
      ["payment", "current", "Due 31 Oct"],
      ["delivery", "upcoming", null],
      ["delivered", "upcoming", null],
    ]);
  });

  it("asks a paid buyer to arrange delivery and offers the invoice", () => {
    const [card] = buildPurchasesVm(sources(), "in-progress").cards;
    expect(card).toMatchObject({
      statusLabel: "Choose delivery",
      primaryAction: { label: "Arrange delivery" },
      invoiceHref: "/invoices/11.pdf",
      problemHref: "/contact?intent=purchase-problem",
    });
  });

  it("marks every step done once delivered", () => {
    const [card] = buildPurchasesVm(sources(), "completed").cards;
    expect(card?.statusLabel).toBe("Delivered");
    expect(card?.steps?.every((step) => step.progress === "done")).toBe(true);
    expect(card?.primaryAction).toBeNull();
  });

  it("explains a review instead of offering to pay", () => {
    const vm = buildPurchasesVm(sources({ complianceGate: "source_of_funds_required" }), null);
    expect(vm.payNow?.href).toBeNull();
    expect(vm.cards[0]).toMatchObject({
      statusLabel: "In review",
      primaryAction: { label: "Provide documents" },
    });
  });

  it("narrows the views with the filters but keeps the banner and the total", () => {
    const vm = buildPurchasesVm(sources(), null, { q: "work 7", payment: "all", year: null });
    expect(vm.tabs.map((tab) => tab.count)).toEqual([0, 0, 1]);
    expect(vm.tab).toBe("completed");
    expect(vm).toMatchObject({ total: 3, shown: 1, spent: "£24,000.00" });
    expect(vm.payNow?.href).toBe("/purchases/checkout/lot-5");
    expect(vm.years).toEqual([2026]);
  });

  it("filters by payment state", () => {
    const vm = buildPurchasesVm(sources(), null, { q: "", payment: "paid", year: null });
    expect(vm.shown).toBe(2);
    expect(vm.tabs[0]?.count).toBe(0);
  });
});
