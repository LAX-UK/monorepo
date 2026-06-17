import { deriveClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import { describe, expect, it } from "vitest";

describe("deriveClerkLivePhase", () => {
  it("returns setup when session is not live", () => {
    expect(deriveClerkLivePhase("none", { betweenLots: false }, null)).toBe("setup");
    expect(deriveClerkLivePhase("ended", { betweenLots: true }, null)).toBe("setup");
  });

  it("returns paused when session is paused", () => {
    expect(deriveClerkLivePhase("paused", { betweenLots: false }, "lot-1")).toBe("paused");
  });

  it("returns betweenLots when live with no lot on block", () => {
    expect(deriveClerkLivePhase("live", { betweenLots: true }, null)).toBe("betweenLots");
    expect(deriveClerkLivePhase("live", { betweenLots: false }, null)).toBe("betweenLots");
  });

  it("returns selling when live with a lot on block", () => {
    expect(deriveClerkLivePhase("live", { betweenLots: false }, "lot-1")).toBe("selling");
  });
});
