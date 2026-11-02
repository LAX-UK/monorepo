import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
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

  it("counts two business days for contact enquiries, skipping weekends", () => {
    const enquiry = (sentAt: string) => ({
      sourceId: "e1",
      kind: "marketing_enquiry" as const,
      domain: "clients" as const,
      title: "Contact enquiry",
      subtitle: null,
      href: "/admin/enquiries/e1",
      saleId: null,
      createdAt: new Date(sentAt),
      sourceUpdatedAt: new Date(sentAt),
      assignedToUserId: null,
    });
    // Friday 10:00 is due Tuesday 10:00.
    const friday = enquiry("2026-07-24T10:00:00.000Z");
    expect(addBusinessDays(friday.sourceUpdatedAt, 2).toISOString()).toBe(
      "2026-07-28T10:00:00.000Z",
    );
    const monday = Date.parse("2026-07-27T12:00:00.000Z");
    expect(applyWorkItemSla(friday, monday).isOverdue).toBe(false);
    const tuesdayNoon = Date.parse("2026-07-28T12:00:00.000Z");
    const late = applyWorkItemSla(friday, tuesdayNoon);
    expect(late.isOverdue).toBe(true);
    expect(late.dueAt).toBe("2026-07-28T10:00:00.000Z");
    expect(late.urgencyLabel).toBe("Over SLA");
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
