import { describe, expect, it } from "vitest";
import { SALE_CANCELLABLE, SALE_STATUSES_ALLOWING_LOT_ADD } from "./sale-status-policy.js";

describe("sale-status-policy", () => {
  it("SALE_CANCELLABLE includes draft, scheduled, active", () => {
    expect(SALE_CANCELLABLE.has("draft")).toBe(true);
    expect(SALE_CANCELLABLE.has("scheduled")).toBe(true);
    expect(SALE_CANCELLABLE.has("active")).toBe(true);
    expect(SALE_CANCELLABLE.has("ended")).toBe(false);
  });

  it("SALE_STATUSES_ALLOWING_LOT_ADD includes draft, scheduled, active", () => {
    expect(SALE_STATUSES_ALLOWING_LOT_ADD.has("draft")).toBe(true);
    expect(SALE_STATUSES_ALLOWING_LOT_ADD.has("scheduled")).toBe(true);
    expect(SALE_STATUSES_ALLOWING_LOT_ADD.has("active")).toBe(true);
  });
});
