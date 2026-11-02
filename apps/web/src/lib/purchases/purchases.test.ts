import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.schema";
import type { Lot, PortfolioRow } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  canReportProblem,
  defaultPurchaseTab,
  isToPay,
  parsePurchaseTab,
  purchaseState,
  purchaseStep,
  purchaseTab,
} from "./purchase-progress";
import {
  appliedPurchaseFilters,
  parsePurchasesListQuery,
  purchasesInView,
  purchasesListSearch,
} from "./purchases-list";
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

  it("ends a refunded or cancelled purchase, however it is read", () => {
    const state = (
      paymentStatus: Parameters<typeof purchaseState>[0]["paymentStatus"],
      f: LotFulfilmentSnapshot | null = null,
    ) => purchaseState({ paymentStatus, reviewReason: "aml_hold", fulfilment: f });
    expect(state("cancelled")).toBe("cancelled");
    expect(state("refunded")).toBe("refunded");
    expect(state("pending", fulfilment({ status: "cancelled" }))).toBe("cancelled");
    expect(state("captured", fulfilment({ status: "cancelled" }))).toBe("cancelled");
    expect(purchaseTab("cancelled")).toBe("completed");
    expect(isToPay("cancelled")).toBe(false);
    expect(isToPay("refunded")).toBe(false);
    expect(isToPay("pending")).toBe(true);
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

function facts(
  lotId: string,
  invoice: AccountPurchaseFacts["invoice"],
  overrides: Partial<AccountPurchaseFacts> = {},
): AccountPurchaseFacts {
  return {
    lotId,
    wonBy: { userId: "u-2", name: "Tom Whitfield" },
    paymentRole: "payer",
    invoice,
    delivery: {
      stage: "awaiting_payment",
      method: null,
      carrier: null,
      trackingNumber: null,
      collectedBy: null,
      collectedAt: null,
      quote: null,
    },
    ...overrides,
  };
}

describe("buildPurchasesVm", () => {
  it("sorts every purchase into its view", () => {
    const vm = buildPurchasesVm(sources());
    expect(vm.cardsByTab["to-pay"].map((card) => card.lotId)).toEqual(["lot-5"]);
    expect(vm.cardsByTab["in-progress"].map((card) => card.lotId)).toEqual(["lot-11"]);
    expect(vm.cardsByTab.completed.map((card) => card.lotId)).toEqual(["lot-7"]);
    expect(vm.total).toBe(3);
    expect(vm.sales).toEqual([{ id: "sale-2", title: "Jewels and objects of vertu" }]);
  });

  it("keeps a cancelled purchase out of To pay, the banner and the badge, whatever its invoice says", () => {
    const vm = buildPurchasesVm(
      sources({
        rows: [
          row("lot-5", 5, { id: "p5", status: "pending", manualReviewReason: null }),
          row("lot-6", 6, { id: "p6", status: "cancelled", manualReviewReason: null }),
          row("lot-8", 8, null),
        ],
        factsByLot: {
          "lot-5": facts("lot-5", {
            status: "due",
            dueAt: new Date("2026-11-06T12:00:00Z"),
            paymentId: "p5",
            totalDue: "8000.00",
          }),
          "lot-6": facts("lot-6", {
            status: "cancelled",
            dueAt: new Date("2026-10-22T12:00:00Z"),
            paymentId: "p6",
            totalDue: "2875.00",
          }),
          // Unpaid, and cancelled on delivery.
          "lot-8": facts(
            "lot-8",
            {
              status: "due",
              dueAt: new Date("2026-11-06T12:00:00Z"),
              paymentId: "p8",
              totalDue: "1.00",
            },
            {
              delivery: {
                stage: "cancelled",
                method: null,
                carrier: null,
                trackingNumber: null,
                collectedBy: null,
                collectedAt: null,
                quote: null,
              },
            },
          ),
        },
      }),
    );
    expect(vm.cardsByTab["to-pay"].map((card) => card.lotId)).toEqual(["lot-5"]);
    expect(
      vm.cardsByTab.completed.map((card) => [card.lotId, card.badge.label, card.amountLabel]),
    ).toEqual([
      ["lot-6", "Cancelled", "was due"],
      ["lot-8", "Cancelled", "was due"],
    ]);
    expect(vm.payNow).toMatchObject({ kind: "pay", lotIds: ["lot-5"] });
  });

  it("sums what is due into one payment, and says which are overdue", () => {
    const vm = buildPurchasesVm(
      sources({
        rows: [row("lot-5", 5, null), row("lot-6", 6, null)],
        factsByLot: {
          "lot-5": facts("lot-5", {
            status: "overdue",
            dueAt: new Date("2026-10-29T12:00:00Z"),
            paymentId: "p5",
            totalDue: "8000.00",
          }),
          "lot-6": facts("lot-6", {
            status: "due",
            dueAt: new Date("2026-11-06T12:00:00Z"),
            paymentId: "p6",
            totalDue: "8000.00",
          }),
        },
      }),
    );
    expect(vm.payNow).toEqual({
      kind: "pay",
      title: "2 invoices · £16,000.00 due",
      description: "One is overdue. Pay them together by card or bank transfer.",
      lotIds: ["lot-5", "lot-6"],
      total: "16000.00",
    });
    expect(vm.cardsByTab["to-pay"].map((card) => card.badge.label)).toEqual([
      "Overdue since 29 Oct",
      "Due 6 Nov",
    ]);
  });

  it("never offers to pay an invoice not raised yet", () => {
    const vm = buildPurchasesVm(
      sources({
        rows: [row("lot-5", 5, null)],
        factsByLot: {
          "lot-5": facts("lot-5", {
            status: "not_invoiced",
            dueAt: null,
            paymentId: null,
            totalDue: null,
          }),
        },
      }),
    );
    expect(vm.payNow).toBeNull();
    expect(vm.cardsByTab["to-pay"][0]).toMatchObject({
      payable: null,
      badge: { label: "Invoice to follow" },
    });
  });

  it("names who won a lot on a shared list, and the delivery stage after payment", () => {
    const vm = buildPurchasesVm(
      sources({
        showWonBy: true,
        factsByLot: {
          "lot-11": facts(
            "lot-11",
            { status: "paid", dueAt: null, paymentId: "p11", totalDue: "8000.00" },
            {
              delivery: {
                stage: "quote_ready",
                method: null,
                carrier: null,
                trackingNumber: null,
                collectedBy: null,
                collectedAt: null,
                quote: null,
              },
            },
          ),
        },
      }),
    );
    expect(vm.cardsByTab["in-progress"][0]).toMatchObject({
      wonBy: "Tom Whitfield",
      badge: { label: "Quote ready", tone: "warning" },
      amountLabel: "total paid",
    });
    expect(vm.winners).toEqual(["Tom Whitfield"]);
  });

  it("shows a due purchase with its deadline, breakdown and its own page", () => {
    const [card] = buildPurchasesVm(sources()).cardsByTab["to-pay"];
    expect(card).toMatchObject({
      statusNote: "Pay by 31 October",
      amountLabel: "total due",
      amount: "£8,000.00",
      detailHref: "/purchases/lot-5",
      payable: { totalDue: "8000", currency: "GBP" },
      breakdown: [
        { label: "Hammer price", value: "£6,400.00" },
        { label: "Buyer's premium", value: "£1,600.00" },
      ],
      problemHref: null,
    });
    expect(card?.steps?.map((step) => [step.id, step.progress, step.date])).toEqual([
      ["won", "done", "24 Oct"],
      ["payment", "current", "Due 31 Oct"],
      ["delivery", "upcoming", null],
      ["delivered", "upcoming", null],
    ]);
  });

  it("marks every step done once delivered", () => {
    const [card] = buildPurchasesVm(sources()).cardsByTab.completed;
    expect(card?.badge.label).toBe("Delivered");
    expect(card?.steps?.every((step) => step.progress === "done")).toBe(true);
  });

  it("explains a review instead of offering to pay", () => {
    const vm = buildPurchasesVm(sources({ complianceGate: "source_of_funds_required" }));
    expect(vm.payNow?.kind).toBe("review");
    expect(vm.cardsByTab["to-pay"][0]).toMatchObject({
      statusLabel: "In review",
      payable: null,
      primaryAction: { label: "Provide documents" },
    });
  });
});

describe("the Purchases list query", () => {
  it("filters by sale and winner, searches, and sorts by due date", () => {
    const vm = buildPurchasesVm(sources({ showWonBy: true }));
    const all = Object.values(vm.cardsByTab).flat();
    const query = parsePurchasesListQuery({ q: "work 7" }, "completed");
    expect(purchasesInView(all, query).map((card) => card.lotId)).toEqual(["lot-7"]);
    expect(purchasesListSearch(query)).toBe("?tab=completed&q=work+7");
    expect(appliedPurchaseFilters({ ...query, sale: "sale-2", wonBy: "Tom" }, vm.sales)).toEqual([
      { id: "sale", label: "Sale: Jewels and objects of vertu" },
      { id: "wonBy", label: "Won by: Tom" },
    ]);
  });
});
