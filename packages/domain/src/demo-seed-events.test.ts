import { describe, expect, it } from "vitest";
import { DEMO_SEED_EVENT_PRODUCER, isDemoSeedEvent } from "./demo-seed-events.js";

describe("isDemoSeedEvent", () => {
  it("is true only for the demo seeds' producer", () => {
    expect(isDemoSeedEvent({ producer: DEMO_SEED_EVENT_PRODUCER })).toBe(true);
    expect(isDemoSeedEvent({ producer: "apps/api" })).toBe(false);
    expect(isDemoSeedEvent({ producer: "shop-api" })).toBe(false);
    expect(isDemoSeedEvent({ producer: null })).toBe(false);
    expect(isDemoSeedEvent({})).toBe(false);
  });
});
