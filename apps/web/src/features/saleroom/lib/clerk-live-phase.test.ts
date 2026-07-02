import { deriveClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import { describe, expect, it } from "vitest";

describe("deriveClerkLivePhase", () => {
  it("returns setup when session is not live", () => {
    expect(deriveClerkLivePhase("none", { betweenLots: false }, null)).toBe("setup");
    expect(deriveClerkLivePhase("ended", { betweenLots: true }, null)).toBe("setup");
  });

  it("returns paused when session is paused with lots remaining", () => {
    expect(deriveClerkLivePhase("paused", { betweenLots: false }, "lot-1")).toBe("paused");
  });

  it("returns concluded when session is open and all lots are done", () => {
    expect(deriveClerkLivePhase("live", { betweenLots: true }, null, true)).toBe("concluded");
    expect(deriveClerkLivePhase("paused", { betweenLots: false }, null, true)).toBe("concluded");
  });

  it("returns betweenLots when live with no lot on block but lots remain", () => {
    expect(deriveClerkLivePhase("live", { betweenLots: true }, null)).toBe("betweenLots");
    expect(deriveClerkLivePhase("live", { betweenLots: false }, null)).toBe("betweenLots");
  });

  it("returns selling when live with a lot on block", () => {
    expect(deriveClerkLivePhase("live", { betweenLots: false }, "lot-1")).toBe("selling");
  });
});
