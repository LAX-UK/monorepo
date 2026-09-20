import { describe, expect, it } from "vitest";
import { reaperEventIdForOrder } from "./shop-checkout-reaper.js";

describe("reaperEventIdForOrder", () => {
  it("uses a stable synthetic processed-event id", () => {
    expect(reaperEventIdForOrder("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "reaper:order:550e8400-e29b-41d4-a716-446655440000",
    );
  });
});
