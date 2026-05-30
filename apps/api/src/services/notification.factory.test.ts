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
