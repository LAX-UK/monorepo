import { describe, expect, it } from "vitest";
import { DELIVERY_QUOTE_STATUSES } from "./delivery-quote.js";
import {
  DELIVERY_STATUSES,
  type DeliveryStatusFacts,
  deliveryStatusOf,
} from "./delivery-status.js";
import { type FulfilmentFacts, purchaseDeliveryStage } from "./purchase-delivery-stage.js";
import type { PurchaseInvoiceStatus } from "./purchase-invoice-state.js";

const shipping = (status: FulfilmentFacts["status"]): FulfilmentFacts => ({
  status,
  method: "shipping",
});
const collection = (status: FulfilmentFacts["status"]): FulfilmentFacts => ({
  status,
  method: "collection",
});

/** The facts of an open purchase: the invoice is raised and not paid yet. */
const facts = (
  quote: DeliveryStatusFacts["quote"],
  fulfilment: FulfilmentFacts | null,
  invoice: PurchaseInvoiceStatus = "due",
): DeliveryStatusFacts => ({ quote, fulfilment, invoice });

describe("deliveryStatusOf", () => {
  it("follows the quote until the work moves", () => {
    expect(deliveryStatusOf(facts("requested", null)).status).toBe("waiting");
    expect(deliveryStatusOf(facts("quoted", null)).status).toBe("quoted");
    expect(deliveryStatusOf(facts("accepted", shipping("awaiting_release"), "paid")).status).toBe(
      "to_dispatch",
    );
    expect(deliveryStatusOf(facts("accepted", shipping("released"), "paid")).status).toBe(
      "to_dispatch",
    );
  });

  it("is on the way once the courier has it, and delivered when it arrives", () => {
    expect(deliveryStatusOf(facts("accepted", shipping("in_transit"), "paid"))).toEqual({
      status: "on_the_way",
      closedReason: null,
      awaitingPayment: false,
    });
    expect(deliveryStatusOf(facts("accepted", shipping("delivered"), "paid")).status).toBe(
      "delivered",
    );
    // An older record with no method recorded is read as the courier's, as the buyer's page does.
    expect(
      deliveryStatusOf(facts("accepted", { status: "in_transit", method: null }, "paid")).status,
    ).toBe("on_the_way");
  });

  it("is only on the way or delivered by courier: a lot collected in person closes the request", () => {
    expect(deliveryStatusOf(facts("accepted", collection("delivered"), "paid"))).toEqual({
      status: "closed",
      closedReason: "collected",
      awaitingPayment: false,
    });
    expect(deliveryStatusOf(facts("requested", collection("delivered"), "paid"))).toMatchObject({
      status: "closed",
      closedReason: "collected",
    });
    // A collection record is never "on the way": the quote still says where things stand.
    expect(deliveryStatusOf(facts("accepted", collection("in_transit"), "paid")).status).toBe(
      "to_dispatch",
    );
    expect(deliveryStatusOf(facts("quoted", collection("in_transit"), "paid")).status).toBe(
      "quoted",
    );
  });

  it("closes a withdrawn request whatever the lot did next", () => {
    for (const fulfilment of [null, shipping("delivered"), shipping("in_transit")]) {
      expect(deliveryStatusOf(facts("withdrawn", fulfilment))).toEqual({
        status: "closed",
        closedReason: "withdrawn",
        awaitingPayment: false,
      });
    }
  });

  it("closes a delivery whose sale was cancelled, even once accepted", () => {
    expect(deliveryStatusOf(facts("accepted", shipping("cancelled")))).toEqual({
      status: "closed",
      closedReason: "cancelled",
      awaitingPayment: false,
    });
    expect(deliveryStatusOf(facts("requested", shipping("cancelled"))).status).toBe("closed");
  });

  it("closes a delivery whose purchase was refunded or cancelled, as the buyer's page does", () => {
    for (const invoice of ["refunded", "cancelled"] as const) {
      for (const fulfilment of [null, shipping("awaiting_payment"), shipping("released")]) {
        for (const quote of ["requested", "quoted", "accepted"] as const) {
          expect(deliveryStatusOf(facts(quote, fulfilment, invoice))).toEqual({
            status: "closed",
            closedReason: "cancelled",
            awaitingPayment: false,
          });
        }
      }
    }
  });

  it("never disagrees with the buyer's delivery stage", () => {
    const invoices: PurchaseInvoiceStatus[] = [
      "not_invoiced",
      "due",
      "overdue",
      "processing",
      "paid",
      "refunded",
      "cancelled",
    ];
    const fulfilments: Array<FulfilmentFacts | null> = [null];
    for (const status of [
      "awaiting_payment",
      "awaiting_release",
      "released",
      "ready_for_collection",
      "in_transit",
      "delivered",
      "cancelled",
    ] as const) {
      for (const method of ["collection", "shipping", null] as const) {
        fulfilments.push({ status, method });
      }
    }
    const buyerSees = {
      cancelled: ["closed"],
      collected: ["closed"],
      delivered: ["delivered"],
      in_transit: ["on_the_way", "to_dispatch", "quoted", "waiting"],
    } as const;
    for (const quote of DELIVERY_QUOTE_STATUSES) {
      if (quote === "withdrawn") continue;
      for (const fulfilment of fulfilments) {
        for (const invoice of invoices) {
          const stage = purchaseDeliveryStage({ invoice, fulfilment, quote });
          const staff = deliveryStatusOf({ quote, fulfilment, invoice }).status;
          const allowed = buyerSees[stage as keyof typeof buyerSees];
          if (allowed) expect(allowed as readonly string[]).toContain(staff);
          else expect(["waiting", "quoted", "to_dispatch"]).toContain(staff);
        }
      }
    }
  });

  it("flags an accepted delivery that is not paid yet", () => {
    expect(deliveryStatusOf(facts("accepted", null)).awaitingPayment).toBe(true);
    expect(deliveryStatusOf(facts("accepted", shipping("awaiting_payment"))).awaitingPayment).toBe(
      true,
    );
    expect(
      deliveryStatusOf(facts("accepted", shipping("awaiting_release"), "paid")).awaitingPayment,
    ).toBe(false);
    // Only "Booked, not dispatched" carries the second badge.
    expect(deliveryStatusOf(facts("quoted", null)).awaitingPayment).toBe(false);
  });

  it("lists the statuses in the order of the view tabs", () => {
    expect(DELIVERY_STATUSES).toEqual([
      "waiting",
      "quoted",
      "to_dispatch",
      "on_the_way",
      "delivered",
      "closed",
    ]);
  });
});
