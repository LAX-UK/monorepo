import { describe, expect, it } from "vitest";
import { lifecycleToStatusPresentation } from "./lifecycle-status-presentation";

describe("lifecycleToStatusPresentation", () => {
  it("maps live tone to live variant with dot", () => {
    expect(lifecycleToStatusPresentation({ label: "Live now", tone: "live", pulse: true })).toEqual(
      { label: "Live now", variant: "live", dot: true },
    );
  });

  it("maps upcoming to info", () => {
    expect(
      lifecycleToStatusPresentation({ label: "Opens soon", tone: "upcoming", pulse: false }),
    ).toEqual({ label: "Opens soon", variant: "info" });
  });

  it("maps sold ended to success", () => {
    expect(lifecycleToStatusPresentation({ label: "Sold", tone: "ended", pulse: false })).toEqual({
      label: "Sold",
      variant: "success",
    });
  });

  it("maps no sale to neutral", () => {
    expect(
      lifecycleToStatusPresentation({ label: "No sale", tone: "ended", pulse: false }),
    ).toEqual({ label: "No sale", variant: "neutral" });
  });

  it("maps cancelled muted to danger", () => {
    expect(
      lifecycleToStatusPresentation({ label: "Cancelled", tone: "muted", pulse: false }),
    ).toEqual({ label: "Cancelled", variant: "danger" });
  });

  it("maps warn to warning", () => {
    expect(lifecycleToStatusPresentation({ label: "Extended", tone: "warn", pulse: true })).toEqual(
      { label: "Extended", variant: "warning", dot: true },
    );
  });
});
