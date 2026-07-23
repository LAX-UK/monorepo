import { describe, expect, it } from "vitest";
import { lotEndedPresentation, resolveDotStatusPresentation } from "./resolver";

describe("lotEndedPresentation", () => {
  it("maps ended without winner context to neutral", () => {
    expect(lotEndedPresentation()).toEqual({ label: "Ended", variant: "neutral" });
  });

  it("maps sold when winner is present", () => {
    expect(lotEndedPresentation({ winnerId: "u1" })).toEqual({
      label: "Sold",
      variant: "success",
    });
  });
});

describe("resolveDotStatusPresentation", () => {
  it("bridges sale ended to neutral dot tone", () => {
    expect(resolveDotStatusPresentation("sale", "ended")).toEqual({
      label: "Ended",
      tone: "neutral",
    });
  });

  it("bridges sale cancelled to critical dot tone", () => {
    expect(resolveDotStatusPresentation("sale", "cancelled")).toEqual({
      label: "Cancelled",
      tone: "critical",
    });
  });
});
