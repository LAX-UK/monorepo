import { describe, expect, it } from "vitest";
import {
  applyWorkItemSla,
  compareWorkItems,
  isUrgentWorkItem,
} from "./admin-work-item-sla.policy.js";

describe("admin-work-item-sla.policy", () => {
  it("marks stale manual review payments overdue after 48h", () => {
    const now = Date.parse("2026-07-27T12:00:00.000Z");
    const sla = applyWorkItemSla(
      {
        sourceId: "p1",
        kind: "payment_manual_review",
        domain: "finance",
        title: "Payment",
        subtitle: null,
        href: "/admin/payments/p1",
        saleId: null,
        createdAt: new Date("2026-07-24T11:00:00.000Z"),
        sourceUpdatedAt: new Date("2026-07-24T11:00:00.000Z"),
        assignedToUserId: null,
      },
      now,
    );
    expect(sla.isOverdue).toBe(true);
    expect(sla.urgencyLabel).toBe("Over 48h");
  });

  it("sorts deterministically by severity then id", () => {
    const items = [
      {
        severity: "medium" as const,
        isOverdue: false,
        dueAt: null,
        sourceUpdatedAt: "2026-07-27T10:00:00.000Z",
        id: "b",
      },
      {
        severity: "critical" as const,
        isOverdue: true,
        dueAt: "2026-07-27T09:00:00.000Z",
        sourceUpdatedAt: "2026-07-27T08:00:00.000Z",
        id: "a",
      },
    ];
    items.sort((a, b) => compareWorkItems(a, b));
    expect(items[0]?.id).toBe("a");
  });

  it("detects urgent items", () => {
    expect(isUrgentWorkItem({ severity: "high", isOverdue: false })).toBe(true);
    expect(isUrgentWorkItem({ severity: "medium", isOverdue: true })).toBe(true);
    expect(isUrgentWorkItem({ severity: "medium", isOverdue: false })).toBe(false);
  });
});
