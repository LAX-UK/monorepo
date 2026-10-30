import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { NotificationFactory } from "./notification.factory.js";

const factory = new NotificationFactory();

const lot = {
  id: "lot-1",
  title: "Blue Vase",
} as Lot;

describe("NotificationFactory condition report", () => {
  it("createConditionReportReady", () => {
    const row = factory.createConditionReportReady(lot, "user-1", "org-1");
    expect(row.type).toBe("condition_report_ready");
    expect(row.userId).toBe("user-1");
    expect(row.legalEntityId).toBe("org-1");
    expect(row.lotId).toBe("lot-1");
    expect(row.title).toMatch(/ready/i);
  });

  it("createConditionReportDeclined", () => {
    const row = factory.createConditionReportDeclined(lot, "user-1", "org-1", "Not available");
    expect(row.type).toBe("condition_report_declined");
    expect(row.message).toContain("Not available");
  });
});

describe("NotificationFactory lot won", () => {
  it("createWon includes optional hammer and total in meta", () => {
    const row = factory.createWon(lot, "user-1", {
      hammerPrice: "1000.00",
      totalDue: "1250.00",
    });
    expect(row.meta?.hammerPrice).toBe("1000.00");
    expect(row.meta?.totalDue).toBe("1250.00");
  });
});

describe("NotificationFactory payment due", () => {
  it("createPaymentDue appends due date to message and meta", () => {
    const row = factory.createPaymentDue(lot, "user-1", {
      paymentId: "pay-1",
      amount: "1250.00",
      checkoutUrl: null,
      dueDate: "3 July 2026",
    });
    expect(row.message).toContain("Payment due by 3 July 2026");
    expect(row.meta?.dueDate).toBe("3 July 2026");
  });
});

describe("NotificationFactory payment received", () => {
  it("carries the amount and audience so email renders from metadata, not the message", () => {
    const buyer = factory.createPaymentReceived(lot, "user-1", "1250.00");
    expect(buyer.meta).toMatchObject({ audience: "buyer", amount: "1250.00" });
    const seller = factory.createSellerPaymentReceived(lot, "user-2", "1250.00");
    expect(seller.meta).toMatchObject({ audience: "seller", amount: "1250.00" });
  });
});

describe("NotificationFactory lot ended for the seller", () => {
  it("reports a sale with the hammer price", () => {
    const row = factory.createEndedSeller(lot, "seller-1", { hammerPrice: "1000.00" });
    expect(row).toMatchObject({ type: "lot_ended_seller", userId: "seller-1", lotId: "lot-1" });
    expect(row.meta).toMatchObject({ outcome: "sold", hammerPrice: "1000.00" });
  });

  it("reports an unsold lot without a price", () => {
    const row = factory.createEndedSeller(lot, "seller-1");
    expect(row.meta).toMatchObject({ outcome: "unsold" });
    expect(row.meta?.hammerPrice).toBeUndefined();
    expect(row.message).toContain("without a sale");
  });
});

describe("NotificationFactory lot fulfilment", () => {
  it("tells the buyer where to collect when the place is known", () => {
    const row = factory.createLotReadyForCollection(lot, "user-1", {
      collectionPlace: "Mayfair Rooms, 1 High Street, London, W1 1AA",
    });
    expect(row).toMatchObject({
      type: "lot_ready_for_collection",
      userId: "user-1",
      lotId: "lot-1",
      title: "Your lot is ready to collect",
    });
    expect(row.message).toBe(
      '"Blue Vase" is ready for you to collect from Mayfair Rooms, 1 High Street, London, W1 1AA.',
    );
    expect(row.meta).toMatchObject({
      collectionPlace: "Mayfair Rooms, 1 High Street, London, W1 1AA",
    });
  });

  it("points to the purchase when no place is known", () => {
    const row = factory.createLotReadyForCollection(lot, "user-1", { collectionPlace: "  " });
    expect(row.message).toBe(
      '"Blue Vase" is ready for you to collect. Open your purchase for the collection details.',
    );
    expect(row.meta?.collectionPlace).toBeUndefined();
  });

  it("names the carrier and tracking number when the lot ships", () => {
    const row = factory.createLotShipped(lot, "user-1", {
      carrier: "DHL",
      trackingNumber: "JD0146000012345",
    });
    expect(row).toMatchObject({ type: "lot_shipped", title: "Your lot is on its way" });
    expect(row.message).toBe(
      '"Blue Vase" has been sent with DHL. Tracking number: JD0146000012345.',
    );
    expect(row.meta).toMatchObject({ carrier: "DHL", trackingNumber: "JD0146000012345" });
  });

  it("words delivery and collection differently under one type", () => {
    const delivered = factory.createLotDelivered(lot, "user-1", { method: "delivery" });
    const collected = factory.createLotDelivered(lot, "user-1", { method: "collection" });
    expect(delivered).toMatchObject({
      type: "lot_delivered",
      title: "Your lot has been delivered",
    });
    expect(collected).toMatchObject({
      type: "lot_delivered",
      title: "Your lot has been collected",
    });
    expect(collected.message).toContain("has been collected");
  });

  it("uses plain sentences with no em dashes", () => {
    const rows = [
      factory.createLotReadyForCollection(lot, "u"),
      factory.createLotShipped(lot, "u", { carrier: "DHL", trackingNumber: "1" }),
      factory.createLotDelivered(lot, "u", { method: "delivery" }),
    ];
    for (const r of rows) expect(`${r.title} ${r.message}`).not.toContain("\u2014");
  });
});
