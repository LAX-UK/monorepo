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
    const row = factory.createConditionReportReady(lot, "user-1");
    expect(row.type).toBe("condition_report_ready");
    expect(row.userId).toBe("user-1");
    expect(row.lotId).toBe("lot-1");
    expect(row.title).toMatch(/ready/i);
  });

  it("createConditionReportDeclined", () => {
    const row = factory.createConditionReportDeclined(lot, "user-1", "Not available");
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
