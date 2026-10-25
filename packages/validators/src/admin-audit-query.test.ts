import { describe, expect, it } from "vitest";
import { adminAuditLogQuerySchema, adminDomainEventsQuerySchema } from "./admin-audit.js";

describe("adminDomainEventsQuerySchema", () => {
  it("accepts aggregate filter pair", () => {
    const r = adminDomainEventsQuerySchema.safeParse({
      limit: 50,
      aggregateType: "lot",
      aggregateId: "00000000-0000-4000-8000-000000000001",
    });
    expect(r.success).toBe(true);
  });

  it("rejects aggregate type without id", () => {
    const r = adminDomainEventsQuerySchema.safeParse({
      aggregateType: "lot",
    });
    expect(r.success).toBe(false);
  });

  it("rejects mixing aggregate filter with event prefix", () => {
    const r = adminDomainEventsQuerySchema.safeParse({
      aggregateType: "lot",
      aggregateId: "x",
      eventTypePrefix: "payment.",
    });
    expect(r.success).toBe(false);
  });

  it("defaults offset to 0 and coerces string offset", () => {
    const r = adminDomainEventsQuerySchema.safeParse({ limit: 10 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.offset).toBe(0);

    const r2 = adminDomainEventsQuerySchema.safeParse({ limit: 10, offset: "25" });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.offset).toBe(25);
  });
});

describe("adminAuditLogQuerySchema", () => {
  it("applies paging defaults and splits event types", () => {
    const r = adminAuditLogQuerySchema.parse({
      eventTypes: "lot.created, lot.withdrawal_declined",
      view: "catalogue",
      from: "2026-10-01",
      to: "2026-10-24",
    });
    expect(r.limit).toBe(50);
    expect(r.offset).toBe(0);
    expect(r.eventTypes).toEqual(["lot.created", "lot.withdrawal_declined"]);
  });

  it("rejects an unknown view, malformed dates and a reversed range", () => {
    expect(adminAuditLogQuerySchema.safeParse({ view: "everything" }).success).toBe(false);
    expect(adminAuditLogQuerySchema.safeParse({ from: "24/10/2026" }).success).toBe(false);
    expect(
      adminAuditLogQuerySchema.safeParse({ from: "2026-10-24", to: "2026-10-01" }).success,
    ).toBe(false);
  });

  it("rejects wildcard characters in event types and an id without a type", () => {
    expect(adminAuditLogQuerySchema.safeParse({ eventTypes: "lot.%" }).success).toBe(false);
    expect(adminAuditLogQuerySchema.safeParse({ aggregateId: "abc" }).success).toBe(false);
  });

  it("accepts a sort and rejects an unknown one", () => {
    expect(adminAuditLogQuerySchema.parse({}).sort).toBeUndefined();
    expect(adminAuditLogQuerySchema.parse({ sort: "at_asc" }).sort).toBe("at_asc");
    expect(adminAuditLogQuerySchema.safeParse({ sort: "actor_asc" }).success).toBe(false);
  });

  it("caps the page size", () => {
    expect(adminAuditLogQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
