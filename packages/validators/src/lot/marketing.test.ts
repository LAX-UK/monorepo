import { describe, expect, it } from "vitest";
import { LOT_ESTIMATE_CURRENCY_MESSAGE, updateLotMarketingDetailsSchema } from "./marketing.js";

describe("lot estimate currency", () => {
  it("accepts a sterling estimate", () => {
    expect(
      updateLotMarketingDetailsSchema.safeParse({
        estimate: { low: "45000.00", high: "65000.00", currency: "GBP" },
      }).success,
    ).toBe(true);
  });

  it("rejects an estimate in another currency with a staff-readable message", () => {
    const r = updateLotMarketingDetailsSchema.safeParse({
      estimate: { low: "45000.00", high: "65000.00", currency: "USD" },
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(LOT_ESTIMATE_CURRENCY_MESSAGE);
  });
});
