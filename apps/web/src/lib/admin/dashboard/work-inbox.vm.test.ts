import type { AdminWorkItem } from "@/lib/data/http/admin-work-items.schema";
import { describe, expect, it } from "vitest";
import {
  parseWorkArea,
  parseWorkAssignment,
  sharedWorkAction,
  workActionConfirm,
  workAreaViews,
  workAreasFor,
  workInboxHref,
  workInboxSummary,
  workItemEntityId,
  workOwner,
  workPriority,
} from "./work-inbox.vm";

const item = (overrides: Partial<AdminWorkItem> = {}): AdminWorkItem => ({
  id: "submission:sub-1",
  kind: "submission_review",
  domain: "catalogue",
  title: "Blue interior",
  subtitle: null,
  href: "/admin/submissions/sub-1",
  saleId: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  sourceUpdatedAt: "2026-10-20T10:00:00.000Z",
  dueAt: null,
  severity: "medium",
  assignedToUserId: null,
  actions: ["approve", "reject"],
  ...overrides,
});

describe("work inbox view model", () => {
  it("marks only urgent and high work", () => {
    expect(workPriority("critical")).toEqual({ label: "Urgent", tone: "danger" });
    expect(workPriority("high")).toEqual({ label: "High", tone: "warning" });
    expect(workPriority("medium")).toBeNull();
  });

  it("names the owner for assignable work only", () => {
    expect(workOwner(item({ assignedToUserId: "me" }), "me")).toBe("You");
    expect(workOwner(item({ assignedToUserId: "them" }), "me")).toBe("Someone else");
    expect(workOwner(item(), "me")).toBe("No one yet");
    expect(workOwner(item({ kind: "payment_manual_review" }), "me")).toBeNull();
  });

  it("covers the areas of the profile's queues in a fixed order", () => {
    expect(workAreasFor(["Operations", "Finance"])).toEqual(["finance", "saleroom", "fulfilment"]);
  });

  it("reads only known areas and assignments from the URL", () => {
    expect(parseWorkArea("finance")).toBe("finance");
    expect(parseWorkArea("nope")).toBe("all");
    expect(parseWorkAssignment("mine")).toBe("mine");
    expect(parseWorkAssignment("everyone")).toBe("all");
  });

  it("keeps the period and drops defaults in the Overview URL", () => {
    const base = { area: "all" as const, assignment: "all" as const, period: "7" };
    expect(workInboxHref(base)).toBe("/admin?period=7");
    expect(workInboxHref(base, { area: "finance", item: "x:1" })).toBe(
      "/admin?area=finance&period=7&item=x%3A1",
    );
  });

  it("builds a tab per area with its count after All", () => {
    const views = workAreaViews({
      areas: ["finance", "clients"],
      counts: { finance: 2 },
      total: 5,
      href: (area) => `/admin?area=${area}`,
    });
    expect(views.map((view) => [view.label, view.count])).toEqual([
      ["All", 5],
      ["Finance", 2],
      ["Clients", 0],
    ]);
  });

  it("offers a bulk action only when every item has it, and never a refund", () => {
    expect(sharedWorkAction([item(), item({ actions: ["reject"] })])).toBe("reject");
    expect(sharedWorkAction([item({ actions: ["refund"] }), item({ actions: ["refund"] })])).toBe(
      null,
    );
    expect(sharedWorkAction([])).toBeNull();
  });

  it("asks first before actions that cannot be taken back", () => {
    expect(workActionConfirm(item(), "reject")?.title).toBe("Reject Blue interior?");
    expect(workActionConfirm(item(), "approve")).toBeNull();
  });

  it("finds the record behind an item and sums the list", () => {
    expect(workItemEntityId(item())).toBe("sub-1");
    expect(workInboxSummary([item(), item({ severity: "critical" })])).toBe("2 items · 1 urgent");
    expect(workInboxSummary([item()])).toBe("1 item");
  });
});
