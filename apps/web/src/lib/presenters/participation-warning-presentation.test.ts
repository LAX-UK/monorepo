import { describe, expect, it } from "vitest";
import {
  lotParticipationWarningPresentation,
  participationWarningCalloutClassName,
} from "./participation-warning-presentation";

describe("lotParticipationWarningPresentation", () => {
  it("maps anti-snipe extension to warning badge label", () => {
    expect(
      lotParticipationWarningPresentation("antiSnipeExtended", { extendedSeconds: 12 }),
    ).toEqual({ label: "Extended +12s", variant: "warning" });
  });

  it("maps onsite gating to warning label", () => {
    expect(lotParticipationWarningPresentation("onsiteNoWebBidding")).toEqual({
      label: "In-Person Saleroom Event",
      variant: "warning",
    });
  });
});

describe("participationWarningCalloutClassName", () => {
  it("exports callout shell classes", () => {
    expect(participationWarningCalloutClassName.length).toBeGreaterThan(0);
  });
});
