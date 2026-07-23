import { describe, expect, it } from "vitest";
import { lotDotStatusPresentation } from "./lot-dot-status";

describe("lotDotStatusPresentation", () => {
  it("sale-board: active → Live", () => {
    expect(lotDotStatusPresentation({ status: "active", context: "sale-board" })).toEqual({
      label: "Live",
      tone: "live",
    });
  });

  it("sale-board: ended with winner → Sold", () => {
    expect(
      lotDotStatusPresentation({
        status: "ended",
        winnerId: "user-1",
        context: "sale-board",
      }),
    ).toEqual({ label: "Sold", tone: "sold" });
  });

  it("sale-board: ended without winner → Unsold", () => {
    expect(
      lotDotStatusPresentation({
        status: "ended",
        winnerId: null,
        context: "sale-board",
      }),
    ).toEqual({ label: "Unsold", tone: "neutral" });
  });

  it("sale-board: cancelled → Withdrawn", () => {
    expect(lotDotStatusPresentation({ status: "cancelled", context: "sale-board" })).toEqual({
      label: "Withdrawn",
      tone: "warning",
    });
  });

  it("global: ended → Ended (no sold inference)", () => {
    expect(
      lotDotStatusPresentation({
        status: "ended",
        winnerId: "user-1",
        context: "global",
      }),
    ).toEqual({ label: "Ended", tone: "neutral" });
  });

  it("global: cancelled → critical", () => {
    expect(lotDotStatusPresentation({ status: "cancelled", context: "global" })).toEqual({
      label: "Cancelled",
      tone: "critical",
    });
  });

  it("global: scheduled → Scheduled info", () => {
    expect(lotDotStatusPresentation({ status: "scheduled", context: "global" })).toEqual({
      label: "Scheduled",
      tone: "info",
    });
  });
});
