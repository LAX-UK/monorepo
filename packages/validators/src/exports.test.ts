import { describe, expect, it } from "vitest";
import { createExportBodySchema } from "./exports.js";

describe("createExportBodySchema", () => {
  it("accepts known payment export statuses", () => {
    const parsed = createExportBodySchema.safeParse({
      entityType: "payments",
      filters: { status: "captured" },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects unknown payment export statuses", () => {
    const parsed = createExportBodySchema.safeParse({
      entityType: "payments",
      filters: { status: "not_a_real_status" },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects the removed idempotencyKey export contract", () => {
    const parsed = createExportBodySchema.safeParse({
      entityType: "clients",
      filters: {},
      idempotencyKey: "misleading-contract",
    });

    expect(parsed.success).toBe(false);
  });
});
