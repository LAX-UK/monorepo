import { describe, expect, it } from "vitest";
import {
  type CrmDeliveryStatusSnapshot,
  aggregateStatusTotals,
  buildCrmDeliveryStatusReport,
} from "./crm-delivery-status-report.js";

describe("crm-delivery-status-report", () => {
  const snapshot: CrmDeliveryStatusSnapshot = {
    consumer: "zoho",
    oldestPendingAgeSeconds: 12,
    countsByEventTypeAndStatus: [
      { eventType: "user.registered", status: "succeeded", count: 2 },
      { eventType: "user.registered", status: "pending", count: 1 },
    ],
    retryableRecent: [
      {
        eventId: 99,
        eventType: "user.registered",
        attempts: 2,
        updatedAt: "2026-09-29T00:00:00.000Z",
        lastError: "zoho_crm_http_429",
      },
    ],
    deadLetteredRecent: [],
  };

  it("buildCrmDeliveryStatusReport emits JSON lines without payloads", () => {
    const report = buildCrmDeliveryStatusReport(snapshot);
    expect(report).toContain('"consumer":"zoho"');
    expect(report).toContain("retryableRecent");
    expect(report).not.toContain("payload");
  });

  it("aggregateStatusTotals sums across event types", () => {
    expect(aggregateStatusTotals(snapshot.countsByEventTypeAndStatus)).toEqual({
      succeeded: 2,
      pending: 1,
    });
  });
});
