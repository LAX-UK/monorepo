import type { AdminOrderDetail, AdminOrderReturn } from "@auction/shop-contracts";
import { SHOP_RETURN_STATUSES } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECEIVE_DISPOSITION,
  RECEIVE_CHOICES,
  RETURN_STEPS,
  cancelledLineStock,
  orderReturnRows,
  returnAction,
  returnStepIndex,
} from "./order-returns.vm";

const LINE = "11111111-0000-4000-8000-000000000001";

function returnRow(overrides: Partial<AdminOrderReturn> = {}): AdminOrderReturn {
  return {
    returnId: "r1000000-0000-4000-8000-000000000001".replace("r", "a"),
    orderLineId: LINE,
    editionId: "e1000000-0000-4000-8000-000000000001",
    status: "requested",
    disposition: null,
    receivedAt: null,
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}

function order(returns: AdminOrderReturn[] | undefined): AdminOrderDetail {
  return {
    orderId: "d701e66d-0000-4000-8000-000000000000",
    status: "paid",
    fulfilment: "uk_insured_delivery",
    totalPence: 60_000,
    buyerSubjectId: "buyer",
    buyerName: null,
    buyerEmail: null,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    paidAt: null,
    createdAt: "2026-10-14T21:29:00.000Z",
    lines: [
      {
        orderLineId: LINE,
        artworkId: "a1",
        artworkTitle: "Marylebone at dusk",
        productTitle: null,
        sku: null,
        editionId: "e1",
        editionNumber: 12,
        unitPricePence: 60_000,
        sellerPartyId: null,
        production: null,
      },
    ],
    fulfilmentRecord: null,
    refunds: [],
    activity: [],
    ...(returns ? { returns } : {}),
  };
}

describe("return steps", () => {
  it("names the three steps an item goes through", () => {
    expect(RETURN_STEPS.map((step) => step.label)).toEqual(["Requested", "In transit", "Received"]);
  });

  it("places each open status on its step, and a closed return on none", () => {
    expect(returnStepIndex("requested")).toBe(0);
    expect(returnStepIndex("in_transit")).toBe(1);
    expect(returnStepIndex("received")).toBe(2);
    expect(returnStepIndex("cancelled")).toBeNull();
  });

  it("offers only the next move: mark in transit, then receive, then nothing", () => {
    expect(returnAction("requested")).toBe("mark_in_transit");
    expect(returnAction("in_transit")).toBe("receive");
    expect(returnAction("received")).toBeNull();
    expect(returnAction("cancelled")).toBeNull();
    expect(SHOP_RETURN_STATUSES.length).toBe(4);
  });
});

describe("receiving a return", () => {
  it("starts on back on sale, and names the choice on its button", () => {
    expect(DEFAULT_RECEIVE_DISPOSITION).toBe("back_on_sale");
    expect(RECEIVE_CHOICES.map((choice) => choice.label)).toEqual([
      "Back on sale",
      "Withdraw (damaged)",
    ]);
    expect(RECEIVE_CHOICES.map((choice) => choice.confirmLabel)).toEqual([
      "Receive and put back on sale",
      "Receive and withdraw",
    ]);
  });
});

describe("orderReturnRows", () => {
  it("shows no rows for an order without returns, or from an older API", () => {
    expect(orderReturnRows(order([]))).toEqual([]);
    expect(orderReturnRows(order(undefined))).toEqual([]);
  });

  it("describes an open return with the item, step and next action", () => {
    const [row] = orderReturnRows(order([returnRow({ status: "in_transit" })]));
    expect(row).toMatchObject({
      item: "Marylebone at dusk, edition 12",
      step: 1,
      action: "receive",
      outcome: null,
    });
    expect(row?.statusLabel.label).toBe("On its way back");
    expect(row?.context).toMatch(/^Requested /);
  });

  it("shows what staff decided once the print is received", () => {
    const received = (disposition: string) =>
      orderReturnRows(
        order([
          returnRow({ status: "received", disposition, receivedAt: "2026-10-25T09:00:00.000Z" }),
        ]),
      )[0];
    expect(received("back_on_sale")?.outcome).toEqual({ label: "Back on sale", tone: "success" });
    expect(received("withdrawn_damaged")?.outcome).toEqual({
      label: "Withdrawn, damaged",
      tone: "neutral",
    });
    expect(received("back_on_sale")?.action).toBeNull();
    expect(received("back_on_sale")?.context).toContain("received");
  });

  it("leaves out a return with a status it does not know", () => {
    expect(orderReturnRows(order([returnRow({ status: "lost" })]))).toEqual([]);
  });
});

describe("cancelledLineStock", () => {
  it("says back on sale for a print that never left, as it has no return", () => {
    expect(cancelledLineStock(order([]), LINE)).toEqual({ label: "Back on sale", tone: "success" });
  });

  it("says awaiting return while the print is on its way back", () => {
    expect(cancelledLineStock(order([returnRow()]), LINE)).toEqual({
      label: "Awaiting return",
      tone: "info",
    });
  });

  it("follows the decision made on receipt", () => {
    const decided = (disposition: string) =>
      cancelledLineStock(order([returnRow({ status: "received", disposition })]), LINE)?.label;
    expect(decided("back_on_sale")).toBe("Back on sale");
    expect(decided("withdrawn_damaged")).toBe("Withdrawn, damaged");
  });
});
