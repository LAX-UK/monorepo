import { describe, expect, it } from "vitest";
import { adminDomainEventsExportQuerySchema, adminDomainEventsQuerySchema } from "./admin-audit.js";

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
});

describe("adminDomainEventsExportQuerySchema", () => {
  it("accepts aggregate pair with format", () => {
    const r = adminDomainEventsExportQuerySchema.safeParse({
      format: "csv",
      aggregateType: "lot",
      aggregateId: "00000000-0000-4000-8000-000000000001",
      limit: 100,
    });
    expect(r.success).toBe(true);
  });

  it("rejects half aggregate pair", () => {
    const r = adminDomainEventsExportQuerySchema.safeParse({ aggregateType: "lot" });
    expect(r.success).toBe(false);
  });
});
