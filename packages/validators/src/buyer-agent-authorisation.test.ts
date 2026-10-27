import { describe, expect, it } from "vitest";
import {
  authoriseBuyerAgentSchema,
  revokeBuyerAgentAuthorisationSchema,
} from "./buyer-agent-authorisation.js";

const valid = {
  memberUserId: "agent-1",
  saleId: null,
  bidLimit: 10000,
  validFrom: null,
  validUntil: null,
};

describe("authoriseBuyerAgentSchema", () => {
  it("accepts all sales with no limit and no dates", () => {
    expect(authoriseBuyerAgentSchema.safeParse({ ...valid, bidLimit: null }).success).toBe(true);
  });

  it("accepts one sale with pence and a window", () => {
    const parsed = authoriseBuyerAgentSchema.safeParse({
      ...valid,
      saleId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      bidLimit: 2500.5,
      validFrom: "2026-11-01T00:00:00Z",
      validUntil: "2026-11-30T23:59:00+00:00",
    });
    expect(parsed.success).toBe(true);
  });

  it.each([0, -1, 10.001, 2_000_000_000])("rejects a limit of %s", (bidLimit) => {
    expect(authoriseBuyerAgentSchema.safeParse({ ...valid, bidLimit }).success).toBe(false);
  });

  it("rejects an end before the start", () => {
    const parsed = authoriseBuyerAgentSchema.safeParse({
      ...valid,
      validFrom: "2026-11-30T00:00:00Z",
      validUntil: "2026-11-01T00:00:00Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(authoriseBuyerAgentSchema.safeParse({ ...valid, role: "owner" }).success).toBe(false);
  });
});

describe("revokeBuyerAgentAuthorisationSchema", () => {
  it("needs a short reason", () => {
    expect(revokeBuyerAgentAuthorisationSchema.safeParse({ reason: "  " }).success).toBe(false);
    expect(
      revokeBuyerAgentAuthorisationSchema.safeParse({ reason: "Left the gallery" }).success,
    ).toBe(true);
  });
});
